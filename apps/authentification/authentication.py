from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from .models import Utilisateur
import logging

logger = logging.getLogger(__name__)

class AuthentificationEmailMotDePasse(TokenAuthentication):
    """
    Authentification personnalisée avec validation du statut utilisateur
    """
    keyword = 'Bearer'
    
    def authenticate_credentials(self, key):
        try:
            token = self.get_model().objects.select_related('user').get(key=key)
        except self.get_model().DoesNotExist:
            raise AuthenticationFailed('Token invalide')
        
        if not token.user.is_active:
            raise AuthenticationFailed('Compte désactivé')
        
        # Le frontend gère la redirection KYC

        # Mettre à jour la dernière connexion
        token.user.derniere_connexion = timezone.now()
        token.user.save(update_fields=['derniere_connexion'])
        
        logger.info(f"Authentification réussie: {token.user.email}")
        return (token.user, token)


class AuthentificationGoogle(TokenAuthentication):
    """
    Authentification spécifique pour Google OAuth
    """
    keyword = 'Google'
    
    def authenticate_credentials(self, key):
        # Cette méthode sera appelée après validation Google
        try:
            user = Utilisateur.objects.get(google_id=key, est_actif=True)
            user.derniere_connexion = timezone.now()
            user.save(update_fields=['derniere_connexion'])
            return (user, None)
        except Utilisateur.DoesNotExist:
            raise AuthenticationFailed('Utilisateur Google non trouvé')