from rest_framework import serializers
from django.contrib.auth import authenticate
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests
from .models import Utilisateur
import logging

logger = logging.getLogger(__name__)

# ──────────────────── SERIALIZER INSCRIPTION GOOGLE ────────────────────
class InscriptionGoogleSerializer(serializers.Serializer):
    """
    Serializer pour l'inscription via Google
    """
    token = serializers.CharField(required=True, write_only=True)
    nom = serializers.CharField(required=True, max_length=100)
    prenom = serializers.CharField(required=True, max_length=100)
    telephone = serializers.CharField(required=True, max_length=20)
    role = serializers.ChoiceField(
        choices=['ETUDIANT', 'LIVREUR', 'CHEF_SECTEUR', 'ADMIN'],
        required=True
    )
    matricule = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50
    )
    
    def validate_token(self, value):
        """
        Valide le token Google
        """
        try:
            idinfo = id_token.verify_oauth2_token(
                value,
                requests.Request(),
                settings.GOOGLE_OAUTH2_CLIENT_ID
            )
            
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise serializers.ValidationError("Token invalide: émetteur non reconnu")
            
            return idinfo
            
        except ValueError as e:
            logger.error(f"Erreur validation token Google: {str(e)}")
            raise serializers.ValidationError("Token Google invalide ou expiré")
    
    def validate(self, data):
        """
        Validation croisée
        """
        token_info = data['token']
        
        # Vérifier que l'email n'existe pas
        email = token_info.get('email')
        if Utilisateur.objects.filter(email=email).exists():
            raise serializers.ValidationError({
                'email': 'Un compte avec cet email existe déjà'
            })
        
        # Pour les étudiants, le matricule est requis
        if data['role'] == 'ETUDIANT' and not data.get('matricule'):
            raise serializers.ValidationError({
                'matricule': 'Le matricule est obligatoire pour les étudiants'
            })
        
        # Vérifier le format du téléphone
        telephone = data.get('telephone')
        if not telephone.replace('+', '').replace(' ', '').isdigit():
            raise serializers.ValidationError({
                'telephone': 'Format de téléphone invalide'
            })
        
        return data
    
    def save(self):
        """
        Crée l'utilisateur
        """
        token_info = self.validated_data['token']
        
        utilisateur = Utilisateur.objects.create_user(
            email=token_info.get('email'),
            password=None,
            nom=self.validated_data['nom'],
            prenom=self.validated_data['prenom'],
            telephone=self.validated_data['telephone'],
            role=self.validated_data['role'],
            matricule=self.validated_data.get('matricule', ''),
            google_id=token_info.get('sub'),
            photo_profil=token_info.get('picture'),
        )
        
        logger.info(f"Nouvel utilisateur créé via Google: {utilisateur.email}")
        return utilisateur


# ──────────────────── SERIALIZER INSCRIPTION EMAIL ────────────────────
class InscriptionSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, min_length=8, write_only=True)
    nom = serializers.CharField(required=True, max_length=100)
    prenom = serializers.CharField(required=True, max_length=100)
    telephone = serializers.CharField(required=True, max_length=20)
    role = serializers.ChoiceField(choices=['ETUDIANT', 'LIVREUR', 'CHEF_SECTEUR', 'ADMIN'], required=True)
    matricule = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def validate_email(self, value):
        value = value.lower().strip()
        if Utilisateur.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte avec cet email existe déjà")
        return value

    def validate(self, data):
        if data['role'] == 'ETUDIANT' and not data.get('matricule'):
            raise serializers.ValidationError({'matricule': 'Le matricule est obligatoire pour les étudiants'})
        return data

    def save(self):
        utilisateur = Utilisateur.objects.create_user(
            email=self.validated_data['email'],
            password=self.validated_data['password'],
            nom=self.validated_data['nom'],
            prenom=self.validated_data['prenom'],
            telephone=self.validated_data.get('telephone', ''),
            role=self.validated_data['role'],
            matricule=self.validated_data.get('matricule', ''),
            est_actif=True,
        )
        logger.info(f"Nouvel utilisateur inscrit: {utilisateur.email}")
        return utilisateur


# ──────────────────── SERIALIZER CONNEXION ────────────────────
class ConnexionSerializer(serializers.Serializer):
    """
    Serializer pour la connexion email/mot de passe
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, data):
        email = data.get('email').lower().strip()
        password = data.get('password')
        
        if not email or not password:
            raise serializers.ValidationError("Email et mot de passe requis")
        
        # Authentifier
        user = authenticate(
            request=self.context.get('request'),
            email=email,
            password=password
        )
        
        if not user:
            raise serializers.ValidationError("Email ou mot de passe incorrect")
        
        # Vérifications
        if not user.est_actif:
            raise serializers.ValidationError("Ce compte est désactivé")
        
        # On laisse passer les étudiants même sans KYC — le frontend gère la redirection
        
        # Mettre à jour la connexion
        user.marquer_connexion()
        
        data['user'] = user
        return data


# ──────────────────── SERIALIZER UTILISATEUR ────────────────────
class UtilisateurListSerializer(serializers.ModelSerializer):
    """
    Serializer pour la liste (lecture seule)
    """
    nom_complet = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'nom_complet',
            'role', 'role_display', 'telephone',
            'est_actif', 'date_inscription'
        ]
        read_only_fields = ['id', 'email', 'date_inscription']
    
    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"


class UtilisateurDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pour le détail
    """
    nom_complet = serializers.SerializerMethodField()
    peut_commander = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'nom_complet',
            'matricule', 'telephone', 'role',
            'est_actif', 'peut_commander',
            'date_naissance', 'adresse', 'photo_profil',
            'date_inscription', 'derniere_connexion'
        ]
        read_only_fields = [
            'id', 'email', 'role',
            'date_inscription', 'derniere_connexion'
        ]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"

    def get_peut_commander(self, obj):
        return obj.est_etudiant and obj.est_actif


# ──────────────────── SERIALIZER CHANGEMENT MOT DE PASSE ────────────────────
class ChangementMotDePasseSerializer(serializers.Serializer):
    """
    Serializer pour le changement de mot de passe
    """
    ancien_mot_de_passe = serializers.CharField(required=True, write_only=True)
    nouveau_mot_de_passe = serializers.CharField(
        required=True, 
        write_only=True,
        min_length=8,
        error_messages={
            'min_length': 'Le mot de passe doit contenir au moins 8 caractères'
        }
    )
    confirmation_mot_de_passe = serializers.CharField(required=True, write_only=True)
    
    def validate_ancien_mot_de_passe(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("L'ancien mot de passe est incorrect")
        return value
    
    def validate(self, data):
        if data['nouveau_mot_de_passe'] != data['confirmation_mot_de_passe']:
            raise serializers.ValidationError(
                "Les mots de passe ne correspondent pas"
            )
        
        if data['ancien_mot_de_passe'] == data['nouveau_mot_de_passe']:
            raise serializers.ValidationError(
                "Le nouveau mot de passe doit être différent de l'ancien"
            )
        
        return data
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['nouveau_mot_de_passe'])
        user.save()
        logger.info(f"Mot de passe changé pour: {user.email}")


# ──────────────────── SERIALIZER RÉINITIALISATION MOT DE PASSE ────────────────────
class DemandeReinitialisationSerializer(serializers.Serializer):
    """
    Serializer pour demander un reset de mot de passe
    """
    email = serializers.EmailField(required=True)
    
    def validate_email(self, value):
        try:
            user = Utilisateur.objects.get(email=value.lower(), est_actif=True)
        except Utilisateur.DoesNotExist:
            raise serializers.ValidationError("Aucun compte actif avec cet email")
        
        return user
    
    def save(self):
        user = self.validated_data['email']
        token = user.generer_reset_token()
        # Ici, envoyer l'email avec le token
        logger.info(f"Token de réinitialisation généré pour: {user.email}")
        return token


class ReinitialisationMotDePasseSerializer(serializers.Serializer):
    """
    Serializer pour réinitialiser le mot de passe
    """
    token = serializers.CharField(required=True)
    nouveau_mot_de_passe = serializers.CharField(
        required=True,
        min_length=8,
        write_only=True
    )
    confirmation_mot_de_passe = serializers.CharField(required=True, write_only=True)
    
    def validate(self, data):
        if data['nouveau_mot_de_passe'] != data['confirmation_mot_de_passe']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas")
        return data
    
    def save(self):
        token = self.validated_data['token']
        try:
            user = Utilisateur.objects.get(reset_token=token)
            if not user.verifier_reset_token(token):
                raise serializers.ValidationError("Token invalide ou expiré")
            
            user.set_password(self.validated_data['nouveau_mot_de_passe'])
            user.reinitialiser_reset_token()
            logger.info(f"Mot de passe réinitialisé pour: {user.email}")
            return user
            
        except Utilisateur.DoesNotExist:
            raise serializers.ValidationError("Token invalide")
