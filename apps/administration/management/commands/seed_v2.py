"""
Management command: seed_v2
Seed complet pour tester la version 2 de Ritôtô Campus.

Crée :
  - 6 universités burkinabè
  - Secteurs + salles par université
  - 1 super admin + admins universitaires
  - Étudiants, livreurs (avec ProfilLivreur), vendeurs (avec ProfilVendeur)
  - Produits, variantes, options
  - Commandes de test dans différents états

Usage:
  python manage.py seed_v2
  python manage.py seed_v2 --reset     # repart de zéro
  python manage.py seed_v2 --univ ULB  # seed uniquement pour une université
"""

import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.administration.models import (
    Universite, Secteur, Salle, Produit, Variante, Option,
    ProfilVendeur, ProfilLivreur, Configuration, HoraireSemaine,
)
from apps.authentification.models import Utilisateur
from apps.commandes.models import (
    Commande, LigneCommande, StatutCommande, WalletVendeur,
)


# ─── Données de référence ──────────────────────────────────────────────────

UNIVERSITES = [
    {'code': 'ULB',  'nom': 'Université Libre du Burkina',             'ville': 'Ouagadougou'},
    {'code': 'USTA', 'nom': "Université Saint Thomas d'Aquin",          'ville': 'Ouagadougou'},
    {'code': 'UO3S', 'nom': 'Université Ouaga 3S',                      'ville': 'Ouagadougou'},
    {'code': 'UA',   'nom': "Université de l'Unité Africaine",           'ville': 'Ouagadougou'},
    {'code': 'UCAO', 'nom': "Université Catholique de l'Afrique de l'Ouest", 'ville': 'Ouagadougou'},
    {'code': 'UAN',  'nom': 'Université Aube Nouvelle',                 'ville': 'Bobo-Dioulasso'},
]

PRENOMS_BF = [
    'Hamidou', 'Oumarou', 'Fatoumata', 'Amidou', 'Rasmané',
    'Bintou', 'Issa', 'Mariam', 'Boureima', 'Clémence',
    'Abdoul', 'Aminata', 'Drissa', 'Estelle', 'Fati',
    'Grégoire', 'Hawa', 'Ibrahim', 'Joëlle', 'Karim',
    'Lamine', 'Madeleine', 'Noufou', 'Odile', 'Pascal',
    'Rakia', 'Seydou', 'Tounwendé', 'Adama', 'Béatrice',
    'Wendyam', 'Yasmine', 'Zacharie', 'Daouda', 'Angèle',
]

NOMS_BF = [
    'Traoré', 'Ouédraogo', 'Sawadogo', 'Compaoré', 'Zongo',
    'Koné', 'Coulibaly', 'Diallo', 'Kaboré', 'Nikiéma',
    'Tapsoba', 'Belem', 'Yago', 'Sidibé', 'Barry',
    'Bambara', 'Sorgho', 'Kiema', 'Gansonré', 'Guira',
]

FILIERES = [
    'Informatique', 'Gestion', 'Droit', 'Médecine', 'Commerce',
    'Comptabilité', 'Marketing', 'Génie Civil', 'Électronique', 'Lettres',
]

NIVEAUX = ['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2']

NOMS_BOUTIQUES = [
    'Chez Mama Fatou', 'Le Coin du Campus', 'Fast Food Étudiant',
    'Saveurs du Burkina', 'Snack Express', 'La Bonne Assiette',
    'Le Grillardin', 'Délices Campus', 'Point Chaud', 'Le Resto U',
]

PRODUITS_SEED = [
    {
        'nom': 'Pain Brochettes',
        'description': 'Pain garni de brochettes grillées.',
        'categorie': 'SANDWICH', 'prix_base': 200,
        'variantes': [('Quart', 0), ('Demie', 150), ('3/4', 300), ('Entier', 300)],
        'options': [('Crudité', 0), ('Ketchup', 0), ('Mayonnaise', 0), ('Piment', 0)],
    },
    {
        'nom': 'Pain Saucisse',
        'description': 'Pain garni de saucisse.',
        'categorie': 'SANDWICH', 'prix_base': 700,
        'variantes': [('Demie', 0), ('3/4', 100)],
        'options': [('Ketchup', 0), ('Mayonnaise', 0), ('Moutarde', 0)],
    },
    {
        'nom': 'Riz sauce',
        'description': 'Riz blanc avec sauce arachide, tomate ou gombo.',
        'categorie': 'SNACK', 'prix_base': 500,
        'variantes': [('Petite portion', 0), ('Grande portion', 250)],
        'options': [('Poulet', 200), ('Poisson', 150), ('Œuf', 100)],
    },
    {
        'nom': 'Haricots / Soumbala',
        'description': 'Haricots traditionnels burkinabè.',
        'categorie': 'SNACK', 'prix_base': 300,
        'variantes': [('Normal', 0), ('Spécial', 200)],
        'options': [('Huile piment', 0), ('Soumbala extra', 50)],
    },
    {
        'nom': 'Eau en bouteille',
        'description': 'Eau fraîche.',
        'categorie': 'BOISSON', 'prix_base': 25,
        'variantes': [('25 cl', 0), ('50 cl', 25), ('1 L', 75)],
        'options': [],
    },
    {
        'nom': 'Jus de bissap',
        'description': 'Jus naturel de bissap bien frais.',
        'categorie': 'BOISSON', 'prix_base': 200,
        'variantes': [('Petit', 0), ('Grand', 100)],
        'options': [],
    },
    {
        'nom': 'Coca-Cola',
        'description': 'Soda Coca-Cola.',
        'categorie': 'BOISSON', 'prix_base': 500,
        'variantes': [('33 cl', 0), ('50 cl', 0), ('1.5 L', 500)],
        'options': [],
    },
    {
        'nom': 'Croissant',
        'description': 'Croissant nature ou chocolat.',
        'categorie': 'PATISSERIE', 'prix_base': 400,
        'variantes': [('Nature', 0), ('Chocolat', 100)],
        'options': [],
    },
    {
        'nom': 'Beignets',
        'description': 'Beignets chauds.',
        'categorie': 'SNACK', 'prix_base': 50,
        'variantes': [('x5', 0), ('x10', 50), ('x20', 150)],
        'options': [('Avec sirop', 50), ('Avec miel', 100)],
    },
]


def slug(s):
    """Simplifie un string pour en faire un email-safe."""
    table = str.maketrans('éèêëàâùûüîïôœç', 'eeeea a uuuiiooc')
    return s.lower().translate(table).replace(' ', '.').replace("'", '')


class Command(BaseCommand):
    help = 'Seed complet V2 — universités, utilisateurs, produits, commandes de test'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Tout supprimer avant de recréer')
        parser.add_argument('--univ', type=str, default=None, help='Code université (ex: ULB). Seed uniquement celle-ci.')

    @transaction.atomic
    def handle(self, *args, **options):
        self.reset = options['reset']
        self.filtre_univ = options['univ']

        if self.reset:
            self._reset()

        self._log('\n╔══════════════════════════════════════╗')
        self._log('║   SEED V2 — Ritôtô Campus            ║')
        self._log('╚══════════════════════════════════════╝\n')

        # Ordre important : universités d'abord
        super_admin = self._seed_super_admin()
        self._seed_configuration()
        universites = self._seed_universites()
        self._seed_produits(super_admin)

        for univ in universites:
            if self.filtre_univ and univ.code != self.filtre_univ:
                continue
            self._seed_pour_universite(univ, super_admin)

        self._log('\n' + self.style.SUCCESS('✅  Seed V2 terminé avec succès !'))
        self._resume()

    # ─── Reset ──────────────────────────────────────────────────────────────

    def _reset(self):
        self._log(self.style.WARNING('\n⚠️  Reset : suppression des données de test...\n'))
        from apps.commandes.models import LigneCommande, HistoriqueCommande, Plainte, WalletVendeur, TransactionWallet
        TransactionWallet.objects.all().delete()
        WalletVendeur.objects.all().delete()
        LigneCommande.objects.all().delete()
        HistoriqueCommande.objects.all().delete()
        Commande.objects.all().delete()
        Plainte.objects.all().delete()
        ProfilVendeur.objects.all().delete()
        ProfilLivreur.objects.all().delete()
        Salle.objects.all().delete()
        Secteur.objects.all().delete()
        Variante.objects.all().delete()
        Option.objects.all().delete()
        Produit.objects.all().delete()
        Utilisateur.objects.filter(is_superuser=False).delete()
        Universite.objects.all().delete()
        self._log(self.style.WARNING('   Données supprimées.\n'))

    # ─── Super Admin ────────────────────────────────────────────────────────

    def _seed_super_admin(self):
        admin, created = Utilisateur.objects.get_or_create(
            email='admin@ritoto.bf',
            defaults={
                'nom': 'Admin', 'prenom': 'Super',
                'telephone': '70000000', 'role': 'ADMIN',
                'is_staff': True, 'is_superuser': True, 'est_actif': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save(update_fields=['password'])
        self._log(f'👑  Super Admin : admin@ritoto.bf / admin123')
        return admin

    # ─── Configuration ──────────────────────────────────────────────────────

    def _seed_configuration(self):
        config, _ = Configuration.objects.get_or_create(pk=1, defaults={
            'taux_service': 10,
            'commandes_actives': True,
            'horaires_actifs': False,
        })
        for jour in range(7):
            HoraireSemaine.objects.get_or_create(
                configuration=config, jour=jour,
                defaults={'actif': jour < 6, 'heure_ouverture': '07:00', 'heure_fermeture': '18:00'}
            )
        self._log('⚙️   Configuration créée (taux service 10%)')

    # ─── Universités ────────────────────────────────────────────────────────

    def _seed_universites(self):
        self._log('\n🏛️  UNIVERSITÉS\n' + '─' * 40)
        result = []
        for data in UNIVERSITES:
            univ, created = Universite.objects.get_or_create(
                code=data['code'],
                defaults={'nom': data['nom'], 'ville': data['ville'], 'est_actif': True}
            )
            tag = '✚' if created else '·'
            self._log(f'  {tag} [{univ.code}] {univ.nom} — {univ.ville}')
            result.append(univ)
        return result

    # ─── Produits ───────────────────────────────────────────────────────────

    def _seed_produits(self, admin):
        self._log('\n🥗  PRODUITS\n' + '─' * 40)
        for data in PRODUITS_SEED:
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
            for v_nom, v_ajust in data['variantes']:
                Variante.objects.get_or_create(produit=prod, nom=v_nom,
                    defaults={'ajustement_prix': v_ajust, 'est_actif': True})
            for o_nom, o_prix in data['options']:
                Option.objects.get_or_create(produit=prod, nom=o_nom,
                    defaults={'prix': o_prix, 'est_actif': True})
            tag = '✚' if created else '·'
            self._log(f'  {tag} {prod.nom} — {len(data["variantes"])} variantes')
        self._log(f'  → {Produit.objects.count()} produits total')

    # ─── Seed par université ─────────────────────────────────────────────────

    def _seed_pour_universite(self, univ, super_admin):
        self._log(f'\n🏫  [{univ.code}] {univ.nom}\n' + '─' * 40)

        admin_univ = self._seed_admin_universitaire(univ)
        secteurs = self._seed_secteurs(univ)
        livreurs = self._seed_livreurs(univ, admin_univ, secteurs)
        vendeurs = self._seed_vendeurs(univ, admin_univ, secteurs)
        etudiants = self._seed_etudiants(univ, count=8)
        self._seed_commandes(univ, etudiants, vendeurs, livreurs, secteurs)

    # ─── Admin universitaire ────────────────────────────────────────────────

    def _seed_admin_universitaire(self, univ):
        email = f'admin.{univ.code.lower()}@ritoto.bf'
        admin, created = Utilisateur.objects.get_or_create(
            email=email,
            defaults={
                'nom': 'Admin', 'prenom': univ.code,
                'telephone': f'7{random.randint(1000000, 9999999)}',
                'role': 'ADMIN_UNIVERSITAIRE',
                'universite': univ,
                'is_staff': True, 'est_actif': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save(update_fields=['password'])
        self._log(f'  👔 Admin : {email} / admin123')
        return admin

    # ─── Secteurs & Salles ──────────────────────────────────────────────────

    def _seed_secteurs(self, univ):
        secteurs_data = [
            {'code': f'{univ.code}-SEC1', 'nom': 'Secteur Amphis',        'desc': 'Amphithéâtres principaux'},
            {'code': f'{univ.code}-SEC2', 'nom': 'Secteur Salles de cours','desc': 'Salles pédagogiques'},
            {'code': f'{univ.code}-SEC3', 'nom': 'Secteur Laboratoires',   'desc': 'Labos et TP'},
        ]
        secteurs = []
        for sd in secteurs_data:
            sec, _ = Secteur.objects.get_or_create(
                code=sd['code'],
                defaults={'nom': sd['nom'], 'description': sd['desc'],
                          'universite': univ, 'est_actif': True}
            )
            secteurs.append(sec)

        # Salles pour chaque secteur
        for i, sec in enumerate(secteurs):
            nb_salles = [6, 10, 5][i]
            prefixes = [('AMPHI', 'Amphi'), ('SALLE', 'Salle'), ('LAB', 'Lab')][i]
            for j in range(1, nb_salles + 1):
                code_salle = f'{univ.code}-{prefixes[0]}-{j:02d}'
                Salle.objects.get_or_create(
                    code=code_salle,
                    defaults={
                        'secteur': sec,
                        'nom': f'{prefixes[1]} {j:02d}',
                        'batiment': f'Bâtiment {["A","B","C"][i]}',
                        'etage': 'RDC' if j <= 3 else f'Étage {(j-1)//3}',
                        'est_actif': True,
                    }
                )

        total_salles = Salle.objects.filter(secteur__universite=univ).count()
        self._log(f'  🗺️  {len(secteurs)} secteurs, {total_salles} salles')
        return secteurs

    # ─── Livreurs ───────────────────────────────────────────────────────────

    def _seed_livreurs(self, univ, admin_univ, secteurs, count=3):
        livreurs = []
        for i in range(count):
            prenom = random.choice(PRENOMS_BF)
            nom = random.choice(NOMS_BF)
            email = f'livreur{i+1}.{univ.code.lower()}@ritoto.bf'

            user, created = Utilisateur.objects.get_or_create(
                email=email,
                defaults={
                    'nom': nom, 'prenom': prenom,
                    'telephone': f'7{random.randint(1000000, 9999999)}',
                    'role': 'LIVREUR',
                    'universite': univ,
                    'est_actif': True,
                }
            )
            if created:
                user.set_password('livreur123')
                user.save(update_fields=['password'])

            profil, _ = ProfilLivreur.objects.get_or_create(
                utilisateur=user,
                defaults={
                    'universite': univ,
                    'capacite_max_livraisons': random.choice([3, 5, 7]),
                    'est_valide': True,
                    'valide_par': admin_univ,
                    'date_validation': timezone.now(),
                }
            )
            if secteurs:
                profil.zones_livraison.set(random.sample(secteurs, k=min(2, len(secteurs))))

            livreurs.append(user)

        self._log(f'  🛵 {count} livreurs — mot de passe : livreur123')
        return livreurs

    # ─── Vendeurs ───────────────────────────────────────────────────────────

    def _seed_vendeurs(self, univ, admin_univ, secteurs, count=2):
        vendeurs = []
        categories = ['SANDWICH', 'BOISSON', 'SNACK', 'PATISSERIE']
        for i in range(count):
            prenom = random.choice(PRENOMS_BF)
            nom = random.choice(NOMS_BF)
            role = 'VENDEUR_INTERIEUR' if i < count - 1 else 'VENDEUR_EXTERIEUR'
            email = f'vendeur{i+1}.{univ.code.lower()}@ritoto.bf'

            user, created = Utilisateur.objects.get_or_create(
                email=email,
                defaults={
                    'nom': nom, 'prenom': prenom,
                    'telephone': f'7{random.randint(1000000, 9999999)}',
                    'role': role,
                    'universite': univ,
                    'est_actif': True,
                }
            )
            if created:
                user.set_password('vendeur123')
                user.save(update_fields=['password'])

            emplacement = random.choice(secteurs) if secteurs else None
            ProfilVendeur.objects.get_or_create(
                utilisateur=user,
                defaults={
                    'universite': univ,
                    'nom_boutique': random.choice(NOMS_BOUTIQUES),
                    'description': 'Vente de repas et boissons frais pour les étudiants.',
                    'categorie_principale': random.choice(categories),
                    'emplacement': emplacement,
                    'mode_livraison': 'LIVREUR',
                    'capacite_max_commandes': random.choice([15, 20, 30]),
                    'est_valide': True,
                    'valide_par': admin_univ,
                    'date_validation': timezone.now(),
                    'est_actif': True,
                }
            )
            # Créer le wallet
            WalletVendeur.objects.get_or_create(
                vendeur=user,
                defaults={'solde': Decimal(str(random.randint(5000, 50000)))}
            )
            vendeurs.append(user)

        self._log(f'  🏪 {count} vendeurs — mot de passe : vendeur123')
        return vendeurs

    # ─── Étudiants ──────────────────────────────────────────────────────────

    def _seed_etudiants(self, univ, count=8):
        etudiants = []
        for i in range(count):
            prenom = PRENOMS_BF[i % len(PRENOMS_BF)]
            nom = NOMS_BF[i % len(NOMS_BF)]
            email = f'etudiant{i+1}.{univ.code.lower()}@ritoto.bf'

            user, created = Utilisateur.objects.get_or_create(
                email=email,
                defaults={
                    'nom': nom, 'prenom': prenom,
                    'telephone': f'7{random.randint(1000000, 9999999)}',
                    'role': 'ETUDIANT',
                    'universite': univ,
                    'filiere': random.choice(FILIERES),
                    'niveau_etude': random.choice(NIVEAUX),
                    'est_actif': True,
                }
            )
            if created:
                user.set_password('etudiant123')
                user.save(update_fields=['password'])
            etudiants.append(user)

        self._log(f'  👨‍🎓 {count} étudiants — mot de passe : etudiant123')
        return etudiants

    # ─── Commandes de test ──────────────────────────────────────────────────

    def _seed_commandes(self, univ, etudiants, vendeurs, livreurs, secteurs):
        if not etudiants or not secteurs:
            return

        produits = list(Produit.objects.filter(est_actif=True)[:5])
        if not produits:
            return

        salles = list(Salle.objects.filter(secteur__universite=univ, est_actif=True)[:10])
        if not salles:
            return

        scenarios = [
            # (statut, label)
            (StatutCommande.EN_ATTENTE,     'en attente'),
            (StatutCommande.EN_ATTENTE,     'en attente'),
            (StatutCommande.EN_PREPARATION, 'en préparation'),
            (StatutCommande.PRETE,          'prête'),
            (StatutCommande.EN_LIVRAISON,   'en livraison'),
            (StatutCommande.LIVREE,         'livrée'),
            (StatutCommande.REJETEE,        'rejetée'),
            (StatutCommande.ANNULEE,        'annulée'),
        ]

        methodes = ['ORANGE', 'MOOV', 'SANK']
        creees = 0

        for idx, (statut, label) in enumerate(scenarios):
            etudiant = etudiants[idx % len(etudiants)]
            salle = salles[idx % len(salles)]
            secteur = salle.secteur
            methode = methodes[idx % 3]

            # Éviter les doublons si on relance sans --reset
            if Commande.objects.filter(
                etudiant=etudiant, secteur=secteur,
                statut=statut, date_creation__date=timezone.now().date()
            ).exists():
                continue

            # Retry en cas de collision sur numero_commande (4 chiffres aléatoires)
            commande = None
            for _attempt in range(10):
                try:
                    commande = Commande.objects.create(
                        etudiant=etudiant,
                        secteur=secteur,
                        salle=salle,
                        statut=StatutCommande.EN_ATTENTE,
                        methode_paiement=methode,
                        telephone_paiement=etudiant.telephone,
                        heure_souhaitee=f'{random.randint(8,16):02d}:00',
                        description_besoin='Commande de test — seed V2' if idx % 3 == 0 else '',
                    )
                    break
                except Exception:
                    continue
            if commande is None:
                continue

            # Ajouter 1 ou 2 produits
            for produit in random.sample(produits, k=random.randint(1, 2)):
                variantes = list(produit.variantes.filter(est_actif=True))
                variante = random.choice(variantes) if variantes else None
                prix = float(variante.prix_total if variante else produit.prix_base)
                qte = random.randint(1, 3)
                LigneCommande.objects.create(
                    commande=commande,
                    produit=produit,
                    variante=variante,
                    quantite=qte,
                    prix_unitaire=prix,
                    sous_total=prix * qte,
                )

            commande.mettre_a_jour_total()

            # Pousser vers le statut cible
            if statut in (StatutCommande.EN_PREPARATION, StatutCommande.PRETE,
                          StatutCommande.EN_LIVRAISON, StatutCommande.LIVREE):
                commande.statut = StatutCommande.EN_PREPARATION
                commande.acceptee_par_vendeur = True
                commande.date_acceptation_vendeur = timezone.now()
                commande.save(update_fields=['statut', 'acceptee_par_vendeur', 'date_acceptation_vendeur'])

            if statut in (StatutCommande.PRETE, StatutCommande.EN_LIVRAISON, StatutCommande.LIVREE):
                commande.statut = StatutCommande.PRETE
                commande.save(update_fields=['statut'])

            if statut in (StatutCommande.EN_LIVRAISON, StatutCommande.LIVREE) and livreurs:
                livreur = random.choice(livreurs)
                commande.statut = StatutCommande.EN_LIVRAISON
                commande.livreur_assigne = livreur
                commande.date_acceptation_livreur = timezone.now()
                commande.save(update_fields=['statut', 'livreur_assigne', 'date_acceptation_livreur'])

            if statut == StatutCommande.LIVREE and livreurs:
                livreur = commande.livreur_assigne or random.choice(livreurs)
                commande.statut = StatutCommande.LIVREE
                commande.distribue_par = livreur
                commande.date_distribution = timezone.now()
                commande.save(update_fields=['statut', 'distribue_par', 'date_distribution'])
                WalletVendeur.crediter_livraison(commande)

            if statut == StatutCommande.REJETEE:
                commande.statut = StatutCommande.REJETEE
                commande.motif_rejet = 'Paiement non confirmé (test)'
                commande.save(update_fields=['statut', 'motif_rejet'])

            if statut == StatutCommande.ANNULEE:
                commande.statut = StatutCommande.ANNULEE
                commande.save(update_fields=['statut'])

            creees += 1

        self._log(f'  📦 {creees} commandes de test créées ({len(scenarios)} scénarios)')

    # ─── Résumé ─────────────────────────────────────────────────────────────

    def _resume(self):
        self._log('\n' + '═' * 44)
        self._log('  RÉSUMÉ BASE DE DONNÉES')
        self._log('═' * 44)
        self._log(f'  Universités  : {Universite.objects.count()}')
        self._log(f'  Secteurs     : {Secteur.objects.count()}')
        self._log(f'  Salles       : {Salle.objects.count()}')
        self._log(f'  Produits     : {Produit.objects.count()}')
        self._log(f'  Utilisateurs : {Utilisateur.objects.count()}')
        for role in ['ADMIN', 'ADMIN_UNIVERSITAIRE', 'VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR', 'LIVREUR', 'ETUDIANT']:
            count = Utilisateur.objects.filter(role=role).count()
            if count:
                self._log(f'    └─ {role:<22} {count}')
        self._log(f'  Commandes    : {Commande.objects.count()}')
        self._log('═' * 44)
        self._log('\n  COMPTES DE TEST')
        self._log('─' * 44)
        self._log('  admin@ritoto.bf            / admin123')
        for univ in UNIVERSITES:
            code = univ["code"].lower()
            self._log(f'\n  ── {univ["code"]} ──')
            self._log(f'  admin.{code}@ritoto.bf     / admin123')
            self._log(f'  vendeur1.{code}@ritoto.bf  / vendeur123')
            self._log(f'  vendeur2.{code}@ritoto.bf  / vendeur123')
            self._log(f'  livreur1.{code}@ritoto.bf  / livreur123')
            self._log(f'  etudiant1.{code}@ritoto.bf / etudiant123')
        self._log('═' * 44 + '\n')

    def _log(self, msg):
        self.stdout.write(msg)
