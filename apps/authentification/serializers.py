import re
import requests as http_requests
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Utilisateur, OTPVerification, DossierKYC
from .telephone import normaliser_telephone, trouver_utilisateur_par_telephone
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


def valider_jour_mois(jour, mois):
    """Date de naissance V1 : jour + mois uniquement (pas d'année)."""
    import calendar
    if jour is None and mois is None:
        return
    if jour is None or mois is None:
        raise serializers.ValidationError({'jour_naissance': 'Indiquez le jour et le mois.'})
    if not 1 <= mois <= 12:
        raise serializers.ValidationError({'mois_naissance': 'Mois invalide.'})
    # 2000 est bissextile : le 29 février est accepté
    if not 1 <= jour <= calendar.monthrange(2000, mois)[1]:
        raise serializers.ValidationError({'jour_naissance': 'Jour invalide pour ce mois.'})


def champ_telephone(value):
    telephone = normaliser_telephone(value)
    if not telephone:
        raise serializers.ValidationError('Numéro de téléphone invalide (8 chiffres, ex : 70 00 00 00).')
    return telephone


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
    universite_nom = serializers.CharField(source='universite.nom', read_only=True, default=None)
    etat_parcours = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'nom_complet',
            'telephone', 'telephone_verifie', 'role',
            'est_actif', 'peut_commander',
            'date_naissance', 'jour_naissance', 'mois_naissance',
            'universite', 'universite_nom',
            'adresse', 'photo_profil',
            'etat_parcours',
            'date_inscription', 'derniere_connexion'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'telephone_verifie',
            'date_inscription', 'derniere_connexion'
        ]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"

    def get_peut_commander(self, obj):
        return obj.est_etudiant and obj.est_actif and obj.telephone_verifie

    def get_etat_parcours(self, obj):
        """États du parcours progressif (§9 du dossier V1)."""
        etat = {
            'infos_personnelles_renseignees': obj.infos_personnelles_renseignees,
            'date_naissance_renseignee': obj.date_naissance_renseignee,
            'telephone_verifie': obj.telephone_verifie,
            'profil_etudiant_actif': obj.profil_etudiant_actif,
            'statut_boutique': None,
        }
        profil = getattr(obj, 'profil_vendeur', None) if obj.est_vendeur else None
        if profil is not None:
            etat['statut_boutique'] = profil.statut_validation
        return etat

    def validate(self, data):
        valider_jour_mois(data.get('jour_naissance'), data.get('mois_naissance'))
        return data

    def update(self, instance, validated_data):
        # Un numéro modifié doit être revérifié par OTP.
        nouveau = validated_data.get('telephone')
        if nouveau is not None and normaliser_telephone(nouveau) != normaliser_telephone(instance.telephone):
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


# ──────────────────── SERIALIZER OTP ────────────────────
class OTPEnvoyerSerializer(serializers.Serializer):
    """Envoi du code OTP par SMS pour vérifier un numéro de téléphone."""
    telephone = serializers.CharField(required=True, max_length=20)

    def validate_telephone(self, value):
        return champ_telephone(value)

    def save(self):
        from .otp_sender import envoyer_code_otp, EnvoiOTPNonConfigure

        telephone = self.validated_data['telephone']
        autorise, message = OTPVerification.peut_envoyer(telephone)
        if not autorise:
            raise serializers.ValidationError({'detail': message})
        otp = OTPVerification.generer(telephone)
        try:
            resultat = envoyer_code_otp(telephone, otp.code)
        except EnvoiOTPNonConfigure as e:
            raise serializers.ValidationError({'detail': str(e)})
        return {'telephone': telephone, **resultat}


class OTPVerifierSerializer(serializers.Serializer):
    telephone = serializers.CharField(required=True, max_length=20)
    code = serializers.CharField(required=True, max_length=6)

    def validate_telephone(self, value):
        return champ_telephone(value)

    def validate(self, data):
        if not OTPVerification.verifier(data['telephone'], data['code']):
            raise serializers.ValidationError({'detail': 'Code invalide ou expiré.'})
        return data


class VerificationTelephoneParcoursSerializer(serializers.Serializer):
    """
    Niveau « OTP SMS » du parcours progressif étudiant / vendeur (dossier V1 §3, §6).

    Vérifie le code puis rattache le numéro à un compte :
    - utilisateur déjà connecté → son numéro est marqué vérifié ;
    - numéro déjà vérifié sur un compte étudiant/vendeur → reconnexion à ce compte
      (commandes suivantes : aucune ressaisie) ;
    - numéro inconnu → création du compte (sans mot de passe ni email réel).

    Cette vérification authentifie le numéro uniquement : elle ne crée ni ne
    valide aucune commande.
    """
    PARCOURS = [('ETUDIANT', 'Étudiant'), ('VENDEUR', 'Vendeur')]
    ROLES_AUTORISES = {
        'ETUDIANT': ('ETUDIANT', 'VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR'),
        'VENDEUR': ('ETUDIANT', 'VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR'),
    }

    telephone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)
    parcours = serializers.ChoiceField(choices=PARCOURS, default='ETUDIANT')
    nom = serializers.CharField(max_length=100, required=False, allow_blank=True)
    prenom = serializers.CharField(max_length=100, required=False, allow_blank=True)
    jour_naissance = serializers.IntegerField(required=False, allow_null=True)
    mois_naissance = serializers.IntegerField(required=False, allow_null=True)
    universite = serializers.IntegerField(required=False, allow_null=True)

    def validate_telephone(self, value):
        return champ_telephone(value)

    def validate_universite(self, value):
        from apps.administration.models import Universite
        if value and not Universite.objects.filter(pk=value, est_actif=True).exists():
            raise serializers.ValidationError('Université inconnue.')
        return value

    def validate(self, data):
        valider_jour_mois(data.get('jour_naissance'), data.get('mois_naissance'))
        request = self.context['request']
        telephone = data['telephone']

        # Le code est vérifié avant tout : sans lui, aucune information sur
        # l'existence d'un compte associé au numéro n'est divulguée.
        if not OTPVerification.verifier(telephone, data['code']):
            raise serializers.ValidationError({'code': 'Code invalide ou expiré.'})

        # Un numéro vérifié n'appartient qu'à un seul compte
        existant = trouver_utilisateur_par_telephone(
            telephone, Utilisateur.objects.filter(telephone_verifie=True),
        )
        connecte = request.user if request.user.is_authenticated else None
        if connecte:
            if existant and existant.pk != connecte.pk:
                raise serializers.ValidationError(
                    {'telephone': 'Ce numéro est déjà vérifié sur un autre compte.'}
                )
            data['_utilisateur'] = connecte
        else:
            if existant is None:
                # Compte créé avant la V1 avec ce numéro, jamais vérifié : on ne
                # l'ouvre pas sur simple OTP (le numéro saisi a pu être erroné).
                ancien = trouver_utilisateur_par_telephone(telephone)
                if ancien and ancien.has_usable_password():
                    raise serializers.ValidationError({'detail': (
                        'Un compte existe déjà avec ce numéro. Connectez-vous avec votre '
                        'email et mot de passe, puis vérifiez votre numéro depuis votre profil.'
                    )})
            elif existant.role not in self.ROLES_AUTORISES[data['parcours']]:
                raise serializers.ValidationError({'detail': (
                    'Ce numéro est associé à un compte '
                    f'{existant.get_role_display().lower()} : connectez-vous avec email et mot de passe.'
                )})
            elif not existant.est_actif:
                raise serializers.ValidationError({'detail': 'Ce compte est désactivé.'})
            data['_utilisateur'] = existant
        return data

    def save(self):
        from django.db import transaction

        data = self.validated_data
        utilisateur = data.get('_utilisateur')
        nouveau = utilisateur is None
        with transaction.atomic():
            if nouveau:
                chiffres = data['telephone'].lstrip('+')
                utilisateur = Utilisateur.objects.create_user(
                    email=f"{chiffres}@tel.ritoto-campus.local",
                    password=None,
                    nom=data.get('nom', '') or '',
                    prenom=data.get('prenom', '') or '',
                    telephone=data['telephone'],
                    role='VENDEUR_INTERIEUR' if data['parcours'] == 'VENDEUR' else 'ETUDIANT',
                )
                utilisateur.set_unusable_password()
                utilisateur.save(update_fields=['password'])

            champs = []
            for champ in ('nom', 'prenom', 'jour_naissance', 'mois_naissance'):
                valeur = data.get(champ)
                if valeur not in (None, ''):
                    setattr(utilisateur, champ, valeur)
                    champs.append(champ)
            if data.get('universite'):
                utilisateur.universite_id = data['universite']
                champs.append('universite')
            if champs:
                utilisateur.save(update_fields=champs)
            utilisateur.marquer_telephone_verifie(data['telephone'])

        logger.info("Téléphone vérifié (%s) pour %s%s", data['parcours'], utilisateur.email,
                    ' — compte créé' if nouveau else '')
        return utilisateur, nouveau


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
