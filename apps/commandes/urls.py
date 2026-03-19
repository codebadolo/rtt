from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CommandeViewSet, senfenico_webhook, senfenico_charges_list, PlainteViewSet

router = DefaultRouter()
router.register(r'commandes', CommandeViewSet, basename='commande')
router.register(r'plaintes', PlainteViewSet, basename='plainte')

urlpatterns = router.urls + [
    path('paiements/webhook/', senfenico_webhook, name='senfenico-webhook'),
    path('paiements/charges/', senfenico_charges_list, name='senfenico-charges'),
]
