"""
Envoi du code OTP de vérification du téléphone par SMS (dossier V1 §4, §6, §12).

Fournisseur : BBG SMS (voir sms_bbg.py), activé dès que BBG_SMS_API_TOKEN et
BBG_SMS_SENDER_ID sont renseignés.

Sans fournisseur configuré, le code est seulement journalisé et l'envoi échoue
de façon explicite plutôt que de prétendre l'avoir envoyé. En développement
(DEBUG), le code est retourné dans la réponse API pour permettre de tester le
flux sans provider réel.
"""
import logging

from django.conf import settings

from . import sms_bbg
from .models import OTPVerification

logger = logging.getLogger(__name__)


class EnvoiOTPErreur(Exception):
    """Le code OTP n'a pas pu être envoyé."""


class EnvoiOTPNonConfigure(EnvoiOTPErreur):
    """Aucun fournisseur SMS n'est configuré."""


def envoyer_code_otp(telephone, code):
    """
    Envoie le code OTP par SMS.
    Lève EnvoiOTPNonConfigure (hors DEBUG) si aucun provider n'est branché,
    EnvoiOTPErreur si le fournisseur refuse ou est injoignable.
    """
    if not sms_bbg.est_configure():
        logger.info("OTP %s pour %s (aucun fournisseur SMS configuré — non envoyé)", code, telephone)
        if getattr(settings, 'DEBUG', False):
            return {'envoye': False, 'canal': None, 'debug_code': code}
        raise EnvoiOTPNonConfigure(
            "Aucun fournisseur SMS n'est configuré pour l'envoi des codes OTP."
        )

    message = (
        f"Ritoto Campus : votre code de verification est {code}. "
        f"Il expire dans {OTPVerification.DUREE_VALIDITE_MINUTES} minutes. Ne le partagez avec personne."
    )
    try:
        rapport = sms_bbg.envoyer_sms(telephone, message)
    except sms_bbg.BBGSMSErreur as e:
        raise EnvoiOTPErreur(
            "L'envoi du SMS a échoué. Vérifiez le numéro ou réessayez dans un instant."
        ) from e

    logger.info("OTP envoyé par SMS à %s (BBG SMS : %s)", telephone, rapport)
    return {'envoye': True, 'canal': 'sms'}
