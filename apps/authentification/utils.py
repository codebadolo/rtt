import secrets
import string
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)

def generer_mot_de_passe_temporaire(longueur=12):
    """
    Génère un mot de passe temporaire sécurisé
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    mot_de_passe = ''.join(secrets.choice(alphabet) for i in range(longueur))
    return mot_de_passe


def envoyer_email_reset_mot_de_passe(utilisateur, token):
    """
    Envoie un email de réinitialisation de mot de passe
    """
    sujet = "Réinitialisation de votre mot de passe - Ritoto-Express"
    
    contexte = {
        'utilisateur': utilisateur,
        'token': token,
        'site_url': settings.FRONTEND_URL,
    }
    
    html_message = render_to_string('emails/reset_password.html', contexte)
    plain_message = strip_tags(html_message)
    
    try:
        send_mail(
            sujet,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            [utilisateur.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Email de réinitialisation envoyé à {utilisateur.email}")
        return True
    except Exception as e:
        logger.error(f"Erreur envoi email à {utilisateur.email}: {str(e)}")
        return False


def envoyer_notification_kyc(utilisateur, statut, motif=None):
    """
    Envoie une notification pour le statut KYC
    """
    sujet = f"Mise à jour de votre KYC - Ritoto-Express"
    
    contexte = {
        'utilisateur': utilisateur,
        'statut': statut,
        'motif': motif,
        'site_url': settings.FRONTEND_URL,
    }
    
    html_message = render_to_string('emails/kyc_notification.html', contexte)
    plain_message = strip_tags(html_message)
    
    try:
        send_mail(
            sujet,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            [utilisateur.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Notification KYC envoyée à {utilisateur.email}")
        return True
    except Exception as e:
        logger.error(f"Erreur envoi notification KYC à {utilisateur.email}: {str(e)}")
        return False


def verifier_format_telephone(telephone):
    """
    Vérifie le format du téléphone
    """
    import re
    pattern = r'^\+?[0-9]{8,15}$'
    return bool(re.match(pattern, telephone))


def extraire_infos_google(token_info):
    """
    Extrait les informations utiles du token Google
    """
    return {
        'email': token_info.get('email'),
        'google_id': token_info.get('sub'),
        'nom': token_info.get('family_name', ''),
        'prenom': token_info.get('given_name', ''),
        'photo': token_info.get('picture'),
        'email_verifie': token_info.get('email_verified', False),
    }