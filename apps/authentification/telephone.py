"""
Normalisation des numéros de téléphone (Burkina Faso, indicatif +226).

Le téléphone vérifié par OTP sert d'identifiant aux étudiants et vendeurs
(parcours V1 sans mot de passe) : il doit donc être stocké et comparé sous
une forme unique, quel que soit le format saisi (« 70 00 00 00 »,
« +226 70000000 », « 0022670000000 »…).
"""
import re

INDICATIF = '226'
LONGUEUR_LOCALE = 8


def normaliser_telephone(valeur):
    """Retourne le numéro au format +226XXXXXXXX, ou None s'il est invalide."""
    if not valeur:
        return None
    chiffres = re.sub(r'\D', '', str(valeur))
    if chiffres.startswith('00'):
        chiffres = chiffres[2:]
    if len(chiffres) == LONGUEUR_LOCALE:
        chiffres = INDICATIF + chiffres
    if not (chiffres.startswith(INDICATIF) and len(chiffres) == len(INDICATIF) + LONGUEUR_LOCALE):
        return None
    return '+' + chiffres


def trouver_utilisateur_par_telephone(telephone_normalise, queryset=None):
    """
    Retrouve un utilisateur à partir d'un numéro normalisé. Les comptes créés
    avant la V1 stockent le téléphone tel que saisi : on présélectionne sur les
    8 derniers chiffres puis on compare la forme normalisée.
    """
    from .models import Utilisateur

    qs = queryset if queryset is not None else Utilisateur.objects.all()
    suffixe = telephone_normalise[-LONGUEUR_LOCALE:]
    candidats = [
        u for u in qs.filter(telephone__endswith=suffixe[-2:]).order_by('-telephone_verifie', 'date_inscription')
        if normaliser_telephone(u.telephone) == telephone_normalise
    ]
    return candidats[0] if candidats else None
