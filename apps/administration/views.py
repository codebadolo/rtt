from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Sum
from django.utils import timezone
from .models import Secteur, Salle, Produit, Variante, Option, HoraireCommande, Configuration
from .serializers import (
    SecteurListSerializer, SecteurDetailSerializer,
    SalleListSerializer, SalleDetailSerializer,
    ProduitListSerializer, ProduitDetailSerializer,
    VarianteSerializer, OptionSerializer,
    HoraireCommandeSerializer, DashboardStatsSerializer,
    ConfigurationSerializer
)
from apps.authentification.permissions import EstAdmin, EstChefSecteurOuAdmin
from .permissions import EstAdminOuLectureSeule, PeutGererProduits, PeutGererSecteurs
from apps.commandes.models import Commande
import logging

logger = logging.getLogger(__name__)


# ──────────────────── VIEWSET SECTEUR ────────────────────
class SecteurViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des secteurs
    """
    queryset = Secteur.objects.all().order_by('nom')
    permission_classes = [IsAuthenticated, EstAdminOuLectureSeule]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    filterset_fields = ['est_actif']
    search_fields = ['nom', 'code', 'description']
    ordering_fields = ['nom', 'date_creation']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SecteurListSerializer
        return SecteurDetailSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()

        # Les chefs de secteur ne voient que leurs secteurs
        if hasattr(self.request.user, 'est_chef_secteur') and self.request.user.est_chef_secteur:
            return queryset.filter(chefs=self.request.user)

        return queryset

    @action(detail=True, methods=['post'], url_path='assigner-chefs', permission_classes=[])
    def assigner_chefs(self, request, pk=None):
        """
        Assigne / remplace la liste des chefs d'un secteur.
        Body: { "chefs": [id1, id2, ...] }
        """
        from apps.authentification.permissions import EstAdmin
        if not (request.user.is_authenticated and request.user.est_admin):
            return Response({'error': 'Permission refusée'}, status=status.HTTP_403_FORBIDDEN)

        secteur = self.get_object()
        chef_ids = request.data.get('chefs', [])
        from apps.authentification.models import Utilisateur as U
        chefs = U.objects.filter(id__in=chef_ids, role='CHEF_SECTEUR', est_actif=True)
        secteur.chefs.set(chefs)
        serializer = SecteurDetailSerializer(secteur)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='salles')
    def salles_du_secteur(self, request, pk=None):
        """
        Liste les salles d'un secteur
        """
        secteur = self.get_object()
        salles = secteur.salles.filter(est_actif=True)
        serializer = SalleListSerializer(salles, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='statistiques')
    def statistiques(self, request, pk=None):
        """
        Statistiques détaillées d'un secteur
        """
        secteur = self.get_object()
        today = timezone.now().date()
        
        # Commandes du secteur
        commandes = Commande.objects.filter(secteur=secteur)
        
        stats = {
            'id': secteur.id,
            'nom': secteur.nom,
            'total_salles': secteur.salles.count(),
            'salles_actives': secteur.salles.filter(est_actif=True).count(),
            'commandes_aujourdhui': commandes.filter(date_creation__date=today).count(),
            'commandes_en_attente': commandes.filter(statut='EN_ATTENTE').count(),
            'commandes_validees': commandes.filter(statut='VALIDEE').count(),
            'ca_aujourdhui': float(commandes.filter(
                date_creation__date=today,
                statut='VALIDEE'
            ).aggregate(total=Sum('total_ttc'))['total'] or 0),
            'ca_mois': float(commandes.filter(
                date_creation__month=today.month,
                date_creation__year=today.year,
                statut='VALIDEE'
            ).aggregate(total=Sum('total_ttc'))['total'] or 0),
        }
        
        return Response(stats)
    
    @action(detail=False, methods=['get'], url_path='actifs')
    def actifs(self, request):
        """
        Liste les secteurs actifs
        """
        secteurs = self.queryset.filter(est_actif=True)
        serializer = SecteurListSerializer(secteurs, many=True)
        return Response(serializer.data)


# ──────────────────── VIEWSET SALLE ────────────────────
class SalleViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des salles
    """
    queryset = Salle.objects.select_related('secteur').all().order_by('secteur__nom', 'nom')
    permission_classes = [IsAuthenticated, EstAdminOuLectureSeule]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['secteur', 'est_actif', 'batiment']
    search_fields = ['nom', 'code', 'batiment']
    ordering_fields = ['nom', 'date_creation']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SalleListSerializer
        return SalleDetailSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Les chefs de secteur ne voient que les salles de leurs secteurs
        if hasattr(self.request.user, 'est_chef_secteur') and self.request.user.est_chef_secteur:
            return queryset.filter(secteur__chefs=self.request.user)
        
        return queryset
    
    @action(detail=False, methods=['get'], url_path='disponibles')
    def disponibles(self, request):
        """
        Liste les salles disponibles (actives avec livreurs)
        """
        salles = self.queryset.filter(
            est_actif=True,
            livreur_1__isnull=False,
            livreur_2__isnull=False
        )
        serializer = SalleListSerializer(salles, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='livreurs')
    def livreurs(self, request, pk=None):
        """
        Récupère les livreurs d'une salle
        """
        salle = self.get_object()
        livreurs = []
        
        if salle.livreur_1:
            livreurs.append({
                'id': salle.livreur_1.id,
                'nom': salle.livreur_1.get_full_name(),
                'email': salle.livreur_1.email,
                'telephone': salle.livreur_1.telephone
            })
        
        if salle.livreur_2:
            livreurs.append({
                'id': salle.livreur_2.id,
                'nom': salle.livreur_2.get_full_name(),
                'email': salle.livreur_2.email,
                'telephone': salle.livreur_2.telephone
            })
        
        return Response(livreurs)


# ──────────────────── VIEWSET PRODUIT ────────────────────
class ProduitViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des produits
    """
    queryset = Produit.objects.prefetch_related('variantes', 'options').all()
    permission_classes = [IsAuthenticated, PeutGererProduits]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['categorie', 'est_actif']
    search_fields = ['nom', 'description']
    ordering_fields = ['nom', 'prix_base', 'date_creation']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProduitListSerializer
        return ProduitDetailSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'par_categorie', 'populaires', 'recherche']:
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [EstAdmin]
        return [permission() for permission in self.permission_classes]
    
    def perform_create(self, serializer):
        """Ajoute l'utilisateur qui crée"""
        serializer.save(cree_par=self.request.user)
    
    @action(detail=False, methods=['get'], url_path='par-categorie')
    def par_categorie(self, request):
        """
        Regroupe les produits par catégorie
        """
        categories = {}
        for produit in self.get_queryset().filter(est_actif=True):
            cat = produit.categorie
            if cat not in categories:
                categories[cat] = []
            categories[cat].append({
                'id': produit.id,
                'nom': produit.nom,
                'prix_base': float(produit.prix_base),
                'image': produit.image.url if produit.image else None
            })
        
        return Response(categories)
    
    @action(detail=False, methods=['get'], url_path='populaires')
    def populaires(self, request):
        """
        Produits les plus commandés
        """
        from apps.commandes.models import LigneCommande
        
        produits_populaires = LigneCommande.objects.values(
            'produit_id'
        ).annotate(
            total_commandes=Count('id')
        ).order_by('-total_commandes')[:10]
        
        result = []
        for item in produits_populaires:
            try:
                produit = Produit.objects.get(id=item['produit_id'])
                result.append({
                    'id': produit.id,
                    'nom': produit.nom,
                    'total_commandes': item['total_commandes'],
                    'image': produit.image.url if produit.image else None
                })
            except Produit.DoesNotExist:
                continue
        
        return Response(result)
    
    @action(detail=False, methods=['get'], url_path='recherche')
    def recherche(self, request):
        """
        Recherche avancée de produits
        """
        query = request.query_params.get('q', '')
        if len(query) < 2:
            return Response([])
        
        produits = self.queryset.filter(
            Q(nom__icontains=query) | Q(description__icontains=query)
        )[:20]
        
        serializer = ProduitListSerializer(produits, many=True)
        return Response(serializer.data)


# ──────────────────── VIEWSET VARIANTE ────────────────────
class VarianteViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des variantes
    """
    queryset = Variante.objects.select_related('produit').all()
    serializer_class = VarianteSerializer
    permission_classes = [IsAuthenticated, EstAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['produit', 'est_actif']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        produit_id = self.request.query_params.get('produit')
        if produit_id:
            queryset = queryset.filter(produit_id=produit_id)
        return queryset


# ──────────────────── VIEWSET OPTION ────────────────────
class OptionViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des options
    """
    queryset = Option.objects.select_related('produit').all()
    serializer_class = OptionSerializer
    permission_classes = [IsAuthenticated, EstAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['produit', 'est_actif']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        produit_id = self.request.query_params.get('produit')
        if produit_id:
            queryset = queryset.filter(produit_id=produit_id)
        return queryset


# ──────────────────── VIEWSET HORAIRE ────────────────────
class HoraireCommandeViewSet(viewsets.ModelViewSet):
    """
    API pour la gestion des horaires de commande
    """
    queryset = HoraireCommande.objects.select_related('secteur').all()
    serializer_class = HoraireCommandeSerializer
    permission_classes = [IsAuthenticated, EstChefSecteurOuAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['secteur', 'jour_semaine', 'est_actif']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Les chefs de secteur ne voient que les horaires de leurs secteurs
        if hasattr(self.request.user, 'est_chef_secteur') and self.request.user.est_chef_secteur:
            return queryset.filter(secteur__chefs=self.request.user)
        
        return queryset
    
    @action(detail=False, methods=['get'], url_path='aujourdhui')
    def aujourdhui(self, request):
        """
        Horaires valables aujourd'hui
        """
        today = timezone.now()
        horaires = self.queryset.filter(
            jour_semaine=today.isoweekday(),
            est_actif=True
        )
        serializer = self.get_serializer(horaires, many=True)
        return Response(serializer.data)


# ──────────────────── VIEWSET DASHBOARD ADMIN ────────────────────
class AdminDashboardViewSet(viewsets.ViewSet):
    """
    API pour le dashboard administrateur
    """
    permission_classes = [IsAuthenticated, EstAdmin]
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        Statistiques globales pour l'admin
        """
        today = timezone.now().date()
        
        # Statistiques de base
        total_secteurs = Secteur.objects.count()
        total_salles = Salle.objects.count()
        total_produits = Produit.objects.count()
        total_commandes = Commande.objects.count()
        
        # Commandes aujourd'hui
        commandes_aujourdhui = Commande.objects.filter(
            date_creation__date=today
        )
        nb_commandes_aujourdhui = commandes_aujourdhui.count()
        ca_aujourdhui = float(commandes_aujourdhui.filter(
            statut='VALIDEE'
        ).aggregate(total=Sum('total_ttc'))['total'] or 0)
        
        # CA du mois
        commandes_mois = Commande.objects.filter(
            date_creation__month=today.month,
            date_creation__year=today.year,
            statut='VALIDEE'
        )
        ca_mois = float(commandes_mois.aggregate(total=Sum('total_ttc'))['total'] or 0)
        
        # Top secteurs
        top_secteurs = []
        for secteur in Secteur.objects.filter(est_actif=True)[:5]:
            commandes_secteur = Commande.objects.filter(secteur=secteur)
            top_secteurs.append({
                'id': secteur.id,
                'nom': secteur.nom,
                'total_commandes': commandes_secteur.count(),
                'commandes_en_attente': commandes_secteur.filter(statut='EN_ATTENTE').count(),
                'commandes_validees': commandes_secteur.filter(statut='VALIDEE').count(),
                'total_ca': float(commandes_secteur.filter(statut='VALIDEE').aggregate(
                    total=Sum('total_ttc')
                )['total'] or 0)
            })
        
        # Produits populaires
        from apps.commandes.models import LigneCommande
        produits_populaires = LigneCommande.objects.values(
            'produit__id', 'produit__nom'
        ).annotate(
            total=Count('id')
        ).order_by('-total')[:5]
        
        # Commandes récentes
        commandes_recentes = Commande.objects.select_related(
            'etudiant', 'secteur', 'salle'
        ).order_by('-date_creation')[:10]
        
        recentes_data = []
        for cmd in commandes_recentes:
            recentes_data.append({
                'id': cmd.id,
                'numero': cmd.numero_commande,
                'etudiant': cmd.etudiant.get_full_name(),
                'secteur': cmd.secteur.nom,
                'salle': cmd.salle.nom,
                'total': float(cmd.total_ttc),
                'statut': cmd.statut,
                'date': cmd.date_creation
            })
        
        stats = {
            'total_secteurs': total_secteurs,
            'total_salles': total_salles,
            'total_produits': total_produits,
            'total_commandes': total_commandes,
            'commandes_aujourdhui': nb_commandes_aujourdhui,
            'ca_aujourdhui': ca_aujourdhui,
            'ca_mois': ca_mois,
            'top_secteurs': top_secteurs,
            'produits_populaires': list(produits_populaires),
            'commandes_recentes': recentes_data
        }
        
        serializer = DashboardStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='tendances')
    def tendances(self, request):
        """
        Données pour les graphiques de tendance
        """
        period = request.query_params.get('period', 'week')
        today = timezone.now().date()
        
        if period == 'week':
            # 7 derniers jours
            dates = [(today - timezone.timedelta(days=i)) for i in range(6, -1, -1)]
        elif period == 'month':
            # 30 derniers jours
            dates = [(today - timezone.timedelta(days=i)) for i in range(29, -1, -1)]
        else:
            dates = [today]
        
        data = []
        for date in dates:
            commandes_jour = Commande.objects.filter(date_creation__date=date)
            data.append({
                'date': date.strftime('%d/%m'),
                'commandes': commandes_jour.count(),
                'ca': float(commandes_jour.filter(statut='VALIDEE').aggregate(
                    total=Sum('total_ttc')
                )['total'] or 0)
            })
        
        return Response(data)


# ──────────────────── CONFIGURATION TARIFAIRE ────────────────────
from rest_framework.decorators import api_view as drf_api_view

@drf_api_view(['GET', 'PATCH'])
def configuration_view(request):
    """
    GET  /api/configuration/ → accessible à tous les utilisateurs authentifiés
    PATCH /api/configuration/ → admin seulement
    """
    config = Configuration.get_active()

    if request.method == 'GET':
        return Response(ConfigurationSerializer(config).data)

    # PATCH — admin seulement
    if not (hasattr(request.user, 'est_admin') and request.user.est_admin):
        return Response({'error': 'Permission refusée'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ConfigurationSerializer(config, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ──────────────────── COMPTABILITÉ ────────────────────
@drf_api_view(['GET'])
def comptabilite_view(request):
    """
    GET /api/admin/comptabilite/?periode=today|week|month|all
    Statistiques financières pour l'administration.
    """
    if not (request.user.is_authenticated and hasattr(request.user, 'est_admin') and request.user.est_admin):
        return Response({'error': 'Permission refusée'}, status=status.HTTP_403_FORBIDDEN)

    from datetime import timedelta
    from django.db.models import Sum, Count, Q
    from apps.commandes.models import Commande

    periode = request.query_params.get('periode', 'month')
    today = timezone.now().date()

    if periode == 'today':
        date_debut = today
    elif periode == 'week':
        date_debut = today - timedelta(days=6)
    elif periode == 'month':
        date_debut = today.replace(day=1)
    else:  # all
        date_debut = None

    # Filtrer les commandes validées / distribuées
    statuts_encaissees = ['VALIDEE', 'PRETE', 'DISTRIBUEE']
    qs_base = Commande.objects.filter(statut__in=statuts_encaissees)
    qs_all = Commande.objects.all()

    if date_debut:
        qs_base = qs_base.filter(date_creation__date__gte=date_debut)
        qs_all = qs_all.filter(date_creation__date__gte=date_debut)

    agg = qs_base.aggregate(
        nb_commandes=Count('id'),
        ca_brut=Sum('total_ttc'),
        revenus_produits=Sum('total_ht'),
        frais_service_total=Sum('frais_service'),
    )
    agg_all = qs_all.aggregate(
        nb_total=Count('id'),
        nb_en_attente=Count('id', filter=Q(statut='EN_ATTENTE')),
        nb_validees=Count('id', filter=Q(statut__in=statuts_encaissees)),
        nb_annulees=Count('id', filter=Q(statut__in=['ANNULEE', 'REJETEE'])),
    )

    config = Configuration.get_active()

    # Par secteur
    par_secteur = []
    for secteur in Secteur.objects.filter(est_actif=True):
        qs_s = qs_base.filter(secteur=secteur)
        agg_s = qs_s.aggregate(
            nb=Count('id'),
            ca=Sum('total_ttc'),
            ht=Sum('total_ht'),
            fs=Sum('frais_service'),
        )
        par_secteur.append({
            'id': secteur.id,
            'nom': secteur.nom,
            'nb_commandes': agg_s['nb'] or 0,
            'ca_brut': float(agg_s['ca'] or 0),
            'revenus_produits': float(agg_s['ht'] or 0),
            'frais_service': float(agg_s['fs'] or 0),
        })
    par_secteur.sort(key=lambda x: x['ca_brut'], reverse=True)

    # Évolution journalière (7 derniers jours ou depuis date_debut)
    nb_jours = min((today - date_debut).days + 1 if date_debut else 30, 30)
    evolution = []
    for i in range(nb_jours - 1, -1, -1):
        d = today - timedelta(days=i)
        qs_j = Commande.objects.filter(statut__in=statuts_encaissees, date_creation__date=d)
        agg_j = qs_j.aggregate(nb=Count('id'), ca=Sum('total_ttc'), fs=Sum('frais_service'))
        evolution.append({
            'date': d.strftime('%d/%m'),
            'nb_commandes': agg_j['nb'] or 0,
            'ca_brut': float(agg_j['ca'] or 0),
            'frais_service': float(agg_j['fs'] or 0),
        })

    return Response({
        'periode': periode,
        'taux_service': float(config.taux_service),
        'resume': {
            'nb_commandes_encaissees': agg['nb_commandes'] or 0,
            'nb_total': agg_all['nb_total'] or 0,
            'nb_en_attente': agg_all['nb_en_attente'] or 0,
            'nb_validees': agg_all['nb_validees'] or 0,
            'nb_annulees': agg_all['nb_annulees'] or 0,
            'ca_brut': float(agg['ca_brut'] or 0),
            'revenus_produits': float(agg['revenus_produits'] or 0),
            'frais_service_total': float(agg['frais_service_total'] or 0),
        },
        'par_secteur': par_secteur,
        'evolution': evolution,
    })
