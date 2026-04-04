"""
Service d'intégration avec l'API Senfenico
"""
import hashlib
import base64
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SENFENICO_BASE_URL = "https://api.senfenico.com"

# Mapping méthode de paiement → provider Senfenico
PROVIDER_MAP = {
    'ORANGE': 'orange_bf',
    'MOOV':   'moov_bf',
    'SANK':   'sank_bf',
}


def _headers():
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': settings.SENFENICO_API_KEY,
    }


def creer_charge(montant: int, telephone: str, methode_paiement: str) -> dict:
    """
    Crée une charge Senfenico (paiement sans redirection).
    Retourne le dict `data` de la réponse Senfenico, ou lève une exception.
    """
    provider = PROVIDER_MAP.get(methode_paiement)
    if not provider:
        raise ValueError(f"Méthode de paiement non supportée par Senfenico : {methode_paiement}")

    payload = {
        "amount": str(montant),
        "currency": "XOF",
        "payment_method": "mobile_money",
        "payment_method_details": {
            "phone": telephone,
            "provider": provider,
        },
    }

    try:
        resp = requests.post(
            f"{SENFENICO_BASE_URL}/v1/payment/charges/",
            json=payload,
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            raise ValueError(body.get("message", "Erreur Senfenico inconnue"))
        return body["data"]
    except requests.RequestException as e:
        logger.error("Senfenico creer_charge error: %s", e)
        raise


def soumettre_otp(charge_reference: str, otp: str) -> dict:
    """
    Soumet l'OTP pour finaliser une charge.
    Retourne le dict `data` de la réponse Senfenico.
    """
    payload = {
        "otp": otp,
        "charge_reference": charge_reference,
    }

    try:
        resp = requests.post(
            f"{SENFENICO_BASE_URL}/v1/payment/charges/submit",
            json=payload,
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            raise ValueError(body.get("message", "OTP invalide"))
        return body["data"]
    except requests.RequestException as e:
        logger.error("Senfenico soumettre_otp error: %s", e)
        raise


def fetch_balance() -> dict:
    """
    Récupère le solde Senfenico (collection + transfer balances).
    Retourne le dict `data` de la réponse.
    """
    try:
        resp = requests.get(
            f"{SENFENICO_BASE_URL}/v1/payment/balances",
            headers=_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            raise ValueError(body.get("message", "Erreur Senfenico"))
        return body["data"]
    except requests.RequestException as e:
        logger.error("Senfenico fetch_balance error: %s", e)
        raise


def creer_settlement(montant: int) -> dict:
    """
    Déclenche un settlement vers le compte configuré dans le dashboard Senfenico.
    Retourne le dict `data` de la réponse.
    """
    try:
        resp = requests.post(
            f"{SENFENICO_BASE_URL}/v1/payment/settlements/",
            json={"amount": montant},
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            raise ValueError(body.get("message", "Erreur Senfenico settlement"))
        return body["data"]
    except requests.RequestException as e:
        logger.error("Senfenico creer_settlement error: %s", e)
        raise


def fetch_settlements() -> list:
    """
    Récupère la liste des settlements depuis Senfenico.
    """
    try:
        resp = requests.get(
            f"{SENFENICO_BASE_URL}/v1/payment/settlements",
            headers=_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("status"):
            raise ValueError(body.get("message", "Erreur Senfenico"))
        return body.get("data", [])
    except requests.RequestException as e:
        logger.error("Senfenico fetch_settlements error: %s", e)
        raise


def verifier_webhook_hash(payload_bytes: bytes, received_hash: str) -> bool:
    """
    Vérifie le hash X-Webhook-Hash envoyé par Senfenico.
    hash = base64(SHA256(payload + WEBHOOK_SECRET))
    """
    secret = getattr(settings, 'SENFENICO_WEBHOOK_SECRET', '')
    data = payload_bytes + secret.encode('utf-8')
    digest = hashlib.sha256(data).digest()
    computed = base64.b64encode(digest).decode('utf-8')
    return computed == received_hash
