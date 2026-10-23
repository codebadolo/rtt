from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AuthViewSet, UtilisateurViewSet, DossierKYCViewSet, otp_envoyer_view, otp_verifier_view,
    parcours_verifier_telephone_view,
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'utilisateurs', UtilisateurViewSet)
router.register(r'kyc', DossierKYCViewSet, basename='kyc')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/otp/envoyer/', otp_envoyer_view, name='otp-envoyer'),
    path('auth/otp/verifier/', otp_verifier_view, name='otp-verifier'),
    path('auth/parcours/verifier-telephone/', parcours_verifier_telephone_view, name='parcours-verifier-telephone'),
]