"""
Crée des boutiques de démonstration validées et y rattache les produits du
catalogue historique (produits sans vendeur), pour que le parcours client
« campus → boutique → commande » soit testable.

Idempotent : relancer la commande ne crée pas de doublons.

    python manage.py creer_boutiques_demo --universite 1
    python manage.py creer_boutiques_demo --universite 1 --dry-run
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.administration.models import ProfilVendeur, Produit, Universite
from apps.authentification.models import Utilisateur

# (email du compte vendeur, nom, catégorie, description, catégories de produits rattachées)
BOUTIQUES = [
    ('demo-boissons@ritoto-campus.com', 'Boissons du campus', 'BOISSON',
     'Boissons fraîches : sodas, eau, jus locaux.', ['BOISSON']),
    ('demo-snack@ritoto-campus.com', 'Snack du campus', 'SANDWICH',
     'Sandwichs et plats à emporter.', ['SANDWICH', 'SNACK', 'PATISSERIE', 'AUTRE']),
]


class Command(BaseCommand):
    help = "Crée des boutiques de démonstration validées et y rattache les produits sans vendeur."

    def add_arguments(self, parser):
        parser.add_argument('--universite', type=int, required=True, help="ID de l'université")
        parser.add_argument('--dry-run', action='store_true', help="Affiche ce qui serait fait, sans rien écrire")

    def handle(self, *args, universite, dry_run, **options):
        try:
            univ = Universite.objects.get(pk=universite)
        except Universite.DoesNotExist:
            raise CommandError(f"Université {universite} introuvable.")

        with transaction.atomic():
            for email, nom, categorie, description, categories_produits in BOUTIQUES:
                user, cree = Utilisateur.objects.get_or_create(
                    email=email,
                    defaults={'nom': nom, 'prenom': 'Démo', 'telephone': '',
                              'role': Utilisateur.Role.VENDEUR, 'universite': univ},
                )
                if cree:
                    user.set_unusable_password()
                    user.save(update_fields=['password'])
                profil, _ = ProfilVendeur.objects.get_or_create(
                    utilisateur=user,
                    defaults={'nom_boutique': nom, 'description': description,
                              'categorie_principale': categorie, 'universite': univ},
                )
                if profil.statut_validation != ProfilVendeur.StatutValidation.VALIDE:
                    profil.statut_validation = ProfilVendeur.StatutValidation.VALIDE
                    profil.date_validation = timezone.now()
                    profil.est_actif = True
                    profil.save()

                produits = Produit.objects.filter(vendeur__isnull=True, categorie__in=categories_produits)
                noms = list(produits.values_list('nom', flat=True))
                produits.update(vendeur=profil)
                self.stdout.write(f"{'[nouvelle] ' if cree else ''}{nom} (#{profil.pk}) : "
                                  f"{len(noms)} produit(s) rattaché(s) {noms}")

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("Dry-run : rien n'a été enregistré."))
            else:
                self.stdout.write(self.style.SUCCESS("Boutiques de démonstration prêtes."))
