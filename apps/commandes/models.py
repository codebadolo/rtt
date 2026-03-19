from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
import random
import string

# ─────────────────── Statuts de Commande ───────────────────
class StatutCommande(models.TextChoices):
    BROUILLON = 'BROUILLON', 'Brouillon'
    EN_ATTENTE = 'EN_ATTENTE', 'En attente de validation'
    VALIDEE = 'VALIDEE', 'Validée - Paiement reçu'
    REJETEE = 'REJETEE', 'Rejetée'
    PRETE = 'PRETE', 'Prête pour distribution'
    DISTRIBUEE = 'DISTRIBUEE', 'Distribuée'
    ANNULEE = 'ANNULEE', 'Annulée'


# ─────────────────── Commande Principale ───────────────────
def generer_numero_commande():
    """
    Génère un numéro de commande unique format: ORD-YYYYMMDD-XXXX
    """
    today = timezone.now().strftime('%Y%m%d')
    random_part = ''.join(random.choices(string.digits, k=4))
    return f"ORD-{today}-{random_part}"

class Commande(models.Model):
    """
    Modèle principal d'une commande.
    Tous les montants sont calculés côté serveur pour garantir l'intégrité.
    """
    
    METHODE_PAIEMENT = [
        ('ORANGE', 'Orange Money'),
        ('MOOV', 'Moov Money'),
        ('SANK', 'Sank Money'),
    ]
    
    # Numéro unique de commande
    numero_commande = models.CharField(
        'Numéro commande', 
        max_length=20, 
        unique=True,
        default=generer_numero_commande,
        editable=False,
        db_index=True
    )
    
    # Relations
    etudiant = models.ForeignKey(
        'authentification.Utilisateur', 
        on_delete=models.PROTECT, 
        related_name='commandes_etudiant',
        limit_choices_to={'role': 'ETUDIANT'}
    )
    secteur = models.ForeignKey(
        'administration.Secteur', 
        on_delete=models.PROTECT, 
        related_name='commandes'
    )
    salle = models.ForeignKey(
        'administration.Salle', 
        on_delete=models.PROTECT, 
        related_name='commandes'
    )
    
    # Statut
    statut = models.CharField(
        'Statut', 
        max_length=20, 
        choices=StatutCommande.choices, 
        default=StatutCommande.BROUILLON,
        db_index=True
    )
    
    # Montants (calculés côté serveur - JAMAIS depuis le client)
    total_ht = models.DecimalField(
        'Total HT', 
        max_digits=12, 
        decimal_places=2, 
        default=0,
        editable=False
    )
    total_ttc = models.DecimalField(
        'Total TTC',
        max_digits=12,
        decimal_places=2,
        default=0,
        editable=False
    )

    # Détail des frais (calculés côté serveur)
    frais_livraison = models.DecimalField(
        'Frais de livraison',
        max_digits=10, decimal_places=2, default=0, editable=False
    )
    frais_paiement = models.DecimalField(
        'Frais de paiement',
        max_digits=10, decimal_places=2, default=0, editable=False
    )

    # Informations de la commande
    description_besoin = models.TextField(
        'Description du besoin', 
        null=True, 
        blank=True,
        help_text="Instructions spéciales pour la commande"
    )
    heure_souhaitee = models.TimeField(
        'Heure souhaitée',
        default='12:00:00'
    )
    
    # Paiement Mobile Money
    methode_paiement = models.CharField(
        'Méthode de paiement', 
        max_length=10, 
        choices=METHODE_PAIEMENT
    )
    telephone_paiement = models.CharField(
        'Téléphone de paiement', 
        max_length=20,
        help_text="Numéro utilisé pour le paiement"
    )
    reference_paiement = models.CharField(
        'Référence transaction', 
        max_length=100, 
        null=True, 
        blank=True,
        help_text="Référence de la transaction Mobile Money"
    )
    capture_paiement = models.ImageField(
        'Capture paiement', 
        upload_to='preuves_paiement/', 
        null=True, 
        blank=True,
        help_text="Capture d'écran de la transaction"
    )
    
    # Validation par le chef
    valide_par = models.ForeignKey(
        'authentification.Utilisateur', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='commandes_validees',
        limit_choices_to={'role__in': ['CHEF_SECTEUR', 'ADMIN']}
    )
    date_validation = models.DateTimeField(
        'Date de validation', 
        null=True, 
        blank=True
    )
    motif_rejet = models.TextField(
        'Motif du rejet', 
        null=True, 
        blank=True
    )
    
    # Distribution
    distribue_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commandes_distribuees',
        limit_choices_to={'role': 'LIVREUR'}
    )
    date_distribution = models.DateTimeField(
        'Date de distribution', 
        null=True, 
        blank=True
    )
    
    # Métadonnées
    date_creation = models.DateTimeField('Date de création', auto_now_add=True, db_index=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)
    ip_creation = models.GenericIPAddressField('IP de création', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Commande'
        verbose_name_plural = 'Commandes'
        indexes = [
            models.Index(fields=['numero_commande']),
            models.Index(fields=['statut']),
            models.Index(fields=['date_creation']),
            models.Index(fields=['etudiant', 'statut']),
            models.Index(fields=['secteur', 'statut']),
            models.Index(fields=['salle', 'statut']),
            models.Index(fields=['date_creation', 'secteur']),
        ]
        ordering = ['-date_creation']
    
    def __str__(self):
        return f"{self.numero_commande} - {self.etudiant.get_full_name()}"
    
    def save(self, *args, **kwargs):
        # Vérifier que la salle appartient bien au secteur
        if self.salle and self.secteur and self.salle.secteur_id != self.secteur_id:
            raise ValueError("La salle n'appartient pas au secteur spécifié")
        
        super().save(*args, **kwargs)
    
    def calculer_total(self):
        """
        Calcule le total de la commande depuis les lignes
        """
        total = self.lignes.aggregate(
            total=models.Sum('sous_total')
        )['total'] or Decimal('0')
        return total
    
    def mettre_a_jour_total(self):
        """
        Recalcule total_ht, frais_livraison, frais_paiement et total_ttc
        depuis les lignes de commande et la configuration tarifaire active.
        """
        from decimal import Decimal
        from apps.administration.models import Configuration

        nouveau_total_ht = self.calculer_total()
        config = Configuration.get_active()
        frais_livraison, frais_paiement, total_ttc = config.calculer_frais(
            nouveau_total_ht, self.methode_paiement
        )
        self.total_ht = nouveau_total_ht
        self.frais_livraison = frais_livraison
        self.frais_paiement = frais_paiement
        self.total_ttc = total_ttc
        self.save(update_fields=['total_ht', 'frais_livraison', 'frais_paiement', 'total_ttc'])
        return total_ttc
    
    def valider(self, validateurs, reference_paiement=None):
        """
        Valide la commande (paiement confirmé)
        """
        self.statut = StatutCommande.VALIDEE
        self.valide_par = validateurs
        self.date_validation = timezone.now()
        if reference_paiement:
            self.reference_paiement = reference_paiement
        self.save(update_fields=['statut', 'valide_par', 'date_validation', 'reference_paiement'])
        
        # Créer une entrée dans l'historique
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.EN_ATTENTE,
            nouveau_statut=StatutCommande.VALIDEE,
            modifie_par=validateurs,
            commentaire="Paiement validé"
        )
    
    def rejeter(self, validateurs, motif):
        """
        Rejette la commande avec un motif
        """
        self.statut = StatutCommande.REJETEE
        self.valide_par = validateurs
        self.date_validation = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['statut', 'valide_par', 'date_validation', 'motif_rejet'])
        
        # Créer une entrée dans l'historique
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.EN_ATTENTE,
            nouveau_statut=StatutCommande.REJETEE,
            modifie_par=validateurs,
            commentaire=f"Rejeté: {motif}"
        )
    
    def marquer_prete(self, livreur=None):
        """
        Marque la commande comme prête pour distribution
        """
        self.statut = StatutCommande.PRETE
        self.save(update_fields=['statut'])
        
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.VALIDEE,
            nouveau_statut=StatutCommande.PRETE,
            modifie_par=livreur,
            commentaire="Commande prête pour distribution"
        )
    
    def distribuer(self, livreur):
        """
        Marque la commande comme distribuée
        """
        self.statut = StatutCommande.DISTRIBUEE
        self.distribue_par = livreur
        self.date_distribution = timezone.now()
        self.save(update_fields=['statut', 'distribue_par', 'date_distribution'])
        
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.PRETE,
            nouveau_statut=StatutCommande.DISTRIBUEE,
            modifie_par=livreur,
            commentaire="Commande distribuée"
        )
    
    def annuler(self, utilisateur, motif):
        """
        Annule la commande
        """
        ancien_statut = self.statut
        self.statut = StatutCommande.ANNULEE
        self.save(update_fields=['statut'])
        
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=ancien_statut,
            nouveau_statut=StatutCommande.ANNULEE,
            modifie_par=utilisateur,
            commentaire=f"Annulé: {motif}"
        )


# ─────────────────── Lignes de Commande ───────────────────
class LigneCommande(models.Model):
    """
    Ligne détaillée d'une commande
    """
    
    commande = models.ForeignKey(
        Commande, 
        on_delete=models.CASCADE, 
        related_name='lignes'
    )
    produit = models.ForeignKey(
        'administration.Produit', 
        on_delete=models.PROTECT
    )
    variante = models.ForeignKey(
        'administration.Variante', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True
    )
    
    quantite = models.PositiveIntegerField(
        'Quantité', 
        validators=[MinValueValidator(1)]
    )
    prix_unitaire = models.DecimalField(
        'Prix unitaire', 
        max_digits=10, 
        decimal_places=2
    )
    sous_total = models.DecimalField(
        'Sous-total', 
        max_digits=12, 
        decimal_places=2,
        editable=False
    )
    
    class Meta:
        verbose_name = 'Ligne de commande'
        verbose_name_plural = 'Lignes de commande'
    
    def save(self, *args, **kwargs):
        # Calcul automatique du sous-total
        if not self.sous_total:
            self.sous_total = self.quantite * self.prix_unitaire
        super().save(*args, **kwargs)
        
        # Mettre à jour le total de la commande parente
        self.commande.mettre_a_jour_total()
    
    def __str__(self):
        return f"{self.quantite}x {self.produit.nom}"


class OptionLigneCommande(models.Model):
    """
    Options sélectionnées pour une ligne de commande
    """
    
    ligne_commande = models.ForeignKey(
        LigneCommande, 
        on_delete=models.CASCADE, 
        related_name='options'
    )
    option = models.ForeignKey(
        'administration.Option', 
        on_delete=models.PROTECT
    )
    prix_applique = models.DecimalField(
        'Prix appliqué', 
        max_digits=10, 
        decimal_places=2
    )
    
    class Meta:
        verbose_name = 'Option de ligne'
        verbose_name_plural = 'Options de ligne'
    
    def __str__(self):
        return f"{self.option.nom} - {self.prix_applique} FCFA"


# ─────────────────── Historique et Journalisation ───────────────────
class HistoriqueCommande(models.Model):
    """
    Historique des changements de statut d'une commande
    """
    
    commande = models.ForeignKey(
        Commande, 
        on_delete=models.CASCADE, 
        related_name='historique'
    )
    ancien_statut = models.CharField(
        'Ancien statut', 
        max_length=20, 
        choices=StatutCommande.choices, 
        null=True
    )
    nouveau_statut = models.CharField(
        'Nouveau statut', 
        max_length=20, 
        choices=StatutCommande.choices
    )
    modifie_par = models.ForeignKey(
        'authentification.Utilisateur', 
        on_delete=models.SET_NULL, 
        null=True
    )
    commentaire = models.TextField('Commentaire', null=True, blank=True)
    date_modification = models.DateTimeField('Date modification', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Historique commande'
        verbose_name_plural = 'Historiques commandes'
        ordering = ['-date_modification']
        indexes = [
            models.Index(fields=['commande', 'date_modification']),
        ]
    
    def __str__(self):
        return f"{self.commande.numero_commande} - {self.ancien_statut} → {self.nouveau_statut}"


# ─────────────────── Paiement Senfenico ───────────────────
class PaiementSenfenico(models.Model):
    """
    Suivi d'une charge Senfenico liée à une commande.
    """

    STATUT_CHOICES = [
        ('send_otp',   'En attente OTP'),
        ('pay_offline', 'Paiement hors ligne'),
        ('success',    'Succès'),
        ('failed',     'Échoué'),
        ('pending',    'En attente'),
    ]

    commande = models.OneToOneField(
        Commande,
        on_delete=models.CASCADE,
        related_name='paiement_senfenico',
    )
    charge_reference = models.CharField('Référence charge', max_length=100, unique=True)
    statut = models.CharField('Statut', max_length=20, choices=STATUT_CHOICES, default='pending')
    display_text = models.TextField('Texte affiché', blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Paiement Senfenico'
        verbose_name_plural = 'Paiements Senfenico'

    def __str__(self):
        return f"{self.charge_reference} ({self.statut})"


# ─────────────────── Clôture Journalière ───────────────────
class ClotureJournaliere(models.Model):
    """
    Clôture journalière des commandes par secteur
    Une fois clôturée, aucune modification n'est possible
    """
    
    secteur = models.ForeignKey(
        'administration.Secteur', 
        on_delete=models.PROTECT, 
        related_name='clotures'
    )
    date_cloture = models.DateField('Date de clôture', db_index=True)
    cloture_par = models.ForeignKey(
        'authentification.Utilisateur', 
        on_delete=models.PROTECT, 
        related_name='clotures_effectuees'
    )
    
    # Statistiques
    nombre_commandes = models.PositiveIntegerField('Nombre de commandes')
    montant_total = models.DecimalField('Montant total', max_digits=14, decimal_places=2)
    commandes_validees = models.PositiveIntegerField('Commandes validées', default=0)
    commandes_rejetees = models.PositiveIntegerField('Commandes rejetées', default=0)
    commandes_distribuees = models.PositiveIntegerField('Commandes distribuées', default=0)
    
    # Résumé JSON des commandes (pour archivage)
    resume_commandes = models.JSONField('Résumé des commandes', default=dict)
    
    # Métadonnées
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    est_verrouillee = models.BooleanField(
        'Clôture verrouillée', 
        default=True,
        help_text="Une fois verrouillée, aucune modification n'est possible"
    )
    
    class Meta:
        verbose_name = 'Clôture journalière'
        verbose_name_plural = 'Clôtures journalières'
        unique_together = ['secteur', 'date_cloture']
        indexes = [
            models.Index(fields=['date_cloture', 'secteur']),
        ]
        ordering = ['-date_cloture']
    
    def __str__(self):
        return f"Clôture {self.secteur.code} - {self.date_cloture}"


# ─────────────────── Plaintes ───────────────────
class Plainte(models.Model):
    CATEGORIE_CHOICES = [
        ('COMMANDE', 'Problème de commande'),
        ('LIVRAISON', 'Problème de livraison'),
        ('PAIEMENT', 'Problème de paiement'),
        ('PRODUIT', 'Problème de produit'),
        ('AUTRE', 'Autre'),
    ]
    STATUT_CHOICES = [
        ('EN_ATTENTE', 'En attente'),
        ('EN_COURS', 'En cours de traitement'),
        ('RESOLUE', 'Résolue'),
        ('REJETEE', 'Rejetée'),
    ]

    etudiant = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.CASCADE,
        related_name='plaintes',
        limit_choices_to={'role': 'ETUDIANT'}
    )
    commande = models.ForeignKey(
        Commande,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plaintes'
    )
    categorie = models.CharField('Catégorie', max_length=20, choices=CATEGORIE_CHOICES, default='AUTRE')
    sujet = models.CharField('Sujet', max_length=200)
    description = models.TextField('Description')
    statut = models.CharField('Statut', max_length=20, choices=STATUT_CHOICES, default='EN_ATTENTE')
    reponse_admin = models.TextField("Réponse de l'administration", null=True, blank=True)
    date_creation = models.DateTimeField('Date de création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = 'Plainte'
        verbose_name_plural = 'Plaintes'
        ordering = ['-date_creation']

    def __str__(self):
        return f"Plainte #{self.id} - {self.etudiant.get_full_name()} - {self.sujet}"
    
    @classmethod
    def effectuer_cloture(cls, secteur, utilisateur):
        """
        Effectue la clôture journalière pour un secteur
        """
        from django.db.models import Sum, Count, Q
        
        today = timezone.now().date()
        
        # Récupérer les commandes du jour
        commandes_jour = Commande.objects.filter(
            secteur=secteur,
            date_creation__date=today
        )
        
        # Calculer les statistiques
        stats = commandes_jour.aggregate(
            total=Sum('total_ttc'),
            count=Count('id'),
            validees=Count('id', filter=Q(statut='VALIDEE')),
            rejetees=Count('id', filter=Q(statut='REJETEE')),
            distribuees=Count('id', filter=Q(statut='DISTRIBUEE'))
        )
        
        # Créer la clôture
        cloture = cls.objects.create(
            secteur=secteur,
            date_cloture=today,
            cloture_par=utilisateur,
            nombre_commandes=stats['count'] or 0,
            montant_total=stats['total'] or 0,
            commandes_validees=stats['validees'] or 0,
            commandes_rejetees=stats['rejetees'] or 0,
            commandes_distribuees=stats['distribuees'] or 0,
            resume_commandes={
                'details': list(commandes_jour.values(
                    'numero_commande', 'statut', 'total_ttc'
                ))
            }
        )
        
        return cloture