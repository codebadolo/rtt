from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from .models import Commande, HistoriqueCommande, StatutCommande, PaiementSenfenico, Plainte
from .serializers import CommandeListSerializer, CommandeDetailSerializer, CommandeCreateSerializer, HistoriqueCommandeSerializer, PaiementSenfenicoSerializer, PlainteSerializer, PlainteAdminSerializer
from .services import creer_charge, soumettre_otp as senfenico_soumettre_otp, verifier_webhook_hash
from apps.authentification.permissions import EstAdmin, EstChefSecteurOuAdmin
import logging

logger = logging.getLogger(__name__)


class CommandeViewSet(viewsets.ModelViewSet):
    """
    API de gestion des commandes
    """
    queryset = Commande.objects.select_related(
        'etudiant', 'salle', 'secteur'
    ).prefetch_related('lignes').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['statut', 'methode_paiement', 'secteur', 'salle']
    search_fields = ['numero_commande', 'etudiant__nom', 'etudiant__prenom', 'reference_paiement']
    ordering_fields = ['date_creation', 'total_ttc', 'statut']
    ordering = ['-date_creation']

    def get_serializer_class(self):
        if self.action == 'create':
            return CommandeCreateSerializer
        if self.action in ['retrieve', 'historique']:
            return CommandeDetailSerializer
        return CommandeListSerializer

    def perform_create(self, serializer):
        commande = serializer.save(etudiant=self.request.user)
        from apps.commandes.consumers import notifier_nouvelle_commande
        notifier_nouvelle_commande(commande)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if hasattr(user, 'est_admin') and user.est_admin:
            return queryset

        if hasattr(user, 'est_chef_secteur') and user.est_chef_secteur:
            return queryset.filter(secteur__chefs=user)

        if hasattr(user, 'est_etudiant') and user.est_etudiant:
            return queryset.filter(etudiant=user)

        if hasattr(user, 'est_livreur') and user.est_livreur:
            return queryset.filter(
                Q(salle__livreur_1=user) | Q(salle__livreur_2=user)
            )

        return queryset.none()

    def get_permissions(self):
        if self.action in ['valider', 'rejeter', 'marquer_prete']:
            self.permission_classes = [EstChefSecteurOuAdmin]
        elif self.action in ['destroy']:
            self.permission_classes = [EstAdmin]
        else:
            self.permission_classes = [IsAuthenticated]
        return [p() for p in self.permission_classes]

    @action(detail=True, methods=['post'], url_path='valider')
    def valider(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != StatutCommande.EN_ATTENTE:
            return Response({'error': 'Seules les commandes EN_ATTENTE peuvent être validées'},
                            status=status.HTTP_400_BAD_REQUEST)
        reference = request.data.get('reference_paiement')
        commande.valider(request.user, reference)
        return Response({'message': 'Commande validée', 'statut': commande.statut})

    @action(detail=True, methods=['post'], url_path='rejeter')
    def rejeter(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != StatutCommande.EN_ATTENTE:
            return Response({'error': 'Seules les commandes EN_ATTENTE peuvent être rejetées'},
                            status=status.HTTP_400_BAD_REQUEST)
        motif = request.data.get('motif_rejet', '') or request.data.get('motif', '')
        if not motif:
            return Response({'error': 'Le motif est requis'}, status=status.HTTP_400_BAD_REQUEST)
        commande.rejeter(request.user, motif)
        return Response({'message': 'Commande rejetée', 'statut': commande.statut})

    @action(detail=True, methods=['post'], url_path='marquer-prete')
    def marquer_prete(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != StatutCommande.VALIDEE:
            return Response({'error': 'Seules les commandes VALIDEE peuvent être marquées prêtes'},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.marquer_prete(request.user)
        return Response({'message': 'Commande prête', 'statut': commande.statut})

    @action(detail=True, methods=['post'], url_path='distribuer')
    def distribuer(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != StatutCommande.PRETE:
            return Response({'error': 'Seules les commandes PRETE peuvent être distribuées'},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.distribuer(request.user)
        return Response({'message': 'Commande distribuée', 'statut': commande.statut})

    @action(detail=True, methods=['post'], url_path='annuler')
    def annuler(self, request, pk=None):
        commande = self.get_object()
        motif = request.data.get('motif', 'Annulation')
        commande.annuler(request.user, motif)
        return Response({'message': 'Commande annulée', 'statut': commande.statut})

    @action(detail=True, methods=['get'], url_path='historique')
    def historique(self, request, pk=None):
        commande = self.get_object()
        historique = HistoriqueCommande.objects.filter(commande=commande).order_by('-date_modification')
        serializer = HistoriqueCommandeSerializer(historique, many=True)
        return Response(serializer.data)

    # ── Senfenico : initier paiement ───────────────────────────────────
    @action(detail=True, methods=['post'], url_path='initier-paiement')
    def initier_paiement(self, request, pk=None):
        """
        Initie une charge Senfenico pour une commande EN_ATTENTE.
        Retourne charge_reference, statut et display_text.
        """
        commande = self.get_object()

        if commande.statut != StatutCommande.EN_ATTENTE:
            return Response(
                {'error': 'Seules les commandes EN_ATTENTE peuvent être payées'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if commande.etudiant != request.user:
            return Response({'error': 'Interdit'}, status=status.HTTP_403_FORBIDDEN)

        # Éviter les doubles charges
        if hasattr(commande, 'paiement_senfenico'):
            p = commande.paiement_senfenico
            return Response({
                'charge_reference': p.charge_reference,
                'statut': p.statut,
                'display_text': p.display_text,
            })

        try:
            data = creer_charge(
                montant=int(commande.total_ttc),
                telephone=commande.telephone_paiement,
                methode_paiement=commande.methode_paiement,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Senfenico charge error for commande %s: %s", commande.pk, e)
            return Response(
                {'error': 'Erreur lors de l\'initiation du paiement. Réessayez.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        PaiementSenfenico.objects.create(
            commande=commande,
            charge_reference=data['reference'],
            statut=data['status'],
            display_text=data.get('display_text', ''),
        )

        return Response({
            'charge_reference': data['reference'],
            'statut': data['status'],
            'display_text': data.get('display_text', ''),
        })

    # ── Senfenico : soumettre OTP ──────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='soumettre-otp')
    def soumettre_otp(self, request, pk=None):
        """
        Soumet l'OTP pour finaliser le paiement Senfenico.
        Auto-valide la commande si le paiement réussit.
        """
        commande = self.get_object()

        if commande.etudiant != request.user:
            return Response({'error': 'Interdit'}, status=status.HTTP_403_FORBIDDEN)

        otp = request.data.get('otp', '').strip()
        if not otp:
            return Response({'error': 'OTP requis'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            paiement = commande.paiement_senfenico
        except PaiementSenfenico.DoesNotExist:
            return Response(
                {'error': 'Aucun paiement Senfenico trouvé pour cette commande'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = senfenico_soumettre_otp(paiement.charge_reference, otp)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Senfenico OTP error for commande %s: %s", commande.pk, e)
            return Response(
                {'error': 'Erreur lors de la vérification de l\'OTP'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        charge_statut = data.get('status', 'failed')
        paiement.statut = charge_statut
        paiement.save(update_fields=['statut'])

        if charge_statut == 'success':
            commande.valider(request.user, reference_paiement=paiement.charge_reference)
            return Response({'message': 'Paiement réussi ! Commande validée.', 'statut': 'success'})

        return Response(
            {'error': 'Paiement échoué. Vérifiez votre OTP et réessayez.', 'statut': charge_statut},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Payments stats endpoint ────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='paiements/stats',
            permission_classes=[EstAdmin])
    def paiements_stats(self, request):
        """
        Statistiques globales des paiements
        """
        qs = Commande.objects.exclude(statut=StatutCommande.BROUILLON)

        methodes = ['ORANGE', 'MOOV', 'SANK']
        stats_methodes = {}
        for m in methodes:
            agg = qs.filter(methode_paiement=m).aggregate(
                count=Count('id'),
                total=Sum('total_ttc')
            )
            stats_methodes[m] = {
                'count': agg['count'] or 0,
                'total': float(agg['total'] or 0),
            }

        valides_agg = qs.filter(
            statut__in=[StatutCommande.VALIDEE, StatutCommande.PRETE, StatutCommande.DISTRIBUEE]
        ).aggregate(count=Count('id'), total=Sum('total_ttc'))

        en_attente_count = qs.filter(statut=StatutCommande.EN_ATTENTE).count()

        return Response({
            'total_paiements': qs.count(),
            'montant_total_valide': float(valides_agg['total'] or 0),
            'en_attente': en_attente_count,
            'par_methode': stats_methodes,
        })


@api_view(['GET'])
@permission_classes([EstAdmin])
def senfenico_charges_list(request):
    """
    Liste toutes les charges Senfenico (admin uniquement).
    """
    qs = PaiementSenfenico.objects.select_related(
        'commande', 'commande__etudiant'
    ).order_by('-date_creation')

    statut = request.query_params.get('statut')
    if statut:
        qs = qs.filter(statut=statut)

    serializer = PaiementSenfenicoSerializer(qs, many=True)
    return Response({'results': serializer.data, 'count': qs.count()})


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def senfenico_webhook(request):
    """
    Reçoit les événements webhook de Senfenico.
    Vérifie le hash et auto-valide la commande si le paiement est success.
    """
    received_hash = request.META.get('HTTP_X_WEBHOOK_HASH', '')
    raw_body = request.body

    if not verifier_webhook_hash(raw_body, received_hash):
        logger.warning("Senfenico webhook: hash invalide")
        return Response({'error': 'Hash invalide'}, status=status.HTTP_400_BAD_REQUEST)

    payload = request.data
    charge_ref = payload.get('reference') or payload.get('data', {}).get('reference')
    charge_statut = payload.get('status') or payload.get('data', {}).get('status')

    if not charge_ref:
        return Response({'ok': True})

    try:
        paiement = PaiementSenfenico.objects.select_related('commande').get(
            charge_reference=charge_ref
        )
    except PaiementSenfenico.DoesNotExist:
        logger.warning("Senfenico webhook: charge inconnue %s", charge_ref)
        return Response({'ok': True})

    paiement.statut = charge_statut or paiement.statut
    paiement.save(update_fields=['statut'])

    commande = paiement.commande
    if charge_statut == 'success' and commande.statut == StatutCommande.EN_ATTENTE:
        commande.valider(None, reference_paiement=charge_ref)
        logger.info("Commande %s validée via webhook Senfenico", commande.numero_commande)

    return Response({'ok': True})


class PlainteViewSet(viewsets.ModelViewSet):
    """
    API pour les plaintes étudiants.
    - Étudiant : crée et voit ses propres plaintes
    - Admin/Chef : voit toutes les plaintes, peut modifier statut et réponse
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['statut', 'categorie']
    ordering = ['-date_creation']

    def get_queryset(self):
        user = self.request.user
        if user.est_admin or user.est_chef_secteur:
            return Plainte.objects.select_related('etudiant', 'commande').all()
        return Plainte.objects.select_related('etudiant', 'commande').filter(etudiant=user)

    def get_serializer_class(self):
        user = self.request.user
        if user.est_admin or user.est_chef_secteur:
            return PlainteAdminSerializer
        return PlainteSerializer

    def perform_create(self, serializer):
        serializer.save(etudiant=self.request.user)
