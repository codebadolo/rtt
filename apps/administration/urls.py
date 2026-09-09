
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UniversiteViewSet, SecteurViewSet, SalleViewSet, ProduitViewSet,
    VarianteViewSet, OptionViewSet, HoraireCommandeViewSet,
    AdminDashboardViewSet, configuration_view, comptabilite_view,
    solde_view, settlements_view, sync_settlement_view,
    CreneauLivraisonViewSet, JournalAuditViewSet, livreurs_en_service_view,
    profil_vendeur_view, profil_livreur_view, AdminVendeurViewSet, AdminLivreurViewSet,
)

router = DefaultRouter()
router.register(r'universites', UniversiteViewSet, basename='universite')
router.register(r'secteurs', SecteurViewSet)
router.register(r'salles', SalleViewSet)
router.register(r'produits', ProduitViewSet)
router.register(r'variantes', VarianteViewSet)
router.register(r'options', OptionViewSet)
router.register(r'horaires', HoraireCommandeViewSet)
router.register(r'creneaux', CreneauLivraisonViewSet, basename='creneau')
router.register(r'admin/journal-audit', JournalAuditViewSet, basename='journal-audit')
router.register(r'admin/vendeurs', AdminVendeurViewSet, basename='admin-vendeur')
router.register(r'admin/livreurs', AdminLivreurViewSet, basename='admin-livreur')
router.register(r'admin/dashboard', AdminDashboardViewSet, basename='admin-dashboard')

urlpatterns = [
    path('', include(router.urls)),
    path('configuration/', configuration_view, name='configuration'),
    path('profil/vendeur/', profil_vendeur_view, name='profil-vendeur'),
    path('profil/livreur/', profil_livreur_view, name='profil-livreur'),
    path('admin/comptabilite/', comptabilite_view, name='comptabilite'),
    path('admin/solde/', solde_view, name='solde'),
    path('admin/settlements/', settlements_view, name='settlements'),
    path('admin/settlements/<str:reference>/sync/', sync_settlement_view, name='settlement-sync'),
    path('admin/livreurs-en-service/', livreurs_en_service_view, name='livreurs-en-service'),
]
