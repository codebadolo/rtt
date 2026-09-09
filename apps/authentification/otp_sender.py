"""
Envoi du code OTP d'inscription — WhatsApp Business en priorité, repli SMS (§3.1, §13.2).

Aucun fournisseur WhatsApp Business / SMS n'est configuré à ce jour (pas de clé
API dans les settings). Cette fonction journalise le code et échoue de façon
explicite plutôt que de prétendre l'avoir envoyé, pour que le manque
d'intégration réelle reste visible en production. En développement (DEBUG),
le code est retourné dans la réponse API pour permettre de tester le flux
sans provider réel.

Pour brancher un vrai fournisseur : implémenter l'appel API ici (ex. WhatsApp
Business Cloud API, puis repli Twilio/Orange SMS API en cas d'échec), sans
changer la signature de cette fonction ni le reste du flux OTP.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class EnvoiOTPNonConfigure(Exception):
    """Aucun fournisseur WhatsApp/SMS n'est configuré."""


def envoyer_code_otp(telephone, code):
    """
    Envoie le code OTP par WhatsApp, avec repli SMS en cas d'échec (§3.1).
    Lève EnvoiOTPNonConfigure tant qu'aucun provider n'est branché — voir
    la docstring du module.
    """
    logger.info("OTP %s pour %s (aucun provider WhatsApp/SMS configuré — non envoyé)", code, telephone)

    if getattr(settings, 'DEBUG', False):
        return {'envoye': False, 'canal': None, 'debug_code': code}

    raise EnvoiOTPNonConfigure(
        "Aucun fournisseur WhatsApp Business / SMS n'est configuré pour l'envoi des codes OTP."
    )
