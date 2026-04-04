"""
Management command: seed_data
Peuple la base avec les vraies salles et produits de Ritoto Express.
Usage: python manage.py seed_data [--reset]
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import Secteur, Salle, Produit, Variante, Option
from apps.authentification.models import Utilisateur


class Command(BaseCommand):
    help = 'Seed salles et produits réels (Ritoto Express)'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Supprimer avant de recréer')

    @transaction.atomic
    def handle(self, *args, **options):
        admin = Utilisateur.objects.filter(role='ADMIN').first()

        if options['reset']:
            Variante.objects.all().delete()
            Option.objects.all().delete()
            Produit.objects.all().delete()
            Salle.objects.all().delete()
            Secteur.objects.all().delete()
            self.stdout.write(self.style.WARNING('🗑  Données existantes supprimées'))

        # ─── SECTEURS ──────────────────────────────────────────────────
        secteurs_data = [
            {'code': 'SEC1', 'nom': 'Secteur 1', 'description': 'Amphis : R0, R1, R2, R4'},
            {'code': 'SEC2', 'nom': 'Secteur 2', 'description': 'Salles 01 à 13'},
            {'code': 'SEC3', 'nom': 'Secteur 3', 'description': 'Salles 14 à 27 — Tour du Savoir'},
            {'code': 'SEC4', 'nom': 'Secteur 4', 'description': 'Laboratoires : LAB A, LAB B, Rooms 03-08'},
        ]
        secteurs = {}
        for sd in secteurs_data:
            sec, _ = Secteur.objects.get_or_create(
                code=sd['code'],
                defaults={'nom': sd['nom'], 'description': sd['description'], 'est_actif': True}
            )
            secteurs[sd['code']] = sec
            self.stdout.write(f'🏫  Secteur: {sec}')

        sec1, sec2, sec3, sec4 = secteurs['SEC1'], secteurs['SEC2'], secteurs['SEC3'], secteurs['SEC4']

        # ─── SALLES ────────────────────────────────────────────────────
        salles_data = []

        # Secteur 1 — Amphis
        for code in ['R0', 'R1', 'R2', 'R4']:
            salles_data.append({
                'code': f'AMPHI-{code}', 'nom': f'Amphi {code}',
                'batiment': 'Bâtiment Principal', 'etage': 'RDC', 'secteur': sec1,
            })

        # Secteur 2 — Salles 01-13
        for i in range(1, 14):
            salles_data.append({
                'code': f'S{i:02d}', 'nom': f'Salle {i:02d}',
                'batiment': 'Bâtiment Pédagogique', 'etage': 'Étage 1', 'secteur': sec2,
            })

        # Secteur 3 — Salles 14-27 + Tour du Savoir
        for i in range(14, 28):
            salles_data.append({
                'code': f'S{i:02d}', 'nom': f'Salle {i:02d}',
                'batiment': 'Bâtiment Pédagogique', 'etage': 'Étage 2', 'secteur': sec3,
            })
        salles_data.append({'code': 'TOUR-SAVOIR-1', 'nom': 'Salle Tour du Savoir 1', 'batiment': 'Tour du Savoir', 'etage': 'RDC',     'secteur': sec3})
        salles_data.append({'code': 'TOUR-SAVOIR-2', 'nom': 'Salle Tour du Savoir 2', 'batiment': 'Tour du Savoir', 'etage': 'Étage 1', 'secteur': sec3})
        salles_data.append({'code': 'PR-TOGUYENI',   'nom': 'Salle Pr. Toguyéni',     'batiment': 'Bâtiment Admin', 'etage': 'Étage 1', 'secteur': sec3})

        # Secteur 4 — Laboratoires
        salles_data.append({'code': 'LAB-A-01', 'nom': 'LAB A - Room 01', 'batiment': 'Bâtiment Lab', 'etage': 'RDC', 'secteur': sec4})
        for j in range(1, 4):
            salles_data.append({'code': f'LAB-B-0{j}', 'nom': f'LAB B - Room 0{j}', 'batiment': 'Bâtiment Lab', 'etage': 'RDC', 'secteur': sec4})
        for j in range(3, 9):
            salles_data.append({'code': f'ROOM-0{j}', 'nom': f'Room 0{j}', 'batiment': 'Bâtiment Lab', 'etage': 'Étage 1', 'secteur': sec4})

        created_salles = 0
        for s in salles_data:
            _, created = Salle.objects.get_or_create(
                code=s['code'],
                defaults={
                    'secteur': s['secteur'],
                    'nom': s['nom'],
                    'batiment': s.get('batiment', ''),
                    'etage': s.get('etage', ''),
                    'est_actif': True,
                }
            )
            if created:
                created_salles += 1

        self.stdout.write(self.style.SUCCESS(f'🚪  {created_salles} salles créées ({Salle.objects.count()} total)'))

        # ─── PRODUITS ──────────────────────────────────────────────────
        # Options communes aux pains
        OPTIONS_PAIN = [
            ('Crudité',       0),
            ('Ketchup',       0),
            ('Mayonnaise',    0),
            ('Moutarde',      0),
            ('Piment',        0),
            ('Arome Maggi',   0),
        ]

        produits_data = [
            # ── Pain Brochettes ──────────────────────────────────────
            {
                'nom': 'Pain Brochettes',
                'description': 'Pain garni de brochettes grillées, disponible en plusieurs tailles.',
                'categorie': 'SANDWICH',
                'prix_base': 200,
                'variantes': [
                    ('Quart',                    0,    200),
                    ('Demie',                    150,  350),
                    ('Demie (400f)',              200,  400),
                    ('3/4',                      300,  500),
                    ('Entier',                   300,  500),
                    ('Demie avec 3 Brochettes',  300,  500),
                    ('Demie avec 4 Brochettes',  400,  600),
                ],
                'options': OPTIONS_PAIN,
            },
            # ── Pain Saucisse ─────────────────────────────────────────
            {
                'nom': 'Pain Saucisse',
                'description': 'Pain garni de saucisse, disponible en plusieurs tailles.',
                'categorie': 'SANDWICH',
                'prix_base': 700,
                'variantes': [
                    ('Demie',  0,   700),
                    ('3/4',    100, 800),
                ],
                'options': OPTIONS_PAIN,
            },
            # ── Eaux ──────────────────────────────────────────────────
            {
                'nom': 'Eau en bouteille',
                'description': 'Eau fraîche disponible en plusieurs formats.',
                'categorie': 'BOISSON',
                'prix_base': 25,
                'variantes': [
                    ('Random (25 cl)',   0,   25),
                    ('Babali (50 cl)',   25,  50),
                    ('Baradjii (1 L)',   75,  100),
                ],
                'options': [],
            },
            # ── Autres produits de base ───────────────────────────────
            {
                'nom': 'Coca-Cola',
                'description': 'Soda Coca-Cola bien frais.',
                'categorie': 'BOISSON',
                'prix_base': 500,
                'variantes': [
                    ('33 cl',  0,   500),
                    ('50 cl',  0,   500),
                    ('1.5 L',  500, 1000),
                ],
                'options': [],
            },
            {
                'nom': 'Croissant',
                'description': 'Croissant pur beurre, nature ou au chocolat.',
                'categorie': 'PATISSERIE',
                'prix_base': 400,
                'variantes': [
                    ('Nature',       0,   400),
                    ('Au chocolat',  100, 500),
                ],
                'options': [],
            },
        ]

        created_products = 0
        for data in produits_data:
            prod, created = Produit.objects.get_or_create(
                nom=data['nom'],
                defaults={
                    'description': data['description'],
                    'categorie': data['categorie'],
                    'prix_base': data['prix_base'],
                    'est_actif': True,
                    'cree_par': admin,
                }
            )
            if created:
                created_products += 1

            # Variantes
            for var_nom, ajust, prix_final in data['variantes']:
                Variante.objects.get_or_create(
                    produit=prod,
                    nom=var_nom,
                    defaults={'ajustement_prix': ajust, 'est_actif': True}
                )

            # Options
            for opt_nom, opt_prix in data['options']:
                Option.objects.get_or_create(
                    produit=prod,
                    nom=opt_nom,
                    defaults={'prix': opt_prix, 'est_actif': True}
                )

            self.stdout.write(f'   🥪  {prod.nom} — {len(data["variantes"])} variantes, {len(data["options"])} options')

        self.stdout.write(self.style.SUCCESS(
            f'\n✅  Seed terminé : {created_products} nouveaux produits, {Salle.objects.count()} salles'
        ))

        # ─── ETUDIANTS ─────────────────────────────────────────────────
        prenoms = [
            'Hamidou', 'Oumarou', 'Fatoumata', 'Amidou', 'Rasmané',
            'Bintou', 'Issa', 'Mariam', 'Sébastien', 'Paule',
            'Abdoul', 'Aminata', 'Boureima', 'Clémence', 'Drissa',
            'Estelle', 'Fati', 'Grégoire', 'Hawa', 'Ibrahim',
            'Joëlle', 'Karim', 'Lamine', 'Madeleine', 'Noufou',
            'Odile', 'Pascal', 'Rakia', 'Seydou', 'Tounwendé',
            'Urbain', 'Victoire', 'Wendyam', 'Xavier', 'Yasmine',
            'Zacharie', 'Adama', 'Béatrice', 'Célestin', 'Daouda',
        ]
        noms = [
            'Traoré', 'Ouédraogo', 'Sawadogo', 'Compaoré', 'Zongo',
            'Koné', 'Coulibaly', 'Diallo', 'Kaboré', 'Nikiéma',
            'Tapsoba', 'Belem', 'Yago', 'Sidibé', 'Barry',
            'Bambara', 'Sorgho', 'Kiema', 'Gansonré', 'Guira',
        ]

        created_etudiants = 0
        annees = ['2022', '2023', '2024', '2025']
        import random

        for i, prenom in enumerate(prenoms):
            nom = noms[i % len(noms)]
            annee = annees[i % len(annees)]
            matricule = f'{annee}-ISIG-{str(i + 1).zfill(4)}'
            email = f'{prenom.lower().replace("é","e").replace("è","e").replace("ê","e").replace("ô","o").replace("û","u")}.{nom.lower().replace("é","e").replace("è","e")}@isig.bf'

            etudiant, created = Utilisateur.objects.get_or_create(
                matricule=matricule,
                defaults={
                    'email': email,
                    'nom': nom,
                    'prenom': prenom,
                    'telephone': f'7{str(random.randint(0, 9))}{str(random.randint(10000000, 99999999))}',
                    'role': 'ETUDIANT',
                    'est_actif': True,
                }
            )
            if created:
                etudiant.set_password('etudiant123')
                etudiant.save(update_fields=['password'])
                created_etudiants += 1

        self.stdout.write(self.style.SUCCESS(
            f'👨‍🎓  {created_etudiants} étudiants créés ({Utilisateur.objects.filter(role="ETUDIANT").count()} total)'
        ))
