"""
Client de l'API HTTP BBG SMS (https://bbgsmsapp.betterbegoing.com).

Endpoints utilisés :
- POST /api/http/sms/send            envoi d'un SMS (un ou plusieurs numéros)
- GET  /api/http/sms/{uid}           détail d'un SMS envoyé
- POST /api/http/sms/{bulk_id}/status statuts de livraison réels (DLR)

Configuration (settings / .env) :
- BBG_SMS_API_TOKEN  jeton API du compte BBG SMS
- BBG_SMS_SENDER_ID  nom d'expéditeur (11 caractères max, activé sur BBG SMS)
- BBG_SMS_BASE_URL   optionnel, URL de base de l'API
- BBG_SMS_TIMEOUT    optionnel, délai réseau en secondes
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

URL_PAR_DEFAUT = 'https://bbgsmsapp.betterbegoing.com'

# Statuts de livraison renvoyés par l'endpoint /status
LIVRE = 'DELIVERY_SUCCESS'
ECHEC = 'DELIVERY_FAILED'
EN_ATTENTE = 'PENDING'
INCONNU = 'UNKNOWN'


class BBGSMSErreur(Exception):
    """Erreur renvoyée par BBG SMS ou problème réseau."""


def est_configure():
    return bool(getattr(settings, 'BBG_SMS_API_TOKEN', '') and getattr(settings, 'BBG_SMS_SENDER_ID', ''))


def formater_destinataire(telephone):
    """BBG SMS attend l'indicatif sans '+' : +22670112233 -> 22670112233."""
    return ''.join(c for c in str(telephone) if c.isdigit())


def _appel(methode, chemin, donnees=None):
    base = getattr(settings, 'BBG_SMS_BASE_URL', '') or URL_PAR_DEFAUT
    corps = {'api_token': settings.BBG_SMS_API_TOKEN, **(donnees or {})}
    try:
        resp = requests.request(
            methode,
            f"{base.rstrip('/')}{chemin}",
            json=corps,
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            timeout=getattr(settings, 'BBG_SMS_TIMEOUT', 15),
        )
    except requests.RequestException as e:
        logger.error("BBG SMS injoignable (%s %s) : %s", methode, chemin, e)
        raise BBGSMSErreur("Service SMS injoignable.") from e

    try:
        resultat = resp.json()
    except ValueError:
        logger.error("BBG SMS réponse non JSON (%s) : %s", resp.status_code, resp.text[:300])
        raise BBGSMSErreur(f"Réponse invalide du service SMS (HTTP {resp.status_code}).")

    if isinstance(resultat, dict) and resultat.get('status') == 'error':
        logger.error("BBG SMS erreur (%s %s) : %s", methode, chemin, resultat.get('message'))
        raise BBGSMSErreur(resultat.get('message') or "Erreur du service SMS.")
    if not resp.ok:
        logger.error("BBG SMS HTTP %s (%s %s) : %s", resp.status_code, methode, chemin, resultat)
        raise BBGSMSErreur(f"Erreur du service SMS (HTTP {resp.status_code}).")
    return resultat


def envoyer_sms(destinataires, message, heure_programmee=None):
    """
    Envoie un SMS texte. `destinataires` : un numéro ou une liste de numéros.
    `heure_programmee` : datetime optionnel pour un envoi différé.
    Retourne le champ `data` de la réponse BBG (rapport d'envoi).
    """
    if isinstance(destinataires, str):
        destinataires = [destinataires]
    donnees = {
        'recipient': ','.join(formater_destinataire(t) for t in destinataires),
        'sender_id': settings.BBG_SMS_SENDER_ID,
        'type': 'plain',
        'message': message,
    }
    if heure_programmee:
        donnees['schedule_time'] = heure_programmee.strftime('%Y-%m-%d %H:%M')
    return _appel('POST', '/api/http/sms/send', donnees).get('data')


def consulter_sms(uid):
    """Détail d'un SMS envoyé (dont son statut de livraison)."""
    return _appel('GET', f'/api/http/sms/{uid}').get('data')


def statut_livraison(bulk_id):
    """
    Statuts de livraison réels d'un lot (bulk_id ou campaign_id renvoyé à l'envoi).
    Retourne une liste de dicts {id, to, send_at, updated_at, status}.
    """
    resultat = _appel('POST', f'/api/http/sms/{bulk_id}/status')
    return resultat if isinstance(resultat, list) else resultat.get('data', [])
