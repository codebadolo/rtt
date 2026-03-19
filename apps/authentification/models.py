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
        ETUDIANT = 'ETUDIANT', 'Étudiant'
        CHEF_SECTEUR = 'CHEF_SECTEUR', 'Chef de Secteur'
        ADMIN = 'ADMIN', 'Administrateur'
        LIVREUR = 'LIVREUR', 'Livreur'
    
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
    matricule = models.CharField(
        'Matricule étudiant', 
        max_length=50, 
        unique=True, 
        null=True, 
        blank=True,
        help_text="Matricule pour les étudiants"
    )
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
            models.Index(fields=['matricule']),
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
    def est_livreur(self):
        return self.role == self.Role.LIVREUR

    def save(self, *args, **kwargs):
        # Mettre à jour is_staff pour les admins
        if self.role == 'ADMIN':
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
