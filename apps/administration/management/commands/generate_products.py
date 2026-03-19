from django.core.management.base import BaseCommand
import random

from apps.administration.models import Produit, Variante, Option
from apps.authentification.models import Utilisateur

class Command(BaseCommand):
    help = 'Génère des produits de test'

    def handle(self, *args, **options):
        admin = Utilisateur.objects.filter(role='ADMIN').first()
        if not admin:
            admin = Utilisateur.objects.create_superuser(
                email='admin@test.com',
                password='admin123',
                nom='Admin',
                prenom='Super'
            )

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
            produit = Produit.objects.create(
                nom=data['nom'],
                description=f"Description du {data['nom']}",
                categorie=data['categorie'],
                prix_base=data['prix_base'],
                est_actif=True,
                cree_par=admin
            )

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
