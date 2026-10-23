"""
Recherche d'un compte à partir d'un numéro de téléphone normalisé.

Les comptes créés avant la V1 stockent le téléphone tel que saisi
(« 70 00 00 00 », « +226 70000000 »…) : on présélectionne sur les derniers
chiffres puis on compare la forme normalisée (voir normaliser_telephone).
"""


def trouver_utilisateur_par_telephone(telephone_normalise, queryset=None):
    from .models import Utilisateur, normaliser_telephone

    qs = queryset if queryset is not None else Utilisateur.objects.all()
    candidats = [
        u for u in qs.filter(telephone__endswith=telephone_normalise[-2:]).order_by('-telephone_verifie', 'date_inscription')
        if normaliser_telephone(u.telephone) == telephone_normalise
    ]
    return candidats[0] if candidats else None
