from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


# ─────────────────── Université ───────────────────
class Universite(models.Model):
    """
    Représente une université partenaire de la plateforme.
    Chaque utilisateur est rattaché à une université.
    """
    nom = models.CharField('Nom', max_length=200)
    code = models.CharField('Code', max_length=20, unique=True)
    adresse = models.TextField('Adresse', null=True, blank=True)
    ville = models.CharField('Ville', max_length=100, null=True, blank=True)
    est_actif = models.BooleanField('Active', default=True)
    date_creation = models.DateTimeField('Date création', auto_now_add=True)

    class Meta:
        verbose_name = 'Université'
        verbose_name_plural = 'Universités'
        ordering = ['nom']

    def __str__(self):
        return f"{self.nom} ({self.code})"


# ─────────────────── Secteurs et Salles ───────────────────
class Secteur(models.Model):
    """
    Représente un secteur géographique (ex: ISIG, Campus, etc.)
    Un secteur peut avoir plusieurs chefs de secteur.
    """

    universite = models.ForeignKey(
        Universite,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='secteurs',
        verbose_name='Université',
    )
    nom = models.CharField('Nom du secteur', max_length=100)
    code = models.CharField('Code secteur', max_length=20, unique=True)  # ISIG, CAMPUS, etc.
    description = models.TextField('Description', null=True, blank=True)

    chefs = models.ManyToManyField(
        'authentification.Utilisateur',
        blank=True,
        related_name='secteurs_supervises',
        limit_choices_to={'role': 'CHEF_SECTEUR', 'est_actif': True},
        verbose_name='Chefs de secteur',
    )
    
    # Adresse et localisation
    adresse = models.TextField('Adresse', null=True, blank=True)
    latitude = models.DecimalField('Latitude', max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField('Longitude', max_digits=9, decimal_places=6, null=True, blank=True)
    
    est_actif = models.BooleanField('Secteur actif', default=True, db_index=True)
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)
    
    class Meta:
        verbose_name = 'Secteur'
        verbose_name_plural = 'Secteurs'
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['est_actif']),
        ]
        ordering = ['nom']
    
    def __str__(self):
        return f"{self.nom} ({self.code})"
    
    @property
    def nombre_salles_actives(self):
        return self.salles.filter(est_actif=True).count()
    
    @property
    def total_commandes_aujourdhui(self):
        from apps.commandes.models import Commande
        today = timezone.now().date()
        return Commande.objects.filter(
            secteur=self,
            date_creation__date=today
        ).count()


class Salle(models.Model):
    """
    Représente une salle de classe ou un espace dans un secteur.
    Chaque salle a 2 livreurs assignés.
    """
    
    secteur = models.ForeignKey(
        Secteur, 
        on_delete=models.CASCADE, 
        related_name='salles'
    )
    nom = models.CharField('Nom de la salle', max_length=100)
    code = models.CharField('Code salle', max_length=20, unique=True)
    capacite = models.PositiveIntegerField('Capacité', null=True, blank=True)
    
    # 2 livreurs par salle
    livreur_1 = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salle_livreur1',
        limit_choices_to={'role': 'LIVREUR', 'est_actif': True}
    )
    livreur_2 = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salle_livreur2',
        limit_choices_to={'role': 'LIVREUR', 'est_actif': True}
    )
    
    # Informations supplémentaires
    etage = models.CharField('Étage', max_length=50, null=True, blank=True)
    batiment = models.CharField('Bâtiment', max_length=100, null=True, blank=True)
    
    est_actif = models.BooleanField('Salle active', default=True, db_index=True)
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)
    
    class Meta:
        verbose_name = 'Salle'
        verbose_name_plural = 'Salles'
        unique_together = ['secteur', 'nom']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['secteur', 'est_actif']),
        ]
        ordering = ['secteur__nom', 'nom']
    
    def __str__(self):
        return f"{self.nom} - {self.secteur.code}"
    
    @property
    def livreurs_actifs(self):
        livreurs = []
        if self.livreur_1 and self.livreur_1.est_actif:
            livreurs.append(self.livreur_1)
        if self.livreur_2 and self.livreur_2.est_actif:
            livreurs.append(self.livreur_2)
        return livreurs
    
    @property
    def a_livreurs_complets(self):
        return self.livreur_1 is not None and self.livreur_2 is not None


# ─────────────────── Catalogue Produits ───────────────────
class Produit(models.Model):
    """
    Produit de base (ex: Sandwich, Boisson, etc.)
    """
    
    CATEGORIE_CHOIX = [
        ('SANDWICH', 'Sandwich'),
        ('BOISSON', 'Boisson'),
        ('PATISSERIE', 'Pâtisserie'),
        ('SNACK', 'Snack'),
        ('AUTRE', 'Autre'),
    ]
    
    nom = models.CharField('Nom du produit', max_length=200, db_index=True)
    description = models.TextField('Description', blank=True, default='')
    categorie = models.CharField(
        'Catégorie', 
        max_length=20, 
        choices=CATEGORIE_CHOIX, 
        default='AUTRE',
        db_index=True
    )
    prix_base = models.DecimalField(
        'Prix de base', 
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)]
    )
    
    # Image
    image = models.ImageField(
        'Image du produit', 
        upload_to='produits/', 
        null=True, 
        blank=True
    )
    
    # Disponibilité
    est_actif = models.BooleanField('Produit actif', default=True, db_index=True)
    stock_limite = models.BooleanField('Stock limité', default=False)
    quantite_stock = models.PositiveIntegerField(
        'Quantité en stock', 
        null=True, 
        blank=True,
        help_text="Renseigner si stock limité"
    )
    
    # Métadonnées
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)
    cree_par = models.ForeignKey(
        'authentification.Utilisateur', 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='produits_crees'
    )
    
    class Meta:
        verbose_name = 'Produit'
        verbose_name_plural = 'Produits'
        indexes = [
            models.Index(fields=['nom']),
            models.Index(fields=['categorie']),
            models.Index(fields=['est_actif']),
        ]
        ordering = ['categorie', 'nom']
    
    def __str__(self):
        return f"{self.nom} - {self.prix_base} FCFA"
    
    @property
    def en_stock(self):
        """Vérifie si le produit est disponible en stock"""
        if not self.stock_limite:
            return True
        return self.quantite_stock and self.quantite_stock > 0
    
    def diminuer_stock(self, quantite):
        """Diminue le stock si limité"""
        if self.stock_limite and self.quantite_stock:
            self.quantite_stock -= quantite
            self.save(update_fields=['quantite_stock'])


class Variante(models.Model):
    """
    Variante d'un produit (ex: Petit, Grand, Moyen)
    """
    
    produit = models.ForeignKey(
        Produit, 
        on_delete=models.CASCADE, 
        related_name='variantes'
    )
    nom = models.CharField(
        'Nom de la variante', 
        max_length=100, 
        help_text="Ex: Petit, Grand, Moyen"
    )
    ajustement_prix = models.DecimalField(
        'Ajustement prix', 
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Prix additionnel par rapport au prix de base"
    )
    est_actif = models.BooleanField('Variante active', default=True)
    
    class Meta:
        verbose_name = 'Variante'
        verbose_name_plural = 'Variantes'
        unique_together = ['produit', 'nom']
        ordering = ['produit', 'nom']
    
    def __str__(self):
        return f"{self.produit.nom} - {self.nom}"
    
    @property
    def prix_total(self):
        """Prix du produit avec la variante"""
        return self.produit.prix_base + self.ajustement_prix


class Option(models.Model):
    """
    Option personnalisable d'un produit (ex: Piment, Mayonnaise, Fromage)
    Peut être gratuite ou payante.
    """
    
    produit = models.ForeignKey(
        Produit, 
        on_delete=models.CASCADE, 
        related_name='options'
    )
    nom = models.CharField(
        'Nom de l\'option', 
        max_length=100, 
        help_text="Ex: Piment, Mayonnaise, Fromage"
    )
    prix = models.DecimalField(
        'Prix additionnel', 
        max_digits=10, 
        decimal_places=2, 
        default=0
    )
    est_actif = models.BooleanField('Option active', default=True)
    
    class Meta:
        verbose_name = 'Option'
        verbose_name_plural = 'Options'
        unique_together = ['produit', 'nom']
        ordering = ['produit', 'nom']
    
    def __str__(self):
        if self.prix > 0:
            return f"{self.nom} (+{self.prix} FCFA)"
        return f"{self.nom} (gratuit)"


# ─────────────────── Horaires et Sessions ───────────────────
class HoraireCommande(models.Model):
    """
    Définit les horaires pendant lesquels les commandes sont possibles
    pour un secteur donné.
    """
    
    JOUR_SEMAINE = [
        (1, 'Lundi'),
        (2, 'Mardi'),
        (3, 'Mercredi'),
        (4, 'Jeudi'),
        (5, 'Vendredi'),
        (6, 'Samedi'),
        (7, 'Dimanche'),
    ]
    
    secteur = models.ForeignKey(
        Secteur, 
        on_delete=models.CASCADE, 
        related_name='horaires'
    )
    jour_semaine = models.PositiveSmallIntegerField(
        'Jour de la semaine', 
        choices=JOUR_SEMAINE
    )
    heure_debut = models.TimeField('Heure de début')
    heure_fin = models.TimeField('Heure de fin')
    est_actif = models.BooleanField('Horaire actif', default=True)
    
    # Limite de commandes par créneau (optionnel)
    limite_commandes = models.PositiveIntegerField(
        'Limite de commandes', 
        null=True, 
        blank=True,
        help_text="Nombre max de commandes pour ce créneau"
    )
    
    class Meta:
        verbose_name = 'Horaire de commande'
        verbose_name_plural = 'Horaires de commande'
        unique_together = ['secteur', 'jour_semaine']
        ordering = ['secteur', 'jour_semaine', 'heure_debut']
    
    def __str__(self):
        return f"{self.secteur.nom} - {self.get_jour_semaine_display()} {self.heure_debut.strftime('%H:%M')}-{self.heure_fin.strftime('%H:%M')}"
    
    def est_ouvert(self, date=None):
        """Vérifie si le créneau est ouvert à une date donnée"""
        if date is None:
            date = timezone.now()

        jour_actuel = date.isoweekday()
        heure_actuelle = date.time()

        return (self.est_actif and
                self.jour_semaine == jour_actuel and
                self.heure_debut <= heure_actuelle <= self.heure_fin)


# ─────────────────── Configuration Tarifaire ───────────────────
class Configuration(models.Model):
    """
    Configuration tarifaire globale (singleton pk=1).
    Frais de livraison + frais de paiement par opérateur.
    """

    # Taux de frais de service appliqué sur le sous-total produits (en %)
    taux_service = models.DecimalField(
        'Taux de frais de service (%)',
        max_digits=5, decimal_places=2, default=10,
        help_text="Pourcentage appliqué sur le sous-total produits (ex: 10 = 10%)"
    )

    # Horaires d'ouverture globaux
    commandes_actives = models.BooleanField(
        'Commandes actives',
        default=True,
        help_text="Désactiver pour bloquer toutes les commandes (maintenance, fermeture exceptionnelle)"
    )
    heure_ouverture = models.TimeField(
        'Heure d\'ouverture',
        null=True, blank=True,
        help_text="Heure à partir de laquelle les commandes sont acceptées (ex: 07:00)"
    )
    heure_fermeture = models.TimeField(
        'Heure de fermeture',
        null=True, blank=True,
        help_text="Heure à partir de laquelle les commandes sont bloquées (ex: 17:00)"
    )
    horaires_actifs = models.BooleanField(
        'Horaires actifs',
        default=True,
        help_text="Décochez pour ignorer les horaires d'ouverture sans les supprimer"
    )

    # Numéros admin pour recevoir les settlements Senfenico
    numero_orange = models.CharField(
        'Numéro Orange Money', max_length=20, blank=True, default='',
        help_text="Numéro Orange Money configuré dans le dashboard Senfenico"
    )
    numero_moov = models.CharField(
        'Numéro Moov Money', max_length=20, blank=True, default='',
        help_text="Numéro Moov Money configuré dans le dashboard Senfenico"
    )
    numero_sank = models.CharField(
        'Numéro Sank Money', max_length=20, blank=True, default='',
        help_text="Numéro Sank Money configuré dans le dashboard Senfenico"
    )

    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = 'Configuration tarifaire'
        verbose_name_plural = 'Configuration tarifaire'

    def __str__(self):
        return 'Configuration tarifaire'

    @classmethod
    def get_active(cls):
        """Retourne la configuration active (singleton pk=1)."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def commandes_sont_ouvertes(self):
        """Retourne (bool, message) selon les horaires et le flag commandes_actives."""
        if not self.commandes_actives:
            return False, "Les commandes sont temporairement désactivées."
        if self.horaires_actifs:
            now = timezone.localtime(timezone.now())
            jour = now.weekday()  # 0=Lundi, 6=Dimanche
            heure_actuelle = now.time()

            horaire = self.horaires_semaine.filter(jour=jour).first()
            if horaire:
                if not horaire.actif:
                    return False, "Les commandes sont fermées aujourd'hui."
                if horaire.heure_ouverture and horaire.heure_fermeture:
                    if not (horaire.heure_ouverture <= heure_actuelle <= horaire.heure_fermeture):
                        return False, (
                            f"Les commandes sont acceptées entre "
                            f"{horaire.heure_ouverture.strftime('%H:%M')} et "
                            f"{horaire.heure_fermeture.strftime('%H:%M')}."
                        )
            elif self.heure_ouverture and self.heure_fermeture:
                if not (self.heure_ouverture <= heure_actuelle <= self.heure_fermeture):
                    return False, (
                        f"Les commandes sont acceptées entre "
                        f"{self.heure_ouverture.strftime('%H:%M')} et "
                        f"{self.heure_fermeture.strftime('%H:%M')}."
                    )
        return True, ""

    def calculer_frais(self, total_ht, methode_paiement=None):
        """
        Calcule les frais de service pour une commande.
        Retourne (frais_service, total_ttc) en Decimal.
        """
        from decimal import Decimal, ROUND_HALF_UP

        total_ht = Decimal(str(total_ht))
        taux = Decimal(str(self.taux_service))

        frais_service = (total_ht * taux / Decimal('100')).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )
        total_ttc = total_ht + frais_service
        return frais_service, total_ttc


# ─────────────────── Horaires hebdomadaires ───────────────────
class HoraireSemaine(models.Model):
    JOURS = [
        (0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'), (3, 'Jeudi'),
        (4, 'Vendredi'), (5, 'Samedi'), (6, 'Dimanche'),
    ]
    configuration = models.ForeignKey(
        Configuration,
        related_name='horaires_semaine',
        on_delete=models.CASCADE,
    )
    jour = models.IntegerField('Jour', choices=JOURS)
    actif = models.BooleanField('Ouvert', default=True)
    heure_ouverture = models.TimeField("Heure d'ouverture", null=True, blank=True)
    heure_fermeture = models.TimeField('Heure de fermeture', null=True, blank=True)

    class Meta:
        verbose_name = 'Horaire hebdomadaire'
        verbose_name_plural = 'Horaires hebdomadaires'
        ordering = ['jour']
        unique_together = [('configuration', 'jour')]


# ─────────────────── Settlements ───────────────────
class SettlementRecord(models.Model):
    """
    Historique local des settlements déclenchés vers les comptes admin.
    Synchronisé avec Senfenico via la reference.
    """

    STATUT_CHOIX = [
        ('processing', 'En cours'),
        ('in_transit', 'En transit'),
        ('success', 'Réussi'),
        ('cancelled', 'Annulé'),
        ('failed', 'Échoué'),
    ]

    COMPTE_CHOIX = [
        ('orange', 'Orange Money'),
        ('moov', 'Moov Money'),
        ('sank', 'Sank Money'),
    ]

    reference_senfenico = models.CharField(
        'Référence Senfenico', max_length=100, unique=True
    )
    montant = models.DecimalField('Montant', max_digits=12, decimal_places=2)
    compte = models.CharField('Compte destinataire', max_length=10, choices=COMPTE_CHOIX)
    statut = models.CharField('Statut', max_length=20, choices=STATUT_CHOIX, default='processing')
    note = models.TextField('Note', blank=True, default='')
    declenche_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL, null=True,
        related_name='settlements_declenchés'
    )
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = 'Settlement'
        verbose_name_plural = 'Settlements'
        ordering = ['-date_creation']

    def __str__(self):
        return f"Settlement {self.reference_senfenico} — {self.montant} FCFA ({self.statut})"


# ─────────────────── Profil Vendeur ───────────────────
class ProfilVendeur(models.Model):
    """
    Profil boutique d'un vendeur (intérieur ou extérieur).
    Créé lors de l'inscription, activé après validation admin.
    """

    MODE_LIVRAISON = [
        ('SOI_MEME', 'Livre soi-même'),
        ('LIVREUR', 'Fait appel à un livreur'),
    ]

    utilisateur = models.OneToOneField(
        'authentification.Utilisateur',
        on_delete=models.CASCADE,
        related_name='profil_vendeur',
        verbose_name='Utilisateur',
    )
    universite = models.ForeignKey(
        Universite,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='vendeurs',
        verbose_name='Université desservie',
    )
    nom_boutique = models.CharField('Nom de la boutique', max_length=200)
    description = models.TextField('Description', blank=True, default='')
    categorie_principale = models.CharField(
        'Catégorie principale',
        max_length=20,
        choices=Produit.CATEGORIE_CHOIX,
        default='AUTRE',
    )
    emplacement = models.ForeignKey(
        Secteur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendeurs',
        verbose_name='Emplacement (secteur/zone)',
    )
    mode_livraison = models.CharField(
        'Mode de livraison',
        max_length=10,
        choices=MODE_LIVRAISON,
        default='LIVREUR',
    )
    capacite_max_commandes = models.PositiveIntegerField(
        'Capacité max commandes simultanées',
        default=20,
    )

    # KYC
    photo_cnib = models.ImageField('Photo CNIB', upload_to='kyc/vendeurs/cnib/', null=True, blank=True)
    photo_visage = models.ImageField('Photo visage', upload_to='kyc/vendeurs/visage/', null=True, blank=True)

    # Vendeur extérieur uniquement
    adresse_commerce = models.TextField('Adresse du commerce', null=True, blank=True)
    horaires_disponibilite = models.JSONField(
        'Horaires de disponibilité',
        default=dict,
        blank=True,
        help_text='Ex: {"lundi": {"ouverture": "08:00", "fermeture": "18:00"}}',
    )

    # Validation
    est_valide = models.BooleanField('Compte validé', default=False)
    valide_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendeurs_valides',
    )
    date_validation = models.DateTimeField('Date de validation', null=True, blank=True)
    motif_rejet = models.TextField('Motif de rejet', null=True, blank=True)

    est_actif = models.BooleanField('Boutique active', default=True)
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = 'Profil vendeur'
        verbose_name_plural = 'Profils vendeurs'
        ordering = ['nom_boutique']

    def __str__(self):
        return f"{self.nom_boutique} ({self.utilisateur.get_full_name()})"

    def valider(self, admin):
        self.est_valide = True
        self.valide_par = admin
        self.date_validation = timezone.now()
        self.motif_rejet = None
        self.save(update_fields=['est_valide', 'valide_par', 'date_validation', 'motif_rejet'])

    def rejeter(self, admin, motif):
        self.est_valide = False
        self.valide_par = admin
        self.date_validation = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['est_valide', 'valide_par', 'date_validation', 'motif_rejet'])


# ─────────────────── Profil Livreur ───────────────────
class ProfilLivreur(models.Model):
    """
    Profil d'un livreur étudiant.
    Actif uniquement après validation admin (photo CNIB + visage vérifiées).
    """

    utilisateur = models.OneToOneField(
        'authentification.Utilisateur',
        on_delete=models.CASCADE,
        related_name='profil_livreur',
        verbose_name='Utilisateur',
    )
    universite = models.ForeignKey(
        Universite,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='livreurs',
        verbose_name='Université',
    )

    # KYC obligatoire
    photo_cnib = models.ImageField('Photo CNIB', upload_to='kyc/livreurs/cnib/', null=True, blank=True)
    photo_visage = models.ImageField('Photo visage', upload_to='kyc/livreurs/visage/', null=True, blank=True)

    # Zones de livraison choisies par le livreur
    zones_livraison = models.ManyToManyField(
        Secteur,
        blank=True,
        related_name='livreurs_zones',
        verbose_name='Zones de livraison',
    )

    capacite_max_livraisons = models.PositiveIntegerField(
        'Capacité max livraisons simultanées',
        default=5,
    )

    # Validation
    est_valide = models.BooleanField('Compte validé', default=False)
    valide_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='livreurs_valides',
    )
    date_validation = models.DateTimeField('Date de validation', null=True, blank=True)
    motif_rejet = models.TextField('Motif de rejet', null=True, blank=True)

    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = 'Profil livreur'
        verbose_name_plural = 'Profils livreurs'

    def __str__(self):
        statut = 'validé' if self.est_valide else 'en attente'
        return f"Livreur {self.utilisateur.get_full_name()} ({statut})"

    def valider(self, admin):
        self.est_valide = True
        self.valide_par = admin
        self.date_validation = timezone.now()
        self.motif_rejet = None
        self.save(update_fields=['est_valide', 'valide_par', 'date_validation', 'motif_rejet'])

    def rejeter(self, admin, motif):
        self.est_valide = False
        self.valide_par = admin
        self.date_validation = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['est_valide', 'valide_par', 'date_validation', 'motif_rejet'])