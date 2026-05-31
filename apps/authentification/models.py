from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

# ─────────────────── Gestionnaire Personnalisé ───────────────────
class GestionnaireUtilisateur(BaseUserManager):
    def create_user(self, email, password=None, **champs_supplementaires):
        """
        Crée et retourne un utilisateur avec un email et un mot de passe.
        """
        if not email:
            raise ValueError('L\'adresse email est obligatoire')
        
        email = self.normalize_email(email)
        utilisateur = self.model(email=email, **champs_supplementaires)
        if password:
            utilisateur.set_password(password)
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
        ETUDIANT = 'ETUDIANT', 'Étudiant (Client)'
        LIVREUR = 'LIVREUR', 'Livreur'
        VENDEUR_INTERIEUR = 'VENDEUR_INTERIEUR', 'Vendeur intérieur'
        VENDEUR_EXTERIEUR = 'VENDEUR_EXTERIEUR', 'Vendeur extérieur'
        CHEF_SECTEUR = 'CHEF_SECTEUR', 'Chef de Secteur'
        ADMIN_UNIVERSITAIRE = 'ADMIN_UNIVERSITAIRE', 'Administrateur universitaire'
        ADMIN = 'ADMIN', 'Super Administrateur'
    
    # Champs d'identification
    email = models.EmailField(
        'Adresse email', 
        unique=True, 
        max_length=255,
        db_index=True,
        help_text="Email utilisé pour la connexion"
    )
    nom = models.CharField('Nom', max_length=100)
    prenom = models.CharField('Prénom', max_length=100)
    telephone = models.CharField('Téléphone', max_length=20)
    
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
        ordering = ['-date_inscription']
    
    def __str__(self):
        return f"{self.prenom} {self.nom} - {self.email}"
    
    def get_full_name(self):
        """Retourne le nom complet"""
        return f"{self.prenom} {self.nom}".strip()
    
    def get_short_name(self):
        """Retourne le prénom"""
        return self.prenom
    
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
        return self.role in (self.Role.VENDEUR_INTERIEUR, self.Role.VENDEUR_EXTERIEUR)

    @property
    def est_vendeur_interieur(self):
        return self.role == self.Role.VENDEUR_INTERIEUR

    @property
    def est_vendeur_exterieur(self):
        return self.role == self.Role.VENDEUR_EXTERIEUR

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
    Code OTP envoyé par SMS pour vérifier le numéro de téléphone à l'inscription.
    Un OTP est valide 10 minutes et à usage unique.
    """

    telephone = models.CharField('Numéro de téléphone', max_length=20, db_index=True)
    code = models.CharField('Code OTP', max_length=6)
    est_verifie = models.BooleanField('Vérifié', default=False)
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
        return not self.est_verifie and timezone.now() < self.date_expiration

    def consommer(self):
        self.est_verifie = True
        self.save(update_fields=['est_verifie'])

    @classmethod
    def generer(cls, telephone):
        import random
        code = f"{random.randint(100000, 999999)}"
        expiration = timezone.now() + timezone.timedelta(minutes=10)
        # Invalider les anciens OTPs non utilisés pour ce numéro
        cls.objects.filter(telephone=telephone, est_verifie=False).update(est_verifie=True)
        return cls.objects.create(telephone=telephone, code=code, date_expiration=expiration)

    @classmethod
    def verifier(cls, telephone, code):
        otp = cls.objects.filter(telephone=telephone, code=code, est_verifie=False).order_by('-date_creation').first()
        if otp and otp.est_valide():
            otp.consommer()
            return True
        return False


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

    def lever(self):
        self.est_actif = False
        self.save(update_fields=['est_actif'])
        if self.type_sanction in ('SUSPENSION', 'BANNISSEMENT'):
            self.utilisateur.est_actif = True
            self.utilisateur.save(update_fields=['est_actif'])
