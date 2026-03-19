from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
import logging

logger = logging.getLogger(__name__)
Utilisateur = get_user_model()

@receiver(post_save, sender=Utilisateur)
def creer_token_utilisateur(sender, instance=None, created=False, **kwargs):
    """
    Crée automatiquement un token pour chaque nouvel utilisateur
    """
    if created:
        Token.objects.create(user=instance)
        logger.info(f"Token créé pour {instance.email}")


@receiver(pre_save, sender=Utilisateur)
def normaliser_email(sender, instance, **kwargs):
    """
    Normalise l'email avant sauvegarde
    """
    if instance.email:
        instance.email = instance.email.lower().strip()


@receiver(post_save, sender=Utilisateur)
def logger_creation_utilisateur(sender, instance, created, **kwargs):
    """
    Log la création d'un utilisateur
    """
    if created:
        logger.info(f"Nouvel utilisateur créé: {instance.email} (rôle: {instance.role})")