from django.core.management.base import BaseCommand
import random

from apps.administration.models import Produit, Variante, Option, ProfilVendeur, Universite
from apps.authentification.models import Utilisateur

class Command(BaseCommand):
    help = 'Génère des produits de test, rattachés à une boutique vendeur de test'

    def handle(self, *args, **options):
        admin = Utilisateur.objects.filter(role='ADMIN').first()
        if not admin:
            admin = Utilisateur.objects.create_superuser(
                email='admin@test.com',
                password='admin123',
                nom='Admin',
                prenom='Super'
            )

        vendeur_user = Utilisateur.objects.filter(email='vendeur.test@ritoto-campus.com').first()
        if not vendeur_user:
            vendeur_user = Utilisateur.objects.create_user(
                email='vendeur.test@ritoto-campus.com',
                password='vendeur123',
                nom='Test',
                prenom='Vendeur',
                telephone='70000000',
                role=Utilisateur.Role.VENDEUR_INTERIEUR,
            )

        profil_vendeur, _ = ProfilVendeur.objects.get_or_create(
            utilisateur=vendeur_user,
            defaults={
                'universite': Universite.objects.first(),
                'nom_boutique': 'Boutique Test',
                'description': 'Boutique de test générée automatiquement',
                'categorie_principale': 'SANDWICH',
                'est_valide': True,
                'est_actif': True,
            }
        )
        if not profil_vendeur.est_valide:
            profil_vendeur.est_valide = True
            profil_vendeur.est_actif = True
            profil_vendeur.save(update_fields=['est_valide', 'est_actif'])

        produits_data = [
            {
                'nom': 'Sandwich Poulet',
                'categorie': 'SANDWICH',
                'prix_base': 1500,
                'variantes': ['Petit', 'Moyen', 'Grand'],
                'options': ['Mayonnaise', 'Ketchup', 'Piment', 'Fromage']
            },
            {
                'nom': 'Coca-Cola',
                'categorie': 'BOISSON',
                'prix_base': 500,
                'variantes': ['33cl', '50cl', '1.5L'],
                'options': []
            },
            {
                'nom': 'Croissant',
                'categorie': 'PATISSERIE',
                'prix_base': 400,
                'variantes': ['Nature', 'Au chocolat'],
                'options': []
            },
        ]

        for data in produits_data:
            produit, created = Produit.objects.get_or_create(
                nom=data['nom'],
                vendeur=profil_vendeur,
                defaults={
                    'description': f"Description du {data['nom']}",
                    'categorie': data['categorie'],
                    'prix_base': data['prix_base'],
                    'est_actif': True,
                    'cree_par': admin,
                }
            )
            if not created:
                self.stdout.write(f'↷ Produit déjà existant, ignoré: {data["nom"]}')
                continue

            for i, var_nom in enumerate(data['variantes']):
                Variante.objects.create(
                    produit=produit,
                    nom=var_nom,
                    ajustement_prix=i * 200,
                    est_actif=True
                )

            for opt_nom in data['options']:
                Option.objects.create(
                    produit=produit,
                    nom=opt_nom,
                    prix=random.randint(50, 200),
                    est_actif=True
                )

            self.stdout.write(f'✅ Produit créé: {data["nom"]}')

        self.stdout.write(self.style.SUCCESS(
            f'\nBoutique vendeur de test: {profil_vendeur.nom_boutique} '
            f'({vendeur_user.email} / vendeur123)'
        ))
