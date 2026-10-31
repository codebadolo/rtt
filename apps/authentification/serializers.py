import re
import requests as http_requests
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Utilisateur, OTPVerification, DossierKYC, ParcoursIdentification, normaliser_telephone
from apps.administration.models import Universite
import logging

logger = logging.getLogger(__name__)

_SPECIAL = r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]'

def valider_complexite_mot_de_passe(password):
    """Exige au moins une lettre, un chiffre et un caractère spécial."""
    if not re.search(r'[a-zA-Z]', password):
        raise serializers.ValidationError('Le mot de passe doit contenir au moins une lettre.')
    if not re.search(r'\d', password):
        raise serializers.ValidationError('Le mot de passe doit contenir au moins un chiffre.')
    if not re.search(_SPECIAL, password):
        raise serializers.ValidationError(
            'Le mot de passe doit contenir au moins un caractère spécial (!@#$…).'
        )


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
    def validate_token(self, value):
        """
        Valide l'access_token Google via l'endpoint userinfo.
        """
        try:
            resp = http_requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {value}'},
                timeout=10,
            )
            if resp.status_code != 200:
                raise ValueError(f"userinfo HTTP {resp.status_code}")
            return resp.json()
        except Exception as e:
            logger.error(f"Erreur validation token Google: {str(e)}")
            raise serializers.ValidationError("Token Google invalide ou expiré")
    
    def validate(self, data):
        """
        Validation croisée
        """
        token_info = data['token']

        email = token_info.get('email')
        if Utilisateur.objects.filter(email=email).exists():
            raise serializers.ValidationError({
                'email': 'Un compte avec cet email existe déjà'
            })

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

    def validate_email(self, value):
        value = value.lower().strip()
        if Utilisateur.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte avec cet email existe déjà")
        return value

    def validate_password(self, value):
        valider_complexite_mot_de_passe(value)
        return value

    def validate(self, data):
        return data

    def save(self):
        utilisateur = Utilisateur.objects.create_user(
            email=self.validated_data['email'],
            password=self.validated_data['password'],
            nom=self.validated_data['nom'],
            prenom=self.validated_data['prenom'],
            telephone=self.validated_data.get('telephone', ''),
            role=self.validated_data['role'],
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
    infos_personnelles_renseignees = serializers.BooleanField(read_only=True)
    profil_etudiant_actif = serializers.BooleanField(read_only=True)
    universite_nom = serializers.CharField(source='universite.nom', read_only=True, default=None)
    etat_parcours = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'nom_complet',
            'telephone', 'telephone_verifie', 'role', 'universite', 'universite_nom',
            'etat_parcours',
            'est_actif', 'peut_commander',
            'infos_personnelles_renseignees', 'profil_etudiant_actif',
            'jour_naissance', 'mois_naissance',
            'date_naissance', 'adresse', 'photo_profil',
            'date_inscription', 'derniere_connexion'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'telephone_verifie',
            'date_inscription', 'derniere_connexion'
        ]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"

    def get_peut_commander(self, obj):
        return obj.profil_etudiant_actif

    def get_etat_parcours(self, obj):
        """États du parcours progressif (§9 du dossier V1)."""
        profil = getattr(obj, 'profil_vendeur', None) if obj.est_vendeur else None
        return {
            'infos_personnelles_renseignees': bool((obj.nom or '').strip() and (obj.prenom or '').strip()),
            'date_naissance_renseignee': bool(obj.jour_naissance and obj.mois_naissance),
            'telephone_verifie': obj.telephone_verifie,
            'profil_etudiant_actif': obj.profil_etudiant_actif,
            'statut_boutique': profil.statut_validation if profil else None,
        }

    def validate(self, data):
        jour = data.get('jour_naissance', getattr(self.instance, 'jour_naissance', None))
        mois = data.get('mois_naissance', getattr(self.instance, 'mois_naissance', None))
        valider_jour_mois(jour, mois)
        return data

    def update(self, instance, validated_data):
        # Un nouveau numéro doit être revérifié par OTP
        nouveau = validated_data.get('telephone')
        if nouveau is not None and nouveau != instance.telephone:
            validated_data['telephone_verifie'] = False
            validated_data['date_verification_telephone'] = None
        return super().update(instance, validated_data)


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

    def validate_nouveau_mot_de_passe(self, value):
        valider_complexite_mot_de_passe(value)
        return value

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
        return value.lower().strip()

    def save(self):
        from .utils import envoyer_email_reset_mot_de_passe
        email = self.validated_data['email']
        try:
            user = Utilisateur.objects.get(email=email, est_actif=True)
            token = user.generer_reset_token()
            envoyer_email_reset_mot_de_passe(user, token)
            logger.info(f"Token de réinitialisation généré pour: {user.email}")
        except Utilisateur.DoesNotExist:
            logger.info(f"Tentative reset mot de passe pour email inconnu: {email}")
        return None


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
    confirmation_mot_de_passe = serializers.CharField(required=False, write_only=True)

    def validate_nouveau_mot_de_passe(self, value):
        valider_complexite_mot_de_passe(value)
        return value

    def validate(self, data):
        confirm = data.get('confirmation_mot_de_passe')
        if confirm and data['nouveau_mot_de_passe'] != confirm:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas")
        return data
    
    def save(self):
        token = self.validated_data['token']
        try:
            user = Utilisateur.objects.get(reset_token=token)
            if not user.verifier_reset_token(token):
                raise serializers.ValidationError({"detail": "Lien de réinitialisation expiré. Veuillez en demander un nouveau."})

            user.set_password(self.validated_data['nouveau_mot_de_passe'])
            user.save(update_fields=['password'])
            user.reinitialiser_reset_token()
            logger.info(f"Mot de passe réinitialisé pour: {user.email}")
            return user

        except Utilisateur.DoesNotExist:
            raise serializers.ValidationError({"detail": "Lien invalide. Veuillez en demander un nouveau."})


# ──────────────────── SERIALIZER OTP INSCRIPTION ────────────────────
class OTPEnvoyerSerializer(serializers.Serializer):
    """Envoi du code OTP par SMS pour vérifier un numéro de téléphone."""
    telephone = serializers.CharField(required=True, max_length=25)

    def validate_telephone(self, value):
        telephone = normaliser_telephone(value)
        if not telephone:
            raise serializers.ValidationError('Numéro de téléphone invalide.')
        return telephone

    def save(self):
        from .otp_sender import envoyer_code_otp, EnvoiOTPErreur

        telephone = self.validated_data['telephone']
        autorise, message, _ = OTPVerification.peut_envoyer(telephone)
        if not autorise:
            raise serializers.ValidationError({'detail': message})
        otp = OTPVerification.generer(telephone)
        try:
            resultat = envoyer_code_otp(telephone, otp.code)
        except EnvoiOTPErreur as e:
            raise serializers.ValidationError({'detail': str(e)})
        return {'telephone': telephone, **resultat}


class OTPVerifierSerializer(serializers.Serializer):
    telephone = serializers.CharField(required=True, max_length=25)
    code = serializers.CharField(required=True, max_length=6)

    def validate_telephone(self, value):
        return normaliser_telephone(value) or value

    def validate(self, data):
        if not OTPVerification.verifier(data['telephone'], data['code']):
            raise serializers.ValidationError({'detail': 'Code invalide ou expiré.'})
        return data


# ──────────────────── PARCOURS D'IDENTIFICATION PROGRESSIF ────────────────────
def valider_jour_mois(jour, mois):
    """Date de naissance V1 : jour + mois uniquement (29/02 accepté)."""
    if jour is None and mois is None:
        return
    if (jour is None) != (mois is None):
        raise serializers.ValidationError({'detail': 'Le jour et le mois de naissance vont ensemble.'})
    import calendar
    if not 1 <= mois <= 12:
        raise serializers.ValidationError({'mois_naissance': 'Mois invalide (1 à 12).'})
    if not 1 <= jour <= calendar.monthrange(2000, mois)[1]:
        raise serializers.ValidationError({'jour_naissance': 'Jour invalide pour ce mois.'})


class ParcoursIdentificationSerializer(serializers.ModelSerializer):
    """État du parcours : données saisies, niveaux validés / à compléter."""
    donnees = serializers.SerializerMethodField()
    telephone_verifie = serializers.BooleanField(read_only=True)
    compte_rattache = serializers.SerializerMethodField()
    etapes = serializers.SerializerMethodField()
    etape_suivante = serializers.SerializerMethodField()
    profil_complet = serializers.SerializerMethodField()

    class Meta:
        model = ParcoursIdentification
        fields = [
            'token', 'type_parcours', 'universite', 'donnees',
            'telephone_verifie', 'compte_rattache', 'profil_complet',
            'etapes', 'etape_suivante',
            'date_creation', 'date_modification',
        ]

    def get_donnees(self, obj):
        src = obj._source()
        return {
            'nom': src.nom, 'prenom': src.prenom,
            'jour_naissance': src.jour_naissance, 'mois_naissance': src.mois_naissance,
            'telephone': obj.telephone or (obj.utilisateur.telephone if obj.utilisateur else ''),
        }

    def get_compte_rattache(self, obj):
        return obj.utilisateur_id is not None

    def get_etapes(self, obj):
        return obj.etapes()

    def get_etape_suivante(self, obj):
        return obj.etape_suivante()

    def get_profil_complet(self, obj):
        return obj.etape_suivante() is None


class ParcoursDemarrerSerializer(serializers.Serializer):
    type_parcours = serializers.ChoiceField(
        choices=ParcoursIdentification.Type.choices, default=ParcoursIdentification.Type.ETUDIANT,
    )
    universite = serializers.PrimaryKeyRelatedField(
        queryset=Universite.objects.filter(est_actif=True),
        required=False, allow_null=True,
    )

    def validate(self, data):
        if data['type_parcours'] == ParcoursIdentification.Type.ETUDIANT and not data.get('universite'):
            raise serializers.ValidationError({'universite': "Choisissez d'abord votre université."})
        return data


class ParcoursInfosSerializer(serializers.Serializer):
    """Niveaux 1-2 (étudiant) / niveau 1 hors téléphone (vendeur). Tous les champs sont partiels."""
    nom = serializers.CharField(max_length=100, required=False, allow_blank=False)
    prenom = serializers.CharField(max_length=100, required=False, allow_blank=False)
    jour_naissance = serializers.IntegerField(required=False, allow_null=True)
    mois_naissance = serializers.IntegerField(required=False, allow_null=True)
    universite = serializers.PrimaryKeyRelatedField(
        queryset=Universite.objects.filter(est_actif=True),
        required=False, allow_null=True,
    )

    def validate(self, data):
        parcours = self.context['parcours']
        src = parcours._source()
        jour = data.get('jour_naissance', src.jour_naissance)
        mois = data.get('mois_naissance', src.mois_naissance)
        valider_jour_mois(jour, mois)
        for champ in ('nom', 'prenom'):
            if champ in data:
                data[champ] = data[champ].strip()
        return data


class ParcoursTelephoneSerializer(serializers.Serializer):
    telephone = serializers.CharField(max_length=25)

    def validate_telephone(self, value):
        telephone = normaliser_telephone(value)
        if not telephone:
            raise serializers.ValidationError('Numéro de téléphone invalide.')
        return telephone


class ParcoursOTPSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=4)


class VerificationTelephoneSerializer(serializers.Serializer):
    """
    Variante « en un appel » du parcours (utilisée par le frontend) : les
    niveaux saisis côté client sont transmis avec le code OTP. Traitée par
    la même logique que /api/parcours/ (voir rattacher_compte).
    """
    telephone = serializers.CharField(max_length=25)
    code = serializers.CharField(max_length=6)
    parcours = serializers.ChoiceField(choices=ParcoursIdentification.Type.choices, default='ETUDIANT')
    nom = serializers.CharField(max_length=100, required=False, allow_blank=True)
    prenom = serializers.CharField(max_length=100, required=False, allow_blank=True)
    jour_naissance = serializers.IntegerField(required=False, allow_null=True)
    mois_naissance = serializers.IntegerField(required=False, allow_null=True)
    universite = serializers.PrimaryKeyRelatedField(
        queryset=Universite.objects.filter(est_actif=True), required=False, allow_null=True,
    )

    def validate_telephone(self, value):
        telephone = normaliser_telephone(value)
        if not telephone:
            raise serializers.ValidationError('Numéro de téléphone invalide.')
        return telephone

    def validate(self, data):
        valider_jour_mois(data.get('jour_naissance'), data.get('mois_naissance'))
        return data


# ──────────────────── SERIALIZER KYC (carte étudiant) ────────────────────
class DossierKYCSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.SerializerMethodField()
    utilisateur_email = serializers.CharField(source='utilisateur.email', read_only=True)
    verifie_par_nom = serializers.SerializerMethodField()
    statut_actuel = serializers.SerializerMethodField()

    class Meta:
        model = DossierKYC
        fields = [
            'id', 'utilisateur', 'utilisateur_nom', 'utilisateur_email',
            'numero_carte', 'image_carte_recto', 'image_carte_verso', 'selfie_etudiant',
            'statut', 'statut_actuel', 'motif_rejet', 'verifie_par_nom',
            'date_creation', 'date_verification',
        ]
        read_only_fields = ['id', 'utilisateur', 'statut', 'motif_rejet', 'date_creation', 'date_verification']

    def get_utilisateur_nom(self, obj):
        return obj.utilisateur.get_full_name()

    def get_verifie_par_nom(self, obj):
        return obj.verifie_par.get_full_name() if obj.verifie_par else None

    def get_statut_actuel(self, obj):
        return {'code': obj.statut}

    def create(self, validated_data):
        utilisateur = self.context['request'].user
        dossier, created = DossierKYC.objects.get_or_create(
            utilisateur=utilisateur, defaults=validated_data,
        )
        if not created:
            if dossier.statut != 'REJETE':
                raise serializers.ValidationError({'detail': 'Un dossier est déjà en cours de traitement.'})
            dossier.resoumettre(**validated_data)
        return dossier
