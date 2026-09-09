from django.db import models, transaction
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


def generer_code_retrait():
    """
    Génère un code court alphanumérique (ex: 7K2P9A) pour le retrait chez le
    vendeur — écrit à la main sur l'étiquette, comparé visuellement, jamais
    scanné (§6.1).
    """
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(random.choices(alphabet, k=6))


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

    MODE_RECEPTION = [
        ('SUR_PLACE', 'Retrait sur place'),
        ('LIVRAISON', 'Livraison'),
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

    # Vendeur unique de la commande (§4.1 : un panier, un seul vendeur).
    # Nullable pour compat avec les commandes existantes non rattachées.
    vendeur = models.ForeignKey(
        'administration.ProfilVendeur',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='commandes',
        verbose_name='Vendeur',
    )

    # Mode de réception choisi par le client — toujours son choix (§4.2).
    mode_reception = models.CharField(
        'Mode de réception',
        max_length=10,
        choices=MODE_RECEPTION,
        default='LIVRAISON',
    )

    # Créneau fixe choisi par le client (§4.2 / §4.4).
    creneau = models.ForeignKey(
        'administration.CreneauLivraison',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commandes',
        verbose_name='Créneau',
    )

    # Code court affiché à l'acceptation vendeur, comparé visuellement au retrait (§6.1).
    code_retrait = models.CharField('Code de retrait', max_length=8, blank=True, default='')

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
        Valide la commande (paiement confirmé).
        Réserve le stock des produits et crédite le solde "en attente" du
        vendeur (§5.1, §14.3). En cas de rupture de stock détectée à cet
        instant (paiements simultanés sur le dernier exemplaire), la
        commande est automatiquement annulée et remboursée au lieu d'être
        validée.
        """
        from apps.administration.models import Produit

        with transaction.atomic():
            lignes = list(self.lignes.select_related('produit'))
            for ligne in lignes:
                produit = Produit.objects.select_for_update().get(pk=ligne.produit_id)
                if produit.stock_limite and (produit.quantite_stock or 0) < ligne.quantite:
                    Remboursement.declencher(
                        self, motif=f"Rupture de stock : {produit.nom}", automatique=True,
                    )
                    self.annuler(validateurs, f"Rupture de stock : {produit.nom}", force=True)
                    return
                produit.diminuer_stock(ligne.quantite)

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
            WalletVendeur.crediter_en_attente(self)

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
        """
        Le vendeur confirme la commande — passe en ACCEPTEE (§4.5).
        Génère le code de retrait court, comparé visuellement (pas scanné)
        par le livreur au moment de récupérer la commande (§6.1).
        """
        ancien_statut = self.statut
        self.statut = StatutCommande.ACCEPTEE
        self.acceptee_par_vendeur = True
        self.date_acceptation_vendeur = timezone.now()
        if not self.code_retrait:
            self.code_retrait = generer_code_retrait()
        self.save(update_fields=[
            'statut', 'acceptee_par_vendeur', 'date_acceptation_vendeur', 'code_retrait',
        ])
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=ancien_statut,
            nouveau_statut=StatutCommande.ACCEPTEE,
            modifie_par=vendeur,
            commentaire='Commande acceptée par le vendeur',
        )
        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)

    def demarrer_preparation(self, vendeur):
        """Le vendeur commence la préparation — passe en EN_PREPARATION (§4.5)."""
        self.statut = StatutCommande.EN_PREPARATION
        self.save(update_fields=['statut'])
        HistoriqueCommande.objects.create(
            commande=self,
            ancien_statut=StatutCommande.ACCEPTEE,
            nouveau_statut=StatutCommande.EN_PREPARATION,
            modifie_par=vendeur,
            commentaire='Préparation commencée',
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

        # Déblocage du solde "en attente" vers "disponible" (§5.1, §6.2)
        WalletVendeur.debloquer(self)

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)

    # Statuts après lesquels une préparation a déjà commencé — le vendeur a
    # engagé des ingrédients et du travail (§8). Annulation client bloquée.
    STATUTS_PREPARATION_ENGAGEE = (
        StatutCommande.EN_PREPARATION, StatutCommande.PRETE,
        StatutCommande.EN_LIVRAISON, StatutCommande.LIVREE,
    )

    def annuler(self, utilisateur, motif, force=False):
        """
        Annule la commande.
        - Avant EN_PREPARATION : le client peut annuler lui-même, 100% retenu
          côté plateforme (rien n'a été crédité au vendeur) → remboursement direct.
        - EN_PREPARATION / PRETE / EN_LIVRAISON : annulation automatique interdite,
          seul un administrateur peut forcer (force=True) une annulation exceptionnelle.
        - LIVREE : jamais d'annulation directe — c'est un litige (voir Plainte).
        (§5.2, §8)
        """
        if self.statut == StatutCommande.LIVREE:
            raise ValueError(
                "Une commande livrée ne peut pas être annulée directement — "
                "ouvrez un litige."
            )
        if self.statut in self.STATUTS_PREPARATION_ENGAGEE and not force:
            raise ValueError(
                "La préparation a déjà commencé : seul un administrateur peut "
                "forcer cette annulation."
            )

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

        # Restaurer le stock si déjà réservé (commande validée avant annulation)
        if ancien_statut != StatutCommande.EN_ATTENTE:
            from apps.administration.models import Produit
            for ligne in self.lignes.select_related('produit'):
                if ligne.produit.stock_limite:
                    Produit.objects.filter(pk=ligne.produit_id).update(
                        quantite_stock=models.F('quantite_stock') + ligne.quantite
                    )

        if not Remboursement.objects.filter(commande=self).exists():
            Remboursement.declencher(self, motif=motif, automatique=not force)

        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(self)


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
        # Un panier, un seul vendeur (§4.1) : toutes les lignes doivent
        # référencer des produits du même vendeur que la commande.
        vendeur_commande_id = self.commande.vendeur_id
        vendeur_produit_id = self.produit.vendeur_id
        if vendeur_commande_id and vendeur_produit_id and vendeur_commande_id != vendeur_produit_id:
            raise ValueError(
                "Ce produit appartient à un autre vendeur : une commande ne "
                "peut contenir que des produits d'un seul vendeur."
            )

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
    solde_en_attente = models.DecimalField(
        'Solde en attente (FCFA)', max_digits=14, decimal_places=2, default=0,
        help_text="Crédité au paiement, non retirable tant que la livraison n'est pas validée (§5.1)",
    )
    total_encaisse = models.DecimalField('Total encaissé', max_digits=14, decimal_places=2, default=0)
    total_commissions = models.DecimalField('Total commissions prélevées', max_digits=14, decimal_places=2, default=0)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Wallet vendeur'
        verbose_name_plural = 'Wallets vendeurs'

    def __str__(self):
        return f"Wallet {self.vendeur.get_full_name()} — {self.solde} FCFA (attente: {self.solde_en_attente})"

    @staticmethod
    def _resoudre_vendeur(commande):
        """Utilisateur-vendeur d'une commande, avec repli sur l'ancien mode
        (secteur) pour les commandes créées avant le rattachement direct."""
        if commande.vendeur_id:
            return commande.vendeur.utilisateur

        from apps.administration.models import ProfilVendeur
        profils = ProfilVendeur.objects.filter(emplacement=commande.secteur, est_valide=True)
        premier = profils.first()
        return premier.utilisateur if premier else None

    @classmethod
    def crediter_en_attente(cls, commande):
        """
        Crédite le solde "en attente" du vendeur dès le paiement confirmé.
        Le montant n'est pas retirable tant que le QR n'a pas été scanné (§5.1).
        """
        vendeur = cls._resoudre_vendeur(commande)
        if vendeur is None:
            return

        montant_vendeur = commande.total_ht  # vendeur reçoit HT, Ritôtô garde les frais
        commission = commande.frais_service

        wallet, _ = cls.objects.get_or_create(vendeur=vendeur)
        wallet.solde_en_attente += montant_vendeur
        wallet.total_encaisse += montant_vendeur
        wallet.total_commissions += commission
        wallet.save(update_fields=['solde_en_attente', 'total_encaisse', 'total_commissions'])

        TransactionWallet.objects.create(
            wallet=wallet,
            type_transaction='CREDIT_ATTENTE',
            montant=montant_vendeur,
            commission=commission,
            commande=commande,
            note=f'Paiement reçu (en attente) — commande {commande.numero_commande}',
        )

    @classmethod
    def debloquer(cls, commande):
        """
        Fait passer le montant de la commande de "en attente" à "disponible"
        au moment du scan QR / validation de livraison (§5.1, §6.2).
        """
        vendeur = cls._resoudre_vendeur(commande)
        if vendeur is None:
            return

        montant_vendeur = commande.total_ht

        wallet, _ = cls.objects.get_or_create(vendeur=vendeur)
        wallet.solde_en_attente = max(Decimal('0'), wallet.solde_en_attente - montant_vendeur)
        wallet.solde += montant_vendeur
        wallet.save(update_fields=['solde_en_attente', 'solde'])

        TransactionWallet.objects.create(
            wallet=wallet,
            type_transaction='CREDIT',
            montant=montant_vendeur,
            commande=commande,
            note=f'Livraison validée — solde débloqué — commande {commande.numero_commande}',
        )


class TransactionWallet(models.Model):
    """
    Historique des mouvements de fonds du wallet vendeur.
    """

    TYPE_CHOICES = [
        ('CREDIT_ATTENTE', 'Crédit en attente (paiement reçu)'),
        ('CREDIT', 'Crédit disponible (vente livrée)'),
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


# ─────────────────── Remboursements ───────────────────
class Remboursement(models.Model):
    """
    Suivi d'un remboursement client (§5.2, §8, §14.3).
    Aucune API de remboursement automatique confirmée côté agrégateur au
    moment de l'écriture (point de vigilance §5.2) : le remboursement est
    donc tracé ici et traité manuellement par un administrateur, qui le
    marque ensuite comme effectué.
    """

    STATUT_CHOICES = [
        ('EN_ATTENTE', 'En attente de traitement'),
        ('TRAITE', 'Remboursé'),
        ('ECHOUE', 'Échoué'),
    ]

    commande = models.ForeignKey(
        Commande,
        on_delete=models.CASCADE,
        related_name='remboursements',
    )
    montant = models.DecimalField('Montant (FCFA)', max_digits=12, decimal_places=2)
    motif = models.TextField('Motif', blank=True, default='')
    automatique = models.BooleanField(
        'Déclenché automatiquement', default=False,
        help_text="True : annulation avant préparation ou rupture de stock. False : décision admin.",
    )
    statut = models.CharField('Statut', max_length=15, choices=STATUT_CHOICES, default='EN_ATTENTE')
    traite_par = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='remboursements_traites',
    )
    date_creation = models.DateTimeField('Date de création', auto_now_add=True)
    date_traitement = models.DateTimeField('Date de traitement', null=True, blank=True)

    class Meta:
        verbose_name = 'Remboursement'
        verbose_name_plural = 'Remboursements'
        ordering = ['-date_creation']

    def __str__(self):
        return f"Remboursement {self.commande.numero_commande} — {self.montant} FCFA ({self.statut})"

    @classmethod
    def declencher(cls, commande, motif, automatique=True):
        """Crée l'enregistrement de remboursement pour une commande annulée."""
        return cls.objects.create(
            commande=commande,
            montant=commande.total_ttc,
            motif=motif,
            automatique=automatique,
        )

    def marquer_traite(self, admin):
        self.statut = 'TRAITE'
        self.traite_par = admin
        self.date_traitement = timezone.now()
        self.save(update_fields=['statut', 'traite_par', 'date_traitement'])


# ─────────────────── Notation ───────────────────
class NoteVendeur(models.Model):
    """
    Note du vendeur (1 à 5) déclenchée à la livraison (§10). Publique,
    affichée sur la fiche du vendeur.
    """

    commande = models.OneToOneField(
        Commande, on_delete=models.CASCADE, related_name='note_vendeur',
    )
    vendeur = models.ForeignKey(
        'administration.ProfilVendeur', on_delete=models.CASCADE, related_name='notes',
    )
    client = models.ForeignKey(
        'authentification.Utilisateur', on_delete=models.CASCADE, related_name='notes_vendeurs_donnees',
    )
    note = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    commentaire = models.TextField('Commentaire', blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Note vendeur'
        verbose_name_plural = 'Notes vendeurs'
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.vendeur.nom_boutique} — {self.note}/5"


class NoteLivreur(models.Model):
    """
    Note du livreur (1 à 5) déclenchée à la livraison (§10). Reste interne,
    visible uniquement par l'administrateur — pas de fiche publique.
    """

    commande = models.OneToOneField(
        Commande, on_delete=models.CASCADE, related_name='note_livreur',
    )
    livreur = models.ForeignKey(
        'authentification.Utilisateur', on_delete=models.CASCADE, related_name='notes_recues',
        limit_choices_to={'role': 'LIVREUR'},
    )
    client = models.ForeignKey(
        'authentification.Utilisateur', on_delete=models.CASCADE, related_name='notes_livreurs_donnees',
    )
    note = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    commentaire = models.TextField('Commentaire', blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Note livreur'
        verbose_name_plural = 'Notes livreurs'
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.livreur.get_full_name()} — {self.note}/5 (interne)"


# ─────────────────── Plaintes ───────────────────
class Plainte(models.Model):
    CATEGORIE_CHOICES = [
        # Motifs historiques (conservés pour compat des plaintes existantes)
        ('COMMANDE', 'Problème de commande'),
        ('LIVRAISON', 'Problème de livraison'),
        ('PAIEMENT', 'Problème de paiement'),
        ('PRODUIT', 'Problème de produit'),
        # Motifs précis du cahier des charges (§9.1)
        ('PRODUIT_NON_RECU', 'Produit non reçu'),
        ('PRODUIT_DIFFERENT', 'Produit différent'),
        ('LIVREUR_INJOIGNABLE', 'Livreur injoignable'),
        ('PAIEMENT_NON_VALIDE', 'Paiement débité sans validation'),
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
    # Auteur générique du signalement — un vendeur ou un livreur peut aussi
    # signaler un problème, pas seulement l'étudiant (§9.1). Nullable : quand
    # absent, `etudiant` reste l'auteur (compat des plaintes existantes).
    auteur = models.ForeignKey(
        'authentification.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signalements_envoyes',
        verbose_name='Auteur du signalement',
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
    photo_preuve = models.ImageField('Photo (preuve)', upload_to='plaintes/', null=True, blank=True)
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

    @property
    def auteur_effectif(self):
        return self.auteur or self.etudiant

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