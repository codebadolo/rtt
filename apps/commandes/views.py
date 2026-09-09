from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from .models import (
    Commande, HistoriqueCommande, StatutCommande, PaiementSenfenico, Plainte, QRCodeCommande,
    Remboursement, NoteVendeur, NoteLivreur, WalletVendeur, TransactionWallet,
)
from .serializers import (
    CommandeListSerializer, CommandeDetailSerializer, CommandeCreateSerializer, HistoriqueCommandeSerializer,
    PaiementSenfenicoSerializer, PlainteSerializer, PlainteAdminSerializer,
    RemboursementSerializer, NoteVendeurCreateSerializer, NoteLivreurCreateSerializer,
    WalletVendeurSerializer, TransactionWalletSerializer,
)
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

        if hasattr(user, 'est_vendeur') and user.est_vendeur:
            profil = getattr(user, 'profil_vendeur', None)
            if not profil:
                return queryset.none()
            # Ancien mode (compat) : commandes de son secteur non rattachées à un vendeur
            legacy = Q(vendeur__isnull=True, secteur=profil.emplacement_id) if profil.emplacement_id else Q(pk__in=[])
            return queryset.filter(Q(vendeur=profil) | legacy)

        if hasattr(user, 'est_livreur') and user.est_livreur:
            # Ancien mode (salle) conservé pour compat des commandes non rattachées à un vendeur
            legacy = (
                Q(vendeur__isnull=True)
                & (Q(salle__livreur_1=user) | Q(salle__livreur_2=user))
                & Q(statut__in=['VALIDEE', 'PRETE', 'DISTRIBUEE'])
            )
            # Missions déjà acceptées par ce livreur (historique / suivi)
            mine = Q(livreur_assigne=user)

            profil = getattr(user, 'profil_livreur', None)
            if not profil or not profil.en_service:
                # Hors service : uniquement ses propres missions en cours + historique legacy
                return queryset.filter(legacy | mine)

            # Pool flexible (§3.4/§7) : commandes PRETE non encore acceptées,
            # limitées à ses boutiques attribuées s'il en a (sinon tout le pool = volant).
            pool = Q(statut='PRETE', livreur_assigne__isnull=True)
            boutiques = profil.boutiques_attribuees.all()
            if boutiques.exists():
                pool &= Q(vendeur__in=boutiques)

            return queryset.filter(pool | legacy | mine).distinct()

        return queryset.none()

    def get_permissions(self):
        if self.action in ['valider', 'rejeter']:
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
        if commande.statut != StatutCommande.EN_PREPARATION:
            return Response({'error': 'Seules les commandes EN_PREPARATION peuvent être marquées prêtes'},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.marquer_prete(request.user)
        return Response({'message': 'Commande prête', 'statut': commande.statut})

    # ── Vendeur : accepter la commande (§4.5 : EN_ATTENTE/VALIDEE → ACCEPTEE) ──
    @action(detail=True, methods=['post'], url_path='accepter-vendeur')
    def accepter_vendeur(self, request, pk=None):
        """
        Le vendeur confirme la commande — passe en ACCEPTEE et génère le
        code de retrait court (§6.1).
        """
        commande = self.get_object()
        user = request.user
        if commande.vendeur_id and (not hasattr(user, 'profil_vendeur') or commande.vendeur_id != user.profil_vendeur.id):
            return Response({'error': 'Cette commande ne concerne pas votre boutique'}, status=status.HTTP_403_FORBIDDEN)
        if commande.statut not in (StatutCommande.EN_ATTENTE, StatutCommande.VALIDEE):
            return Response({'error': 'Cette commande ne peut pas être acceptée dans son statut actuel'},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.accepter_vendeur(user)
        return Response({
            'message': 'Commande acceptée', 'statut': commande.statut,
            'code_retrait': commande.code_retrait,
        })

    # ── Vendeur : démarrer la préparation (§4.5 : ACCEPTEE → EN_PREPARATION) ──
    @action(detail=True, methods=['post'], url_path='en-preparation')
    def en_preparation(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != StatutCommande.ACCEPTEE:
            return Response({'error': 'Seules les commandes ACCEPTEE peuvent démarrer en préparation'},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.demarrer_preparation(request.user)
        return Response({'message': 'Préparation démarrée', 'statut': commande.statut})

    # ── Livreur : accepter la mission (pool flexible) ───────────────────
    @action(detail=True, methods=['post'], url_path='accepter-mission')
    def accepter_mission(self, request, pk=None):
        """
        Le livreur accepte la mission — premier arrivé, premier servi (§3.4).
        La commande disparaît immédiatement de la liste des autres livreurs.
        """
        user = request.user
        if not (hasattr(user, 'est_livreur') and user.est_livreur):
            return Response({'error': 'Réservé aux livreurs'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            commande = Commande.objects.select_for_update().get(pk=pk)
            if commande.statut != StatutCommande.PRETE:
                return Response({'error': "Cette commande n'est plus disponible"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                commande.accepter_mission_livreur(user)
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_409_CONFLICT)

        return Response({
            'message': 'Mission acceptée', 'statut': commande.statut,
            'code_retrait': commande.code_retrait,
        })

    @action(detail=True, methods=['post'], url_path='distribuer')
    def distribuer(self, request, pk=None):
        commande = self.get_object()
        # Nouveau flux : la mission doit avoir été acceptée (EN_LIVRAISON).
        # Ancien flux (commandes sans vendeur/mission, compat) : PRETE direct.
        statuts_valides = (StatutCommande.EN_LIVRAISON,) if commande.vendeur_id else (StatutCommande.PRETE, StatutCommande.EN_LIVRAISON)
        if commande.statut not in statuts_valides:
            return Response({'error': "Cette commande n'est pas prête à être distribuée"},
                            status=status.HTTP_400_BAD_REQUEST)
        commande.distribuer(request.user)
        return Response({'message': 'Commande distribuée', 'statut': commande.statut})

    @action(detail=True, methods=['post'], url_path='annuler')
    def annuler(self, request, pk=None):
        """
        Annulation client (avant EN_PREPARATION uniquement) ou admin (force=True
        pour un cas exceptionnel après le début de la préparation) — §5.2/§8.
        """
        commande = self.get_object()
        user = request.user
        is_admin = hasattr(user, 'est_admin') and user.est_admin

        if commande.etudiant != user and not is_admin:
            return Response({'error': 'Interdit'}, status=status.HTTP_403_FORBIDDEN)

        motif = request.data.get('motif', 'Annulation')
        force = bool(request.data.get('force')) and is_admin
        try:
            commande.annuler(user, motif, force=force)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Commande annulée', 'statut': commande.statut})

    # ── Notation (§10) ──────────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='noter-vendeur')
    def noter_vendeur(self, request):
        serializer = NoteVendeurCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='noter-livreur')
    def noter_livreur(self, request):
        serializer = NoteLivreurCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

        if int(commande.total_ttc) < 100:
            return Response(
                {'error': f'Le montant total ({int(commande.total_ttc)} FCFA) est inférieur au minimum requis de 100 FCFA.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            if commande.statut == StatutCommande.EN_ATTENTE:
                try:
                    commande.valider(None, reference_paiement=paiement.charge_reference)
                except Exception as e:
                    logger.error("Erreur validation commande %s après OTP success: %s", commande.pk, e)
                    return Response(
                        {'error': 'Paiement reçu mais erreur lors de la validation. Contactez le support.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
            return Response({'message': 'Paiement réussi ! Commande validée.', 'statut': 'success'})

        return Response(
            {'error': 'Paiement échoué. Vérifiez votre OTP et réessayez.', 'statut': charge_statut},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── QR Code : générer pour l'étudiant ─────────────────────────────
    @action(detail=True, methods=['get'], url_path='qr-code')
    def qr_code(self, request, pk=None):
        """
        Retourne l'image QR code (base64) et le payload offline d'une commande validée.
        Accessible uniquement par l'étudiant propriétaire.
        """
        commande = self.get_object()

        if commande.etudiant != request.user:
            return Response({'error': 'Interdit'}, status=status.HTTP_403_FORBIDDEN)

        if commande.statut not in [
            StatutCommande.VALIDEE, StatutCommande.ACCEPTEE,
            StatutCommande.EN_PREPARATION, StatutCommande.PRETE, StatutCommande.EN_LIVRAISON,
        ]:
            return Response(
                {'error': 'QR code disponible uniquement pour les commandes validées, en préparation ou en livraison'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qr = commande.qr_code
        except QRCodeCommande.DoesNotExist:
            qr = QRCodeCommande.generer_pour_commande(commande)

        if qr.est_utilise:
            return Response(
                {'error': 'Ce QR code a déjà été utilisé (commande livrée)', 'est_utilise': True},
                status=status.HTTP_410_GONE,
            )

        return Response({
            'image': qr.generer_image_base64(),
            'payload': qr.payload_offline,
            'token': str(qr.token),
            'est_utilise': False,
        })

    # ── QR Code : valider par le livreur ──────────────────────────────
    @action(detail=False, methods=['post'], url_path='valider-qr')
    def valider_qr(self, request):
        """
        Valide un QR code scanné par le livreur.
        Invalide le QR et marque la commande comme DISTRIBUEE.
        """
        user = request.user
        if not (hasattr(user, 'est_livreur') and user.est_livreur):
            return Response({'error': 'Réservé aux livreurs'}, status=status.HTTP_403_FORBIDDEN)

        token = request.data.get('token', '').strip()
        if not token:
            return Response({'error': 'Token requis'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                qr = (
                    QRCodeCommande.objects
                    .select_for_update()
                    .select_related(
                        'commande', 'commande__etudiant',
                        'commande__salle', 'commande__secteur'
                    )
                    .prefetch_related('commande__lignes__produit')
                    .get(token=token)
                )
            except (QRCodeCommande.DoesNotExist, Exception):
                return Response({'error': 'QR code invalide'}, status=status.HTTP_404_NOT_FOUND)

            if qr.est_utilise:
                return Response(
                    {'error': 'Ce QR code a déjà été utilisé. Livraison déjà confirmée.'},
                    status=status.HTTP_409_CONFLICT,
                )

            commande = qr.commande

            # Nouveau flux : la mission doit avoir été acceptée par ce livreur.
            # Ancien flux (compat, commandes sans vendeur) : assignation par salle.
            if commande.livreur_assigne_id:
                if commande.livreur_assigne_id != user.id:
                    return Response(
                        {'error': "Cette mission a été acceptée par un autre livreur"},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                salle = commande.salle
                if salle.livreur_1 != user and salle.livreur_2 != user:
                    return Response(
                        {'error': "Vous n'êtes pas assigné à la salle de cette commande"},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            statuts_valides = (StatutCommande.EN_LIVRAISON,) if commande.vendeur_id else (StatutCommande.PRETE, StatutCommande.EN_LIVRAISON)
            if commande.statut not in statuts_valides:
                return Response(
                    {'error': f"La commande n'est pas encore prête à être remise (statut : {commande.get_statut_display()})"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            qr.est_utilise = True
            qr.date_utilisation = timezone.now()
            qr.utilise_par = user
            qr.save(update_fields=['est_utilise', 'date_utilisation', 'utilise_par'])

            commande.distribuer(user)

        return Response({
            'message': 'Livraison confirmée avec succès !',
            'commande': {
                'numero': commande.numero_commande,
                'etudiant': commande.etudiant.get_full_name(),
                'salle': commande.salle.nom,
                'secteur': commande.secteur.nom,
                'total_ttc': float(commande.total_ttc),
                'lignes': [
                    {
                        'produit': l.produit.nom,
                        'quantite': l.quantite,
                        'sous_total': float(l.sous_total),
                    }
                    for l in commande.lignes.select_related('produit').all()
                ],
            },
            'date_distribution': qr.date_utilisation.isoformat(),
        })

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
@permission_classes([IsAuthenticated])
def wallet_view(request):
    """GET /api/wallet/ — solde en attente/disponible du vendeur connecté (§5.1)."""
    user = request.user
    if not (hasattr(user, 'est_vendeur') and user.est_vendeur):
        return Response({'error': 'Réservé aux vendeurs'}, status=status.HTTP_403_FORBIDDEN)
    wallet, _ = WalletVendeur.objects.get_or_create(vendeur=user)
    return Response(WalletVendeurSerializer(wallet).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def wallet_transactions_view(request):
    """GET /api/wallet/transactions/ — historique des mouvements du vendeur connecté."""
    user = request.user
    if not (hasattr(user, 'est_vendeur') and user.est_vendeur):
        return Response({'error': 'Réservé aux vendeurs'}, status=status.HTTP_403_FORBIDDEN)
    wallet, _ = WalletVendeur.objects.get_or_create(vendeur=user)
    transactions = wallet.transactions.select_related('commande').all()[:200]
    return Response({
        'results': TransactionWalletSerializer(transactions, many=True).data,
        'count': wallet.transactions.count(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def senfenico_charges_list(request):
    """
    Liste les charges Senfenico.
    Admins : toutes les charges.
    Chefs de secteur : charges des commandes de leurs secteurs.
    """
    user = request.user
    is_admin = hasattr(user, 'est_admin') and user.est_admin
    is_chef = hasattr(user, 'est_chef_secteur') and user.est_chef_secteur

    if not (is_admin or is_chef):
        return Response({'error': 'Permission refusée'}, status=status.HTTP_403_FORBIDDEN)

    qs = PaiementSenfenico.objects.select_related(
        'commande', 'commande__etudiant', 'commande__secteur'
    ).order_by('-date_creation')

    if is_chef and not is_admin:
        qs = qs.filter(commande__secteur__chefs=user)

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
    API pour les signalements — accessibles au client, au vendeur et au
    livreur (§9.1), pas seulement à l'étudiant.
    - Auteur : crée et voit ses propres signalements
    - Admin/Chef : voit tous les signalements, peut modifier statut et réponse
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['statut', 'categorie']
    ordering = ['-date_creation']

    def get_queryset(self):
        user = self.request.user
        if user.est_admin or user.est_chef_secteur:
            return Plainte.objects.select_related('etudiant', 'auteur', 'commande').all()
        return Plainte.objects.select_related('etudiant', 'auteur', 'commande').filter(
            Q(etudiant=user) | Q(auteur=user)
        )

    def get_serializer_class(self):
        user = self.request.user
        if user.est_admin or user.est_chef_secteur:
            return PlainteAdminSerializer
        return PlainteSerializer

    def perform_create(self, serializer):
        # `etudiant` reste requis en base (compat) ; `auteur` porte l'identité
        # réelle du signalant, qui peut être un vendeur ou un livreur (§9.1).
        serializer.save(etudiant=self.request.user, auteur=self.request.user)


# ──────────────────── VIEWSET REMBOURSEMENT ────────────────────
class RemboursementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Suivi des remboursements (§5.2). Lecture + action de traitement manuel
    réservées à l'administration (aucune API de remboursement automatique
    confirmée côté agrégateur — filet de sécurité manuel, §5.2/§14).
    """
    queryset = Remboursement.objects.select_related('commande', 'traite_par').all()
    serializer_class = RemboursementSerializer
    permission_classes = [EstAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['statut', 'automatique']
    ordering = ['-date_creation']

    @action(detail=True, methods=['post'], url_path='marquer-traite')
    def marquer_traite(self, request, pk=None):
        remboursement = self.get_object()
        if remboursement.statut != 'EN_ATTENTE':
            return Response({'error': 'Ce remboursement a déjà été traité'}, status=status.HTTP_400_BAD_REQUEST)
        remboursement.marquer_traite(request.user)
        return Response(RemboursementSerializer(remboursement).data)
