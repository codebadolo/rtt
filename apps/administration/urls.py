
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SecteurViewSet, SalleViewSet, ProduitViewSet,
    VarianteViewSet, OptionViewSet, HoraireCommandeViewSet,
    AdminDashboardViewSet, configuration_view
)

router = DefaultRouter()
router.register(r'secteurs', SecteurViewSet)
router.register(r'salles', SalleViewSet)
router.register(r'produits', ProduitViewSet)
router.register(r'variantes', VarianteViewSet)
router.register(r'options', OptionViewSet)
router.register(r'horaires', HoraireCommandeViewSet)
router.register(r'admin/dashboard', AdminDashboardViewSet, basename='admin-dashboard')

urlpatterns = [
    path('', include(router.urls)),
    path('configuration/', configuration_view, name='configuration'),
]
