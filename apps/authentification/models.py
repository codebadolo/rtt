from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Q
from django.utils import timezone
import re
import secrets
import uuid


def normaliser_telephone(telephone):
    """
    Normalise un numéro au format international (+226XXXXXXXX par défaut).
    Retourne None si le numéro est invalide.
    """
    if not telephone:
        return None
    brut = str(telephone).strip()
    chiffres = re.sub(r'\D', '', brut)
    if brut.startswith('00'):
        chiffres = chiffres[2:]
    elif not brut.startswith('+') and len(chiffres) == 8:
        # Numéro local burkinabè sans indicatif
        chiffres = '226' + chiffres
    if not 8 <= len(chiffres) <= 15:
        return None
    return f'+{chiffres}'

# ─────────────────── Gestionnaire Personnalisé ───────────────────
class GestionnaireUtilisateur(BaseUserManager):
    def create_user(self, email, password=None, **champs_supplementaires):
        """
        Crée et retourne un utilisateur avec un email et un mot de passe.
        Les étudiants et vendeurs inscrits par le parcours progressif n'ont
        ni email ni mot de passe : ils sont identifiés par leur téléphone
        vérifié par OTP.
        """
        if not email and not champs_supplementaires.get('telephone'):
            raise ValueError('L\'adresse email ou le téléphone est obligatoire')

        email = self.normalize_email(email) if email else None
        utilisateur = self.model(email=email, **champs_supplementaires)
        if password:
            utilisateur.set_password(password)
        else:
            utilisateur.set_unusable_password()
        utilisateur.save(using=self._db)
        return utilisateur
    
    def create_superuser(self, email, password=None, **champs_supplementaires):
        """
        Crée et retourne un superutilisateur avec tous les droits.
        """
        champs_supplementaires.setdefault('is_staff', True)
        champs_supplementaires.setdefault('is_superuser', True)
        champs_supplementaires.setdefault('role', 'ADMIN')
        
        if champs_supplementaires.get('is_staff') is not True:
            raise ValueError('Le superutilisateur doit avoir is_staff=True.')
        if champs_supplementaires.get('is_superuser') is not True:
            raise ValueError('Le superutilisateur doit avoir is_superuser=True.')
        
        return self.create_user(email, password, **champs_supplementaires)

# ─────────────────── Modèle Utilisateur Principal ───────────────────
class Utilisateur(AbstractBaseUser, PermissionsMixin):
    """
    Modèle utilisateur personnalisé avec authentification par email.
    """
    
    class Role(models.TextChoices):
        # Deux types de comptes publics : Client (valeur historique ETUDIANT) et Vendeur
        ETUDIANT = 'ETUDIANT', 'Client'
        LIVREUR = 'LIVREUR', 'Livreur'
        VENDEUR = 'VENDEUR', 'Vendeur'
        CHEF_SECTEUR = 'CHEF_SECTEUR', 'Chef de Secteur'
        ADMIN_UNIVERSITAIRE = 'ADMIN_UNIVERSITAIRE', 'Administrateur universitaire'
        ADMIN = 'ADMIN', 'Super Administrateur'
    
    # Champs d'identification
    email = models.EmailField(
        'Adresse email', 
        unique=True, 
        max_length=255,
        db_index=True,
        null=True,
        blank=True,
        help_text="Email utilisé pour la connexion (facultatif pour les comptes créés par téléphone)"
    )
    nom = models.CharField('Nom', max_length=100)
    prenom = models.CharField('Prénom', max_length=100)
    telephone = models.CharField('Téléphone', max_length=20)
    telephone_verifie = models.BooleanField('Téléphone vérifié (OTP)', default=False)
    date_verification_telephone = models.DateTimeField('Date de vérification du téléphone', null=True, blank=True)
    
    # Gestion des rôles et permissions
    role = models.CharField(
        'Rôle', 
        max_length=20, 
        choices=Role.choices, 
        default=Role.ETUDIANT,
        db_index=True
    )
    
    # Statut du compte
    est_actif = models.BooleanField('Compte actif', default=True)
    is_staff = models.BooleanField('Membre du staff', default=False)
    date_inscription = models.DateTimeField('Date d\'inscription', auto_now_add=True)
    derniere_connexion = models.DateTimeField('Dernière connexion', null=True, blank=True)
    
    # Université de rattachement
    universite = models.ForeignKey(
        'administration.Universite',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='utilisateurs',
        verbose_name='Université',
    )

    # Champs spécifiques aux étudiants
    filiere = models.CharField('Filière', max_length=100, null=True, blank=True)
    niveau_etude = models.CharField(
        'Niveau d\'étude',
        max_length=50,
        null=True,
        blank=True,
        help_text='Ex: Licence 1, Licence 2, Master...',
    )

    # Pour future intégration Google (optionnel)
    google_id = models.CharField('Google ID', max_length=255, null=True, blank=True)
    photo_profil = models.URLField('Photo de profil', null=True, blank=True)
    
    # Champs pour réinitialisation de mot de passe
    reset_token = models.CharField('Token de réinitialisation', max_length=255, null=True, blank=True)
    reset_token_expire = models.DateTimeField('Expiration token', null=True, blank=True)
    
    # Nouveaux champs utiles
    adresse = models.TextField('Adresse', null=True, blank=True)
    date_naissance = models.DateField('Date de naissance', null=True, blank=True)
    # Parcours étudiant V1 : jour + mois uniquement (pas d'année)
    jour_naissance = models.PositiveSmallIntegerField('Jour de naissance', null=True, blank=True)
    mois_naissance = models.PositiveSmallIntegerField('Mois de naissance', null=True, blank=True)
    
    objects = GestionnaireUtilisateur()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nom', 'prenom']
    
    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
        constraints = [
            # Un numéro vérifié n'appartient qu'à un seul compte
            models.UniqueConstraint(
                fields=['telephone'],
                condition=Q(telephone_verifie=True),
                name='utilisateur_telephone_verifie_unique',
            ),
        ]
        ordering = ['-date_inscription']
    
    def __str__(self):
        return f"{self.prenom} {self.nom} - {self.email or self.telephone}"
    
    def get_full_name(self):
        """Retourne le nom complet"""
        return f"{self.prenom} {self.nom}".strip()
    
    def get_short_name(self):
        """Retourne le prénom"""
        return self.prenom
    
    @property
    def infos_personnelles_renseignees(self):
        return bool(
            (self.nom or '').strip() and (self.prenom or '').strip()
            and self.jour_naissance and self.mois_naissance
        )

    @property
    def profil_etudiant_actif(self):
        """Profil complet + téléphone vérifié : l'étudiant peut commander."""
        return (
            self.est_etudiant and self.est_actif
            and self.infos_personnelles_renseignees and self.telephone_verifie
        )

    def marquer_telephone_verifie(self, telephone):
        self.telephone = telephone
        self.telephone_verifie = True
        self.date_verification_telephone = timezone.now()
        self.save(update_fields=['telephone', 'telephone_verifie', 'date_verification_telephone'])

    @property
    def est_etudiant(self):
        return self.role == self.Role.ETUDIANT

    @property
    def est_chef_secteur(self):
        return self.role == self.Role.CHEF_SECTEUR

    @property
    def est_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def est_admin_universitaire(self):
        return self.role == self.Role.ADMIN_UNIVERSITAIRE or self.est_admin

    @property
    def est_livreur(self):
        return self.role == self.Role.LIVREUR

    @property
    def est_vendeur(self):
        return self.role == self.Role.VENDEUR

    def save(self, *args, **kwargs):
        if self.role in ('ADMIN', 'ADMIN_UNIVERSITAIRE', 'CHEF_SECTEUR'):
            self.is_staff = True
        super().save(*args, **kwargs)
    
    def marquer_connexion(self):
        """Met à jour la dernière connexion"""
        self.derniere_connexion = timezone.now()
        self.save(update_fields=['derniere_connexion'])
    
    def generer_reset_token(self):
        """Génère un token de réinitialisation"""
        import secrets
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_token_expire = timezone.now() + timezone.timedelta(hours=24)
        self.save(update_fields=['reset_token', 'reset_token_expire'])
        return self.reset_token
    
    def verifier_reset_token(self, token):
        """Vérifie la validité du token"""
        if self.reset_token != token:
            return False
        if timezone.now() > self.reset_token_expire:
            return False
        return True
    
    def reinitialiser_reset_token(self):
        """Réinitialise le token"""
        self.reset_token = None
        self.reset_token_expire = None
        self.save(update_fields=['reset_token', 'reset_token_expire'])


# ─────────────────── Vérification OTP Téléphone ───────────────────
class OTPVerification(models.Model):
    """
    Code OTP envoyé par SMS pour vérifier un numéro de téléphone.
    Un OTP est valide 10 minutes, à usage unique, et limité à
    MAX_TENTATIVES essais. La vérification du numéro n'a aucun lien avec
    la validation d'une commande : seul le paiement confirme une commande.
    """

    DUREE_VALIDITE_MINUTES = 10
    DELAI_RENVOI_SECONDES = 60
    MAX_ENVOIS_PAR_HEURE = 5
    MAX_TENTATIVES = 5

    telephone = models.CharField('Numéro de téléphone', max_length=20, db_index=True)
    code = models.CharField('Code OTP', max_length=6)
    est_verifie = models.BooleanField('Vérifié', default=False)
    tentatives = models.PositiveSmallIntegerField('Tentatives', default=0)
    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_expiration = models.DateTimeField('Expiration')

    class Meta:
        verbose_name = 'Vérification OTP'
        verbose_name_plural = 'Vérifications OTP'
        ordering = ['-date_creation']
        indexes = [
            models.Index(fields=['telephone', 'est_verifie']),
        ]

    def __str__(self):
        statut = 'vérifié' if self.est_verifie else 'en attente'
        return f"OTP {self.telephone} ({statut})"

    def est_valide(self):
        return (
            not self.est_verifie
            and self.tentatives < self.MAX_TENTATIVES
            and timezone.now() < self.date_expiration
        )

    def consommer(self):
        self.est_verifie = True
        self.save(update_fields=['est_verifie'])

    @classmethod
    def delai_avant_renvoi(cls, telephone):
        """Secondes à attendre avant de pouvoir redemander un code (0 si possible)."""
        dernier = cls.objects.filter(telephone=telephone).order_by('-date_creation').first()
        if not dernier:
            return 0
        ecoule = (timezone.now() - dernier.date_creation).total_seconds()
        return max(0, int(cls.DELAI_RENVOI_SECONDES - ecoule))

    @classmethod
    def peut_envoyer(cls, telephone):
        """
        Limite anti-abus : un envoi par minute, MAX_ENVOIS_PAR_HEURE par heure.
        Retourne (autorise, message, delai_en_secondes).
        """
        delai = cls.delai_avant_renvoi(telephone)
        if delai:
            return False, f'Veuillez patienter {delai} s avant de redemander un code.', delai
        depuis = timezone.now() - timezone.timedelta(hours=1)
        if cls.objects.filter(telephone=telephone, date_creation__gte=depuis).count() >= cls.MAX_ENVOIS_PAR_HEURE:
            return False, 'Trop de codes demandés pour ce numéro. Réessayez dans une heure.', 3600
        return True, '', 0

    @classmethod
    def generer(cls, telephone):
        code = f"{secrets.randbelow(900000) + 100000}"
        expiration = timezone.now() + timezone.timedelta(minutes=cls.DUREE_VALIDITE_MINUTES)
        # Invalider les anciens OTPs non utilisés pour ce numéro
        cls.objects.filter(telephone=telephone, est_verifie=False).update(est_verifie=True)
        return cls.objects.create(telephone=telephone, code=code, date_expiration=expiration)

    @classmethod
    def verifier(cls, telephone, code):
        otp = cls.objects.filter(telephone=telephone, est_verifie=False).order_by('-date_creation').first()
        if not otp or not otp.est_valide():
            return False
        if not secrets.compare_digest(otp.code, str(code).strip()):
            otp.tentatives += 1
            otp.save(update_fields=['tentatives'])
            return False
        otp.consommer()
        return True


# ─────────────────── Parcours d'identification progressif ───────────────────
class ParcoursIdentification(models.Model):
    """
    Brouillon du parcours d'identification par niveaux (étudiant ou vendeur).

    L'étudiant découvre le campus sans compte ; ses informations sont
    collectées niveau par niveau au moment de commander, puis rattachées à
    un compte Utilisateur une fois le téléphone vérifié par OTP. Le token
    sert d'identifiant au parcours tant qu'aucun compte n'y est rattaché ;
    ensuite, l'accès exige l'authentification de ce compte.

    Étudiant : 1 nom+prénom → 2 jour+mois de naissance → 3 téléphone → 4 OTP.
    Vendeur  : 1 nom+prénom+téléphone → 2 OTP (la suite se fait sur la boutique).
    """

    class Type(models.TextChoices):
        ETUDIANT = 'ETUDIANT', 'Étudiant'
        VENDEUR = 'VENDEUR', 'Vendeur'

    DUREE_VALIDITE_JOURS = 7

    token = models.UUIDField('Token', default=uuid.uuid4, unique=True, editable=False, db_index=True)
    type_parcours = models.CharField('Type de parcours', max_length=10, choices=Type.choices, default=Type.ETUDIANT)
    universite = models.ForeignKey(
        'administration.Universite',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parcours_identification',
        verbose_name='Université choisie',
    )

    nom = models.CharField('Nom', max_length=100, blank=True, default='')
    prenom = models.CharField('Prénom', max_length=100, blank=True, default='')
    jour_naissance = models.PositiveSmallIntegerField('Jour de naissance', null=True, blank=True)
    mois_naissance = models.PositiveSmallIntegerField('Mois de naissance', null=True, blank=True)
    telephone = models.CharField('Téléphone', max_length=20, blank=True, default='')
    date_envoi_otp = models.DateTimeField('Dernier envoi OTP', null=True, blank=True)

    # Rempli après vérification OTP
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='parcours_identification',
    )

    date_creation = models.DateTimeField('Date création', auto_now_add=True)
    date_modification = models.DateTimeField('Dernière modification', auto_now=True)

    class Meta:
        verbose_name = "Parcours d'identification"
        verbose_name_plural = "Parcours d'identification"
        ordering = ['-date_creation']

    def __str__(self):
        return f"Parcours {self.get_type_parcours_display()} {self.token}"

    @property
    def est_expire(self):
        if self.utilisateur_id:
            return False
        return timezone.now() > self.date_creation + timezone.timedelta(days=self.DUREE_VALIDITE_JOURS)

    @property
    def telephone_verifie(self):
        u = self.utilisateur
        return bool(u and u.telephone_verifie and u.telephone == self.telephone)

    def _source(self):
        """Une fois le compte rattaché, c'est lui qui fait foi."""
        return self.utilisateur or self

    @property
    def identite_renseignee(self):
        src = self._source()
        return bool((src.nom or '').strip() and (src.prenom or '').strip())

    @property
    def naissance_renseignee(self):
        src = self._source()
        return bool(src.jour_naissance and src.mois_naissance)

    def etapes(self):
        """Liste des niveaux avec leur statut (VALIDE / A_COMPLETER)."""
        def st(ok):
            return 'VALIDE' if ok else 'A_COMPLETER'

        if self.type_parcours == self.Type.VENDEUR:
            return [
                {'niveau': 1, 'code': 'RESPONSABLE', 'libelle': 'Nom, prénom et téléphone',
                 'statut': st(self.identite_renseignee and bool(self.telephone))},
                {'niveau': 2, 'code': 'OTP', 'libelle': 'Vérification du téléphone par SMS',
                 'statut': st(self.telephone_verifie)},
            ]
        return [
            {'niveau': 1, 'code': 'IDENTITE', 'libelle': 'Nom et prénom',
             'statut': st(self.identite_renseignee)},
            {'niveau': 2, 'code': 'NAISSANCE', 'libelle': 'Date de naissance (jour et mois)',
             'statut': st(self.naissance_renseignee)},
            {'niveau': 3, 'code': 'TELEPHONE', 'libelle': 'Numéro de téléphone',
             'statut': st(bool(self.telephone))},
            {'niveau': 4, 'code': 'OTP', 'libelle': 'Vérification du téléphone par SMS',
             'statut': st(self.telephone_verifie)},
        ]

    def etape_suivante(self):
        for etape in self.etapes():
            if etape['statut'] != 'VALIDE':
                return etape['code']
        return None

    def appliquer(self, **champs):
        """
        Enregistre les champs d'un niveau. Après rattachement, les données
        sont aussi écrites sur le compte (retour en arrière sans perte).
        """
        for k, v in champs.items():
            setattr(self, k, v)
        self.save()
        u = self.utilisateur
        if u:
            champs_compte = {k: v for k, v in champs.items()
                             if k in ('nom', 'prenom', 'jour_naissance', 'mois_naissance', 'universite')}
            for k, v in champs_compte.items():
                setattr(u, k, v)
            if champs_compte:
                u.save(update_fields=list(champs_compte))


# ─────────────────── Sanctions Utilisateurs ───────────────────
class SanctionUtilisateur(models.Model):
    """
    Système de sanctions graduel : avertissement → suspension → bannissement.
    """

    TYPE_CHOICES = [
        ('AVERTISSEMENT', 'Avertissement'),
        ('SUSPENSION', 'Suspension temporaire'),
        ('BANNISSEMENT', 'Bannissement définitif'),
    ]

    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='sanctions',
    )
    type_sanction = models.CharField('Type', max_length=15, choices=TYPE_CHOICES)
    motif = models.TextField('Motif')
    prononce_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sanctions_prononcees',
    )
    date_debut = models.DateTimeField('Début', auto_now_add=True)
    date_fin = models.DateTimeField('Fin (suspension)', null=True, blank=True)
    est_actif = models.BooleanField('Sanction active', default=True)

    class Meta:
        verbose_name = 'Sanction'
        verbose_name_plural = 'Sanctions'
        ordering = ['-date_debut']

    def __str__(self):
        return f"{self.get_type_sanction_display()} — {self.utilisateur.get_full_name()}"

    def save(self, *args, **kwargs):
        est_nouvelle = self.pk is None
        super().save(*args, **kwargs)
        if est_nouvelle:
            from apps.administration.models import JournalAudit
            JournalAudit.enregistrer(
                self.prononce_par,
                f'SANCTION_{self.type_sanction}',
                self.utilisateur,
                self.motif,
            )
            if self.type_sanction in ('SUSPENSION', 'BANNISSEMENT'):
                self.utilisateur.est_actif = False
                self.utilisateur.save(update_fields=['est_actif'])

    def lever(self):
        self.est_actif = False
        self.save(update_fields=['est_actif'])
        if self.type_sanction in ('SUSPENSION', 'BANNISSEMENT'):
            self.utilisateur.est_actif = True
            self.utilisateur.save(update_fields=['est_actif'])


# ─────────────────── Dossier KYC (carte étudiant) ───────────────────
class DossierKYC(models.Model):
    """
    Vérification facultative de la carte étudiant (recto/verso + selfie).
    Elle ne fait pas partie du parcours d'inscription V1 (téléphone vérifié
    par OTP). Un dossier par utilisateur ; une resoumission après rejet
    met à jour le même dossier.
    """

    STATUT_CHOICES = [
        ('EN_ATTENTE', 'En attente'),
        ('VALIDE', 'Validé'),
        ('REJETE', 'Rejeté'),
    ]

    utilisateur = models.OneToOneField(
        Utilisateur, on_delete=models.CASCADE, related_name='dossier_kyc',
    )
    numero_carte = models.CharField('Numéro de carte étudiant', max_length=50)
    image_carte_recto = models.ImageField('Carte — recto', upload_to='kyc/carte/', null=True, blank=True)
    image_carte_verso = models.ImageField('Carte — verso', upload_to='kyc/carte/', null=True, blank=True)
    selfie_etudiant = models.ImageField('Selfie', upload_to='kyc/selfie/', null=True, blank=True)

    statut = models.CharField('Statut', max_length=15, choices=STATUT_CHOICES, default='EN_ATTENTE')
    motif_rejet = models.TextField('Motif du rejet', null=True, blank=True)
    verifie_par = models.ForeignKey(
        Utilisateur, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='kyc_verifies',
    )
    date_creation = models.DateTimeField('Date de soumission', auto_now_add=True)
    date_verification = models.DateTimeField('Date de vérification', null=True, blank=True)

    class Meta:
        verbose_name = 'Dossier KYC (carte étudiant)'
        verbose_name_plural = 'Dossiers KYC (carte étudiant)'
        ordering = ['-date_creation']

    def __str__(self):
        return f"KYC {self.utilisateur.get_full_name()} ({self.statut})"

    def resoumettre(self, **champs):
        for k, v in champs.items():
            setattr(self, k, v)
        self.statut = 'EN_ATTENTE'
        self.motif_rejet = None
        self.verifie_par = None
        self.date_verification = None
        self.save()

    def valider(self, admin):
        from apps.administration.models import JournalAudit
        self.statut = 'VALIDE'
        self.verifie_par = admin
        self.date_verification = timezone.now()
        self.motif_rejet = None
        self.save(update_fields=['statut', 'verifie_par', 'date_verification', 'motif_rejet'])
        JournalAudit.enregistrer(admin, 'VALIDATION_KYC_ETUDIANT', self, f'{self.utilisateur.get_full_name()}')

    def rejeter(self, admin, motif):
        from apps.administration.models import JournalAudit
        self.statut = 'REJETE'
        self.verifie_par = admin
        self.date_verification = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['statut', 'verifie_par', 'date_verification', 'motif_rejet'])
        JournalAudit.enregistrer(admin, 'REJET_KYC_ETUDIANT', self, f'{self.utilisateur.get_full_name()} : {motif}')
