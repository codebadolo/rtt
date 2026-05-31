from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
import random
import string
import uuid
import json

# ─────────────────── Statuts de Commande ───────────────────
class StatutCommande(models.TextChoices):
    BROUILLON = 'BROUILLON', 'Brouillon'
    EN_ATTENTE = 'EN_ATTENTE', 'En attente'
    ACCEPTEE = 'ACCEPTEE', 'Acceptée par le vendeur'
    EN_PREPARATION = 'EN_PREPARATION', 'En préparation'
    PRETE = 'PRETE', 'Prête'
    EN_LIVRAISON = 'EN_LIVRAISON', 'En livraison'
    LIVREE = 'LIVREE', 'Livrée'
    # Statuts hérités conservés pour compatibilité production
    VALIDEE = 'VALIDEE', 'Validée - Paiement reçu'
    DISTRIBUEE = 'DISTRIBUEE', 'Distribuée'
    REJETEE = 'REJETEE', 'Rejetée'
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

    # Frais de service (10% du total_ht — calculé côté serveur)
    frais_service = models.DecimalField(
        'Frais de service',
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
        null=True,
        blank=True,
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
    
    # Acceptation par le vendeur
    acceptee_par_vendeur = models.BooleanField('Acceptée par vendeur', default=False)
    date_acceptation_vendeur = models.DateTimeField('Date acceptation vendeur', null=True, blank=True)

    # Mission livreur — système d'acceptation
    livreur_assigne = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='missions_acceptees',
        limit_choices_to={'role': 'LIVREUR'},
        verbose_name='Livreur assigné',
    )
    date_acceptation_livreur = models.DateTimeField('Date acceptation livreur', null=True, blank=True)

    # Distribution (conservé pour compatibilité production)
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
        Recalcule total_ht, frais_service et total_ttc
        depuis les lignes de commande et la configuration tarifaire active.
        """
        from apps.administration.models import Configuration

        nouveau_total_ht = self.calculer_total()
        config = Configuration.get_active()
        frais_service, total_ttc = config.calculer_frais(nouveau_total_ht)
        self.total_ht = nouveau_total_ht
        self.frais_service = frais_service
        self.total_ttc = total_ttc
        self.save(update_fields=['total_ht', 'frais_service', 'total_ttc'])
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

        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.EN_ATTENTE,
            nouveau_statut=StatutCommande.VALIDEE,
            modifie_par=validateurs,
            commentaire="Paiement validé"
        )

        QRCodeCommande.generer_pour_commande(self)

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)
    
    def rejeter(self, validateurs, motif):
        """
        Rejette la commande avec un motif
        """
        self.statut = StatutCommande.REJETEE
        self.valide_par = validateurs
        self.date_validation = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['statut', 'valide_par', 'date_validation', 'motif_rejet'])

        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.EN_ATTENTE,
            nouveau_statut=StatutCommande.REJETEE,
            modifie_par=validateurs,
            commentaire=f"Rejeté: {motif}"
        )

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)
    
    def accepter_vendeur(self, vendeur):
        """Le vendeur accepte la commande — passe en EN_PREPARATION."""
        self.statut = StatutCommande.EN_PREPARATION
        self.acceptee_par_vendeur = True
        self.date_acceptation_vendeur = timezone.now()
        self.save(update_fields=['statut', 'acceptee_par_vendeur', 'date_acceptation_vendeur'])
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.ACCEPTEE,
            nouveau_statut=StatutCommande.EN_PREPARATION,
            modifie_par=vendeur,
            commentaire='Commande prise en charge par le vendeur',
        )
        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)

    def accepter_mission_livreur(self, livreur):
        """Le livreur accepte la mission — la commande disparaît de la liste des autres."""
        if self.livreur_assigne_id:
            raise ValueError('Cette mission a déjà été acceptée par un autre livreur.')
        self.livreur_assigne = livreur
        self.date_acceptation_livreur = timezone.now()
        self.statut = StatutCommande.EN_LIVRAISON
        self.save(update_fields=['livreur_assigne', 'date_acceptation_livreur', 'statut'])
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.PRETE,
            nouveau_statut=StatutCommande.EN_LIVRAISON,
            modifie_par=livreur,
            commentaire='Mission acceptée par le livreur',
        )
        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)

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

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)
    
    def distribuer(self, livreur):
        """
        Marque la commande comme livrée (scan QR validé).
        Déclenche la distribution automatique des paiements au vendeur.
        """
        ancien_statut = self.statut
        self.statut = StatutCommande.LIVREE
        self.distribue_par = livreur
        self.date_distribution = timezone.now()
        self.save(update_fields=['statut', 'distribue_par', 'date_distribution'])

        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=ancien_statut,
            nouveau_statut=StatutCommande.LIVREE,
            modifie_par=livreur,
            commentaire='Commande livrée — QR code scanné',
        )

        # Distribution automatique vers le wallet du vendeur
        WalletVendeur.crediter_livraison(self)

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)
    
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


# ─────────────────── QR Code de Livraison ───────────────────
class QRCodeCommande(models.Model):
    """
    QR code unique généré après validation du paiement.
    Sert de preuve de livraison : le livreur scanne pour confirmer la distribution.
    """

    commande = models.OneToOneField(
        Commande, on_delete=models.CASCADE, related_name='qr_code'
    )
    token = models.UUIDField(
        'Token unique', default=uuid.uuid4, unique=True, editable=False, db_index=True
    )
    payload_offline = models.JSONField(
        'Données hors-ligne',
        default=dict,
        help_text="Résumé de la commande embarqué dans le QR pour le mode offline"
    )
    est_utilise = models.BooleanField('Utilisé', default=False, db_index=True)
    date_utilisation = models.DateTimeField('Date utilisation', null=True, blank=True)
    utilise_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='qr_codes_scannes',
        limit_choices_to={'role': 'LIVREUR'}
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'QR Code commande'
        verbose_name_plural = 'QR Codes commandes'

    def __str__(self):
        statut = 'utilisé' if self.est_utilise else 'valide'
        return f"QR-{self.commande.numero_commande} ({statut})"

    def generer_image_base64(self):
        """Génère l'image QR code en PNG base64 (data URL)."""
        import qrcode
        import io
        import base64

        content = json.dumps(
            {'v': 1, 't': str(self.token), **self.payload_offline},
            ensure_ascii=False,
            separators=(',', ':'),
        )
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(content)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f'data:image/png;base64,{b64}'

    @classmethod
    def generer_pour_commande(cls, commande):
        """Génère le QR code d'une commande (idempotent)."""
        try:
            return commande.qr_code
        except cls.DoesNotExist:
            pass

        items = []
        for ligne in commande.lignes.select_related('produit').prefetch_related('options__option').all():
            item = {'p': ligne.produit.nom, 'q': ligne.quantite}
            opts = [o.option.nom for o in ligne.options.all()]
            if opts:
                item['o'] = opts
            items.append(item)
        payload = {
            'id': commande.id,
            'n': commande.numero_commande,
            'e': commande.etudiant.get_full_name(),
            'salle': commande.salle.nom,
            'secteur': commande.secteur.nom,
            'items': items,
            'total': float(commande.total_ttc),
        }
        return cls.objects.create(commande=commande, payload_offline=payload)


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
# ─────────────────── Wallet Vendeur ───────────────────
class WalletVendeur(models.Model):
    """
    Solde disponible d'un vendeur.
    Crédité automatiquement après chaque livraison validée (déduction commission).
    """

    vendeur = models.OneToOneField(
        'authentification.Utilisateur',
        on_delete=models.CASCADE,
        related_name='wallet',
        verbose_name='Vendeur',
    )
    solde = models.DecimalField('Solde disponible (FCFA)', max_digits=14, decimal_places=2, default=0)
    total_encaisse = models.DecimalField('Total encaissé', max_digits=14, decimal_places=2, default=0)
    total_commissions = models.DecimalField('Total commissions prélevées', max_digits=14, decimal_places=2, default=0)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Wallet vendeur'
        verbose_name_plural = 'Wallets vendeurs'

    def __str__(self):
        return f"Wallet {self.vendeur.get_full_name()} — {self.solde} FCFA"

    @classmethod
    def crediter_livraison(cls, commande):
        """
        Crédite le vendeur après validation de la livraison.
        Déduit la commission Ritôtô Campus (frais_service) du montant versé.
        """
        from apps.administration.models import ProfilVendeur
        from decimal import Decimal

        # Identifier le vendeur de la commande via ProfilVendeur si disponible
        vendeur = None
        try:
            # Le secteur de la commande est lié au vendeur
            profils = ProfilVendeur.objects.filter(
                emplacement=commande.secteur, est_valide=True
            )
            if profils.exists():
                vendeur = profils.first().utilisateur
        except Exception:
            pass

        if vendeur is None:
            return

        montant_vendeur = commande.total_ht  # vendeur reçoit HT, Ritôtô garde les frais
        commission = commande.frais_service

        wallet, _ = cls.objects.get_or_create(vendeur=vendeur)
        wallet.solde += montant_vendeur
        wallet.total_encaisse += montant_vendeur
        wallet.total_commissions += commission
        wallet.save(update_fields=['solde', 'total_encaisse', 'total_commissions'])

        TransactionWallet.objects.create(
            wallet=wallet,
            type_transaction='CREDIT',
            montant=montant_vendeur,
            commission=commission,
            commande=commande,
            note=f'Livraison validée — commande {commande.numero_commande}',
        )


class TransactionWallet(models.Model):
    """
    Historique des mouvements de fonds du wallet vendeur.
    """

    TYPE_CHOICES = [
        ('CREDIT', 'Crédit (vente livrée)'),
        ('DEBIT', 'Débit (retrait)'),
        ('REMBOURSEMENT', 'Remboursement client'),
    ]

    wallet = models.ForeignKey(
        WalletVendeur,
        on_delete=models.CASCADE,
        related_name='transactions',
    )
    type_transaction = models.CharField('Type', max_length=15, choices=TYPE_CHOICES)
    montant = models.DecimalField('Montant (FCFA)', max_digits=12, decimal_places=2)
    commission = models.DecimalField('Commission Ritôtô', max_digits=10, decimal_places=2, default=0)
    commande = models.ForeignKey(
        'Commande',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions_wallet',
    )
    note = models.TextField('Note', blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transaction wallet'
        verbose_name_plural = 'Transactions wallet'
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.get_type_transaction_display()} — {self.montant} FCFA ({self.date_creation.strftime('%d/%m/%Y')})"


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