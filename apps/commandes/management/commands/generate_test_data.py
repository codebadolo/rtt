from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta
import random
import string
from decimal import Decimal

from apps.authentification.models import Utilisateur, VerificationKYC
from apps.administration.models import Secteur, Salle, Produit, Variante, Option, HoraireCommande
from apps.commandes.models import Commande, LigneCommande, OptionLigneCommande, HistoriqueCommande

class Command(BaseCommand):
    help = 'Génère des données de test pour l\'application'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Supprime les données existantes avant de générer',
        )
        parser.add_argument(
            '--users',
            type=int,
            default=50,
            help='Nombre d\'utilisateurs à créer (défaut: 50)',
        )
        parser.add_argument(
            '--orders',
            type=int,
            default=200,
            help='Nombre de commandes à créer (défaut: 200)',
        )

    def handle(self, *args, **options):
        force = options['force']
        nb_users = options['users']
        nb_orders = options['orders']

        if force:
            self.stdout.write(self.style.WARNING('Suppression des données existantes...'))
            self.clean_database()

        self.stdout.write(self.style.SUCCESS('🚀 Début de la génération des données de test...'))

        # Créer les données dans l'ordre
        self.create_users(nb_users)
        self.create_secteurs_et_salles()
        self.create_produits()
        self.create_commandes(nb_orders)
        self.create_horaires()

        self.stdout.write(self.style.SUCCESS('✅ Génération terminée avec succès!'))

    def clean_database(self):
        """Supprime toutes les données existantes"""
        OptionLigneCommande.objects.all().delete()
        LigneCommande.objects.all().delete()
        HistoriqueCommande.objects.all().delete()
        Commande.objects.all().delete()
        Option.objects.all().delete()
        Variante.objects.all().delete()
        Produit.objects.all().delete()
        HoraireCommande.objects.all().delete()
        Salle.objects.all().delete()
        Secteur.objects.all().delete()
        VerificationKYC.objects.all().delete()
        Utilisateur.objects.exclude(is_superuser=True).delete()

    def create_users(self, nb_users):
        """Crée des utilisateurs de test"""
        self.stdout.write('📝 Création des utilisateurs...')

        # Créer un super admin
        if not Utilisateur.objects.filter(email='admin@ritoto.com').exists():
            admin = Utilisateur.objects.create_superuser(
                email='admin@ritoto.com',
                password='admin123',
                nom='Admin',
                prenom='Super',
                telephone='97000001',
                role='ADMIN',
                statut_kyc='VALIDE'
            )
            self.stdout.write(f'  ✅ Super admin créé: admin@ritoto.com / admin123')

        # Liste de noms et prénoms réalistes
        noms = ['Koffi', 'Konan', 'Kouadio', 'N\'Guessan', 'Yao', 'Kouassi', 'Amani', 'Brou', 'Kra', 'Ahoussi']
        prenoms = ['Jean', 'Marie', 'Paul', 'Pierre', 'François', 'Anne', 'Sophie', 'David', 'Emmanuel', 'Catherine']
        
        roles = ['ETUDIANT'] * 80 + ['CHEF_SECTEUR'] * 5 + ['LIVREUR'] * 10 + ['ADMIN'] * 5
        statuts_kyc = ['VALIDE', 'EN_ATTENTE', 'REJETE', 'NON_SOUMIS']

        for i in range(nb_users):
            email = f"user{i+1}@test.com"
            if Utilisateur.objects.filter(email=email).exists():
                continue

            role = random.choice(roles)
            statut_kyc = random.choice(statuts_kyc) if role == 'ETUDIANT' else 'VALIDE'
            
            user = Utilisateur.objects.create_user(
                email=email,
                password='password123',
                nom=random.choice(noms),
                prenom=random.choice(prenoms),
                telephone=f"07{random.randint(10000000, 99999999)}",
                role=role,
                statut_kyc=statut_kyc,
                est_actif=random.choice([True, True, True, False]),  # 75% actifs
                date_inscription=timezone.now() - timedelta(days=random.randint(1, 180)),
            )

            # Créer des KYC pour les étudiants
            if role == 'ETUDIANT' and statut_kyc != 'NON_SOUMIS':
                VerificationKYC.objects.create(
                    utilisateur=user,
                    numero_carte=f"CARTE{random.randint(10000, 99999)}",
                    date_expiration=timezone.now().date() + timedelta(days=random.randint(30, 365)),
                    image_carte_recto='kyc/test/recto.jpg',
                    image_carte_verso='kyc/test/verso.jpg',
                )

            if i % 10 == 0:
                self.stdout.write(f'  ... {i}/{nb_users} utilisateurs créés')

        self.stdout.write(self.style.SUCCESS(f'  ✅ {nb_users} utilisateurs créés'))

    def create_secteurs_et_salles(self):
        """Crée des secteurs et des salles"""
        self.stdout.write('🏫 Création des secteurs et salles...')

        secteurs_data = [
            {'nom': 'ISIG', 'code': 'ISIG', 'description': 'Institut Supérieur d\'Informatique et de Gestion'},
            {'nom': 'Campus Universitaire', 'code': 'CAMPUS', 'description': 'Campus principal'},
            {'nom': 'École d\'Ingénieurs', 'code': 'INGE', 'description': 'École des métiers d\'ingénieur'},
            {'nom': 'Faculté des Sciences', 'code': 'SCIENCES', 'description': 'Faculté des sciences fondamentales'},
            {'nom': 'Faculté de Médecine', 'code': 'MEDECINE', 'description': 'Faculté des sciences médicales'},
        ]

        livreurs = list(Utilisateur.objects.filter(role='LIVREUR'))
        chefs = list(Utilisateur.objects.filter(role='CHEF_SECTEUR'))

        for i, data in enumerate(secteurs_data):
            secteur = Secteur.objects.create(
                nom=data['nom'],
                code=data['code'],
                description=data['description'],
                est_actif=True,
                chef_actif=chefs[i] if i < len(chefs) else None
            )

            # Créer des salles pour chaque secteur (10-20 salles)
            nb_salles = random.randint(10, 20)
            for j in range(nb_salles):
                Salle.objects.create(
                    secteur=secteur,
                    nom=f"Salle {j+101}",
                    code=f"{data['code']}{j+101}",
                    capacite=random.randint(20, 100),
                    livreur_1=random.choice(livreurs) if livreurs else None,
                    livreur_2=random.choice(livreurs) if livreurs else None,
                    batiment=random.choice(['A', 'B', 'C', 'D']),
                    etage=str(random.randint(0, 4)),
                    est_actif=random.choice([True, True, True, False]),
                )

            self.stdout.write(f'  ✅ Secteur {data["nom"]} créé avec {nb_salles} salles')

    def create_produits(self):
        """Crée des produits, variantes et options"""
        self.stdout.write('🍽️ Création des produits...')

        produits_data = [
            {
                'nom': 'Sandwich Poulet',
                'description': 'Délicieux sandwich au poulet grillé',
                'categorie': 'SANDWICH',
                'prix_base': 1500,
                'variantes': [
                    {'nom': 'Petit', 'ajustement_prix': 0},
                    {'nom': 'Moyen', 'ajustement_prix': 500},
                    {'nom': 'Grand', 'ajustement_prix': 1000},
                ],
                'options': [
                    {'nom': 'Mayonnaise', 'prix': 100},
                    {'nom': 'Ketchup', 'prix': 100},
                    {'nom': 'Piment', 'prix': 50},
                    {'nom': 'Fromage', 'prix': 200},
                ]
            },
            {
                'nom': 'Sandwich Thon',
                'description': 'Sandwich au thon et légumes frais',
                'categorie': 'SANDWICH',
                'prix_base': 1300,
                'variantes': [
                    {'nom': 'Petit', 'ajustement_prix': 0},
                    {'nom': 'Moyen', 'ajustement_prix': 400},
                    {'nom': 'Grand', 'ajustement_prix': 800},
                ],
                'options': [
                    {'nom': 'Mayonnaise', 'prix': 100},
                    {'nom': 'Salade', 'prix': 50},
                    {'nom': 'Tomate', 'prix': 50},
                ]
            },
            {
                'nom': 'Coca-Cola',
                'description': 'Boisson gazeuse',
                'categorie': 'BOISSON',
                'prix_base': 500,
                'variantes': [
                    {'nom': '33cl', 'ajustement_prix': 0},
                    {'nom': '50cl', 'ajustement_prix': 300},
                    {'nom': '1.5L', 'ajustement_prix': 700},
                ],
                'options': []
            },
            {
                'nom': 'Jus d\'Orange',
                'description': 'Jus d\'orange frais pressé',
                'categorie': 'BOISSON',
                'prix_base': 800,
                'variantes': [
                    {'nom': '25cl', 'ajustement_prix': 0},
                    {'nom': '50cl', 'ajustement_prix': 400},
                ],
                'options': []
            },
            {
                'nom': 'Croissant',
                'description': 'Croissant au beurre',
                'categorie': 'PATISSERIE',
                'prix_base': 400,
                'variantes': [
                    {'nom': 'Nature', 'ajustement_prix': 0},
                    {'nom': 'Au chocolat', 'ajustement_prix': 150},
                ],
                'options': []
            },
            {
                'nom': 'Pain au chocolat',
                'description': 'Pain au chocolat traditionnel',
                'categorie': 'PATISSERIE',
                'prix_base': 450,
                'variantes': [],
                'options': []
            },
            {
                'nom': 'Chips',
                'description': 'Chips de pommes de terre',
                'categorie': 'SNACK',
                'prix_base': 300,
                'variantes': [
                    {'nom': 'Petit paquet', 'ajustement_prix': 0},
                    {'nom': 'Grand paquet', 'ajustement_prix': 300},
                ],
                'options': [
                    {'nom': 'Nature', 'prix': 0},
                    {'nom': 'Barbecue', 'prix': 50},
                    {'nom': 'Fromage', 'prix': 50},
                ]
            },
        ]

        admin = Utilisateur.objects.filter(role='ADMIN').first()

        for data in produits_data:
            produit = Produit.objects.create(
                nom=data['nom'],
                description=data['description'],
                categorie=data['categorie'],
                prix_base=data['prix_base'],
                est_actif=True,
                stock_limite=random.choice([True, False]),
                quantite_stock=random.randint(10, 100) if random.choice([True, False]) else None,
                cree_par=admin
            )

            # Créer les variantes
            for var_data in data['variantes']:
                Variante.objects.create(
                    produit=produit,
                    nom=var_data['nom'],
                    ajustement_prix=var_data['ajustement_prix'],
                    est_actif=True
                )

            # Créer les options
            for opt_data in data['options']:
                Option.objects.create(
                    produit=produit,
                    nom=opt_data['nom'],
                    prix=opt_data['prix'],
                    est_actif=True
                )

            self.stdout.write(f'  ✅ Produit créé: {data["nom"]}')

    def create_commandes(self, nb_orders):
        """Crée des commandes de test"""
        self.stdout.write('📦 Création des commandes...')

        etudiants = list(Utilisateur.objects.filter(role='ETUDIANT', est_actif=True))
        salles = list(Salle.objects.filter(est_actif=True))
        produits = list(Produit.objects.filter(est_actif=True))
        
        statuts = ['EN_ATTENTE', 'VALIDEE', 'PREPARATION', 'PRETE', 'DISTRIBUEE', 'REJETEE']
        methodes_paiement = ['ORANGE', 'MOOV', 'SANK']

        for i in range(nb_orders):
            if not etudiants or not salles:
                break

            etudiant = random.choice(etudiants)
            salle = random.choice(salles)
            statut = random.choice(statuts)
            date_creation = timezone.now() - timedelta(days=random.randint(0, 60), 
                                                       hours=random.randint(0, 23),
                                                       minutes=random.randint(0, 59))

            commande = Commande.objects.create(
                etudiant=etudiant,
                secteur=salle.secteur,
                salle=salle,
                statut=statut,
                methode_paiement=random.choice(methodes_paiement),
                telephone_paiement=f"07{random.randint(10000000, 99999999)}",
                description_besoin=random.choice(['', 'Sans oignon', 'Bien cuit', 'Urgent']),
                date_creation=date_creation
            )

            # Ajouter des articles (1-5 par commande)
            total = 0
            for j in range(random.randint(1, 5)):
                produit = random.choice(produits)
                quantite = random.randint(1, 3)
                
                # Choisir une variante aléatoire
                variantes = list(produit.variantes.filter(est_actif=True))
                variante = random.choice(variantes) if variantes else None
                
                prix_unitaire = produit.prix_base
                if variante:
                    prix_unitaire += variante.ajustement_prix

                ligne = LigneCommande.objects.create(
                    commande=commande,
                    produit=produit,
                    variante=variante,
                    quantite=quantite,
                    prix_unitaire=prix_unitaire,
                    sous_total=quantite * prix_unitaire
                )

                # Ajouter des options aléatoires
                options = list(produit.options.filter(est_actif=True))
                if options and random.choice([True, False]):
                    nb_options = random.randint(1, min(3, len(options)))
                    for opt in random.sample(options, nb_options):
                        OptionLigneCommande.objects.create(
                            ligne_commande=ligne,
                            option=opt,
                            prix_applique=opt.prix
                        )
                        prix_unitaire += opt.prix

                total += ligne.sous_total

            # Mettre à jour le total
            commande.total_ht = total
            commande.total_ttc = total
            commande.save()

            # Créer l'historique
            HistoriqueCommande.objects.create(
                commande=commande,
                ancien_statut=None,
                nouveau_statut=statut,
                commentaire='Commande créée',
                date_modification=date_creation
            )

            if statut in ['VALIDEE', 'REJETEE', 'PREPARATION', 'PRETE', 'DISTRIBUEE']:
                # Ajouter une étape de validation
                validateurs = list(Utilisateur.objects.filter(role='CHEF_SECTEUR'))
                if validateurs:
                    date_validation = date_creation + timedelta(minutes=random.randint(5, 120))
                    commande.valide_par = random.choice(validateurs)
                    commande.date_validation = date_validation
                    commande.save()

                    HistoriqueCommande.objects.create(
                        commande=commande,
                        ancien_statut='EN_ATTENTE',
                        nouveau_statut=statut if statut in ['VALIDEE', 'REJETEE'] else 'VALIDEE',
                        modifie_par=commande.valide_par,
                        commentaire='Commande validée' if statut != 'REJETEE' else 'Commande rejetée',
                        date_modification=date_validation
                    )

            if statut in ['PREPARATION', 'PRETE', 'DISTRIBUEE']:
                date_preparation = commande.date_validation + timedelta(minutes=random.randint(10, 60))
                HistoriqueCommande.objects.create(
                    commande=commande,
                    ancien_statut='VALIDEE',
                    nouveau_statut='PREPARATION',
                    commentaire='En préparation',
                    date_modification=date_preparation
                )

            if statut in ['PRETE', 'DISTRIBUEE']:
                date_prete = (commande.date_validation if commande.date_validation else date_creation) + timedelta(minutes=random.randint(30, 180))
                HistoriqueCommande.objects.create(
                    commande=commande,
                    ancien_statut='PREPARATION',
                    nouveau_statut='PRETE',
                    commentaire='Commande prête',
                    date_modification=date_prete
                )

            if statut == 'DISTRIBUEE':
                livreurs = [salle.livreur_1, salle.livreur_2]
                livreur = random.choice([l for l in livreurs if l])
                date_distribution = (commande.date_validation if commande.date_validation else date_creation) + timedelta(minutes=random.randint(60, 300))
                
                commande.distribue_par = livreur
                commande.date_distribution = date_distribution
                commande.save()

                HistoriqueCommande.objects.create(
                    commande=commande,
                    ancien_statut='PRETE',
                    nouveau_statut='DISTRIBUEE',
                    modifie_par=livreur,
                    commentaire='Commande distribuée',
                    date_modification=date_distribution
                )

            if i % 20 == 0:
                self.stdout.write(f'  ... {i}/{nb_orders} commandes créées')

        self.stdout.write(self.style.SUCCESS(f'  ✅ {nb_orders} commandes créées'))

    def create_horaires(self):
        """Crée des horaires de commande"""
        self.stdout.write('⏰ Création des horaires...')

        secteurs = Secteur.objects.all()

        for secteur in secteurs:
            for jour in range(1, 6):  # Lundi à Vendredi
                HoraireCommande.objects.create(
                    secteur=secteur,
                    jour_semaine=jour,
                    heure_debut='08:00:00',
                    heure_fin='17:00:00',
                    est_actif=True,
                    limite_commandes=random.randint(50, 200)
                )

            # Horaires réduits le samedi
            HoraireCommande.objects.create(
                secteur=secteur,
                jour_semaine=6,
                heure_debut='09:00:00',
                heure_fin='13:00:00',
                est_actif=random.choice([True, False]),
                limite_commandes=random.randint(20, 50)
            )

        self.stdout.write(self.style.SUCCESS(f'  ✅ Horaires créés pour {secteurs.count()} secteurs'))
