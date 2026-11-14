from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import login, logout
from django.utils import timezone
from django.db.models import Q
from django.conf import settings
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied, NotFound
from django_filters.rest_framework import DjangoFilterBackend
from .models import Utilisateur, DossierKYC, OTPVerification, ParcoursIdentification
from .serializers import (
    InscriptionGoogleSerializer, InscriptionSerializer, CreationUtilisateurAdminSerializer,
    ConnexionSerializer,
    UtilisateurListSerializer, UtilisateurDetailSerializer,
    ChangementMotDePasseSerializer, DemandeReinitialisationSerializer,
    ReinitialisationMotDePasseSerializer,
    OTPEnvoyerSerializer, OTPVerifierSerializer, DossierKYCSerializer,
    ParcoursIdentificationSerializer, ParcoursDemarrerSerializer, ParcoursInfosSerializer,
    ParcoursTelephoneSerializer, ParcoursOTPSerializer, VerificationTelephoneSerializer,
)
from .permissions import (
    EstAuthentifie, EstAdmin, EstEtudiant,
    EstProprietaireOuAdmin,
)
import logging

logger = logging.getLogger(__name__)


# ──────────────────── VIEWSET AUTHENTIFICATION ────────────────────
class AuthViewSet(viewsets.GenericViewSet):
    """
    API d'authentification
    """
    permission_classes = [AllowAny]
    serializer_class = None
    
    def get_serializer_class(self):
        if self.action == 'inscription_google':
            return InscriptionGoogleSerializer
        elif self.action == 'inscription':
            return InscriptionSerializer
        elif self.action == 'connexion':
            return ConnexionSerializer
        elif self.action == 'changer_mot_de_passe':
            return ChangementMotDePasseSerializer
        elif self.action == 'demande_reinitialisation':
            return DemandeReinitialisationSerializer
        elif self.action == 'reinitialiser_mot_de_passe':
            return ReinitialisationMotDePasseSerializer
        elif self.action == 'profil':
            return UtilisateurDetailSerializer
        return super().get_serializer_class()
    
    @action(detail=False, methods=['post'], url_path='inscription')
    def inscription(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.id,
            'email': user.email,
            'nom_complet': f"{user.prenom} {user.nom}",
            'role': user.role,
            'message': 'Inscription réussie'
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='inscription-google')
    def inscription_google(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        logger.info(f"Nouvel utilisateur créé via Google: {user.email}")
        return Response({
            'token': token.key,
            'user_id': user.id,
            'email': user.email,
            'nom_complet': user.get_full_name(),
            'role': user.role,
            'message': 'Inscription réussie'
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='connexion')
    def connexion(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)
        logger.info(f"Connexion réussie: {user.email}")
        return Response({
            'token': token.key,
            'user_id': user.id,
            'email': user.email,
            'nom_complet': user.get_full_name(),
            'role': user.role,
        })
    
    @action(detail=False, methods=['post'], url_path='deconnexion')
    def deconnexion(self, request):
        if request.user.is_authenticated:
            email = request.user.email
            Token.objects.filter(user=request.user).delete()
            logout(request)
            logger.info(f"Déconnexion: {email}")
        return Response({'message': 'Déconnexion réussie'})
    
    @action(detail=False, methods=['get', 'patch'], url_path='profil')
    def profil(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Non authentifié'}, status=status.HTTP_401_UNAUTHORIZED)
        if request.method == 'PATCH':
            # Niveaux du parcours : nom/prénom, jour/mois de naissance, université.
            # Le téléphone ne se modifie que via la vérification OTP.
            champs = ('nom', 'prenom', 'jour_naissance', 'mois_naissance', 'universite', 'adresse')
            data = {k: v for k, v in request.data.items() if k in champs}
            serializer = self.get_serializer(request.user, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='changer-mot-de-passe')
    def changer_mot_de_passe(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Non authentifié'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Mot de passe modifié avec succès'})
    
    @action(detail=False, methods=['post'], url_path='demande-reinitialisation')
    def demande_reinitialisation(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        return Response({'message': 'Si l\'email existe, un lien de réinitialisation a été envoyé'})
    
    @action(detail=False, methods=['post'], url_path='reinitialiser-mot-de-passe')
    def reinitialiser_mot_de_passe(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Mot de passe réinitialisé avec succès'})

    @action(detail=False, methods=['post'], url_path='connexion-google')
    def connexion_google(self, request):
        """
        Vérifie un access_token Google via l'endpoint userinfo.
        - Si l'utilisateur existe → connexion directe (retourne le token auth)
        - Si l'utilisateur n'existe pas → retourne le profil Google pour pré-remplir l'inscription
        """
        import requests as http_requests

        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token Google manquant'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = http_requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )
            if resp.status_code != 200:
                raise ValueError(f"userinfo HTTP {resp.status_code}")
            idinfo = resp.json()
        except Exception as e:
            logger.warning(f"Token Google invalide: {e}")
            return Response({'error': 'Token Google invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)

        email = idinfo.get('email')
        google_id = idinfo.get('sub')

        # Chercher l'utilisateur par google_id ou email
        try:
            user = Utilisateur.objects.get(Q(google_id=google_id) | Q(email=email))
            # Mettre à jour les champs Google s'ils manquent
            update_fields = []
            if not user.google_id:
                user.google_id = google_id
                update_fields.append('google_id')
            if not user.photo_profil and idinfo.get('picture'):
                user.photo_profil = idinfo.get('picture')
                update_fields.append('photo_profil')
            if update_fields:
                user.save(update_fields=update_fields)

            if not user.est_actif:
                return Response({'error': 'Ce compte est désactivé'}, status=status.HTTP_403_FORBIDDEN)

            user.marquer_connexion()
            auth_token, _ = Token.objects.get_or_create(user=user)
            logger.info(f"Connexion Google réussie: {user.email}")
            return Response({
                'action': 'login',
                'token': auth_token.key,
                'user_id': user.id,
                'email': user.email,
                'nom_complet': user.get_full_name(),
                'role': user.role,
            })

        except Utilisateur.DoesNotExist:
            # Aucun compte trouvé → retourner le profil pour pré-remplir l'inscription
            logger.info(f"Aucun compte Google trouvé pour: {email}")
            return Response({
                'action': 'register',
                'profile': {
                    'email': email,
                    'prenom': idinfo.get('given_name', ''),
                    'nom': idinfo.get('family_name', ''),
                    'photo': idinfo.get('picture', ''),
                    'google_id': google_id,
                    'token': token,
                },
            }, status=status.HTTP_200_OK)


# ──────────────────── VIEWSET UTILISATEUR ────────────────────
class UtilisateurViewSet(viewsets.ModelViewSet):
    """
    API de gestion des utilisateurs
    """
    queryset = Utilisateur.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UtilisateurListSerializer
        return UtilisateurDetailSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [IsAuthenticated]
        elif self.action in ['create', 'destroy']:
            self.permission_classes = [EstAdmin]
        elif self.action in ['update', 'partial_update']:
            self.permission_classes = [EstProprietaireOuAdmin]
        else:
            self.permission_classes = [IsAuthenticated]
        return [permission() for permission in self.permission_classes]
    
    def create(self, request, *args, **kwargs):
        serializer = CreationUtilisateurAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UtilisateurDetailSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filtrer par rôle si le paramètre est présent
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
            logger.info(f"Filtrage par rôle: {role}, trouvé: {queryset.count()} utilisateurs")
        
        # Les admins voient tout
        if hasattr(self.request.user, 'est_admin') and self.request.user.est_admin:
            return queryset
        
        # Les autres voient seulement leur propre compte
        if self.request.user.is_authenticated:
            return queryset.filter(id=self.request.user.id)
        
        return queryset.none()
    
    @action(detail=False, methods=['get'], url_path='par-role')
    def par_role(self, request):
        """
        Liste les utilisateurs par rôle (endpoint dédié)
        """
        role = request.query_params.get('role')
        if not role:
            return Response(
                {'error': 'Le paramètre "role" est requis'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.info(f"Endpoint par-role appelé avec rôle: {role}")
        utilisateurs = self.queryset.filter(role=role)
        serializer = UtilisateurListSerializer(utilisateurs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='commandes')
    def commandes(self, request, pk=None):
        """
        Récupère les commandes d'un utilisateur
        """
        from apps.commandes.models import Commande
        
        try:
            utilisateur = self.get_object()
            commandes = Commande.objects.filter(etudiant=utilisateur).order_by('-date_creation')
            
            data = []
            for cmd in commandes:
                data.append({
                    'id': cmd.id,
                    'numero': cmd.numero_commande,
                    'date': cmd.date_creation,
                    'total': float(cmd.total_ttc),
                    'statut': cmd.statut
                })
            
            return Response(data)
        except Exception as e:
            logger.error(f"Erreur récupération commandes: {str(e)}")
            return Response([], status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Active ou désactive un utilisateur
        """
        try:
            utilisateur = self.get_object()
            utilisateur.est_actif = not utilisateur.est_actif
            utilisateur.save()
            return Response({
                'message': f"Utilisateur {'activé' if utilisateur.est_actif else 'désactivé'}",
                'est_actif': utilisateur.est_actif
            })
        except Exception as e:
            logger.error(f"Erreur toggle status: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='salles')
    def salles(self, request, pk=None):
        """Salles assignées à un livreur (livreur_1 ou livreur_2)."""
        from apps.administration.models import Salle
        utilisateur = self.get_object()
        qs = Salle.objects.filter(
            livreur_1=utilisateur
        ) | Salle.objects.filter(livreur_2=utilisateur)
        data = []
        for s in qs.select_related('secteur').distinct():
            data.append({
                'id': s.id,
                'code': s.code,
                'nom': s.nom,
                'batiment': s.batiment,
                'etage': s.etage,
                'secteur_nom': s.secteur.nom,
                'secteur_code': s.secteur.code,
                'role': 'Livreur 1' if s.livreur_1_id == utilisateur.pk else 'Livreur 2',
                'est_actif': s.est_actif,
            })
        return Response(data)

    @action(detail=True, methods=['get'], url_path='secteurs')
    def secteurs(self, request, pk=None):
        """Secteurs supervisés par un chef de secteur."""
        from apps.administration.models import Secteur
        utilisateur = self.get_object()
        qs = Secteur.objects.filter(chefs=utilisateur)
        data = []
        for sec in qs:
            data.append({
                'id': sec.id,
                'code': sec.code,
                'nom': sec.nom,
                'description': sec.description,
                'nombre_salles': sec.salles.filter(est_actif=True).count(),
                'est_actif': sec.est_actif,
            })
        return Response(data)

    @action(detail=True, methods=['post'], url_path='changer-role',
            permission_classes=[EstAdmin])
    def changer_role(self, request, pk=None):
        """
        Change le rôle d'un utilisateur. Réservé aux administrateurs.
        """
        ROLES_VALIDES = ['ETUDIANT', 'CHEF_SECTEUR', 'ADMIN', 'LIVREUR']
        nouveau_role = request.data.get('role', '').strip()
        if nouveau_role not in ROLES_VALIDES:
            return Response(
                {'error': f'Rôle invalide. Valeurs acceptées : {", ".join(ROLES_VALIDES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        utilisateur = self.get_object()
        ancien_role = utilisateur.role
        utilisateur.role = nouveau_role
        utilisateur.is_staff = (nouveau_role == 'ADMIN')
        utilisateur.save(update_fields=['role', 'is_staff'])
        logger.info(
            f"Rôle modifié par {request.user.email}: {utilisateur.email} "
            f"{ancien_role} → {nouveau_role}"
        )
        return Response({'message': 'Rôle modifié avec succès', 'role': nouveau_role})

    @action(detail=False, methods=['post'], url_path='basculer-service')
    def basculer_service(self, request):
        """
        Interrupteur En service / Hors service du livreur connecté (§3.4).
        """
        user = request.user
        if not (hasattr(user, 'est_livreur') and user.est_livreur):
            return Response({'error': 'Réservé aux livreurs'}, status=status.HTTP_403_FORBIDDEN)

        profil = getattr(user, 'profil_livreur', None)
        if profil is None:
            return Response({'error': 'Profil livreur introuvable'}, status=status.HTTP_400_BAD_REQUEST)
        if not profil.est_valide:
            return Response({'error': 'Votre profil livreur n\'est pas encore validé'}, status=status.HTTP_403_FORBIDDEN)

        en_service = profil.basculer_service()
        return Response({'en_service': en_service})

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """
        Réinitialise le mot de passe d'un utilisateur
        """
        try:
            utilisateur = self.get_object()
            import secrets
            import string
            
            alphabet = string.ascii_letters + string.digits
            temp_password = ''.join(secrets.choice(alphabet) for i in range(10))
            
            utilisateur.set_password(temp_password)
            utilisateur.save()
            
            return Response({
                'message': 'Mot de passe réinitialisé',
                'temp_password': temp_password
            })
        except Exception as e:
            logger.error(f"Erreur reset password: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ──────────────────── OTP INSCRIPTION ────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def otp_envoyer_view(request):
    """POST /api/auth/otp/envoyer/ — envoie le code OTP (WhatsApp puis SMS, §3.1)."""
    serializer = OTPEnvoyerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    resultat = serializer.save()
    return Response({'message': 'Code envoyé', **resultat})


@api_view(['POST'])
@permission_classes([AllowAny])
def otp_verifier_view(request):
    """POST /api/auth/otp/verifier/ — vérifie le code OTP saisi."""
    serializer = OTPVerifierSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response({'verifie': True})


# ──────────────────── PARCOURS D'IDENTIFICATION PROGRESSIF ────────────────────
class ParcoursIdentificationViewSet(viewsets.GenericViewSet):
    """
    Parcours d'identification par niveaux, sans compte préalable.

    POST   /api/parcours/                          démarrer (université choisie)
    GET    /api/parcours/{token}/                  état : niveaux validés / à compléter
    PATCH  /api/parcours/{token}/                  niveaux 1-2 : nom, prénom, jour+mois
    POST   /api/parcours/{token}/telephone/        niveau 3 : numéro + envoi OTP SMS
    POST   /api/parcours/{token}/verifier-otp/     niveau 4 : vérifie le numéro

    La vérification OTP rattache (ou crée) le compte et renvoie un token
    d'authentification. Elle NE crée NI ne valide aucune commande : la
    commande suit son propre circuit (récapitulatif → paiement).
    Une fois un compte rattaché, le parcours n'est accessible qu'à ce compte.
    """
    permission_classes = [AllowAny]
    serializer_class = ParcoursIdentificationSerializer
    lookup_field = 'token'
    lookup_value_regex = '[0-9a-fA-F-]{36}'

    def get_object(self):
        try:
            parcours = ParcoursIdentification.objects.select_related('utilisateur').get(
                token=self.kwargs['token'],
            )
        except (ParcoursIdentification.DoesNotExist, DjangoValidationError, ValueError):
            raise NotFound('Parcours introuvable.')
        if parcours.est_expire:
            raise NotFound('Parcours expiré, veuillez recommencer.')
        if parcours.utilisateur_id and self.request.user != parcours.utilisateur:
            raise PermissionDenied('Connectez-vous avec le compte rattaché pour poursuivre ce parcours.')
        return parcours

    def _etat(self, parcours, status_code=status.HTTP_200_OK):
        return Response(ParcoursIdentificationSerializer(parcours).data, status=status_code)

    def create(self, request):
        serializer = ParcoursDemarrerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcours = ParcoursIdentification(**serializer.validated_data)
        user = request.user
        if user.is_authenticated:
            # Compte existant (ex. ancien compte email) : on reprend ses informations
            if not role_compatible(parcours, user):
                return Response(
                    {'error': "Ce parcours n'est pas disponible pour votre type de compte."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            parcours.utilisateur = user
            parcours.telephone = user.telephone or ''
        parcours.save()
        if user.is_authenticated and parcours.universite and user.est_etudiant:
            user.universite = parcours.universite
            user.save(update_fields=['universite'])
        return self._etat(parcours, status.HTTP_201_CREATED)

    def retrieve(self, request, token=None):
        return self._etat(self.get_object())

    def partial_update(self, request, token=None):
        parcours = self.get_object()
        serializer = ParcoursInfosSerializer(data=request.data, context={'parcours': parcours})
        serializer.is_valid(raise_exception=True)
        parcours.appliquer(**serializer.validated_data)
        return self._etat(parcours)

    @action(detail=True, methods=['post'], url_path='telephone')
    def telephone(self, request, token=None):
        from .otp_sender import envoyer_code_otp, EnvoiOTPErreur

        parcours = self.get_object()
        serializer = ParcoursTelephoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        telephone = serializer.validated_data['telephone']

        autorise, message, delai = OTPVerification.peut_envoyer(telephone)
        if not autorise:
            return Response({'error': message, 'delai_renvoi': delai},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = OTPVerification.generer(telephone)
        try:
            resultat = envoyer_code_otp(telephone, otp.code)
        except EnvoiOTPErreur as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        parcours.telephone = telephone
        parcours.date_envoi_otp = timezone.now()
        parcours.save(update_fields=['telephone', 'date_envoi_otp', 'date_modification'])

        data = ParcoursIdentificationSerializer(parcours).data
        data['message'] = 'Un code de vérification a été envoyé par SMS.'
        data['envoi'] = resultat
        return Response(data)

    @action(detail=True, methods=['post'], url_path='verifier-otp')
    def verifier_otp(self, request, token=None):
        parcours = self.get_object()
        serializer = ParcoursOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not parcours.telephone:
            return Response({'error': "Renseignez d'abord votre numéro de téléphone."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not OTPVerification.verifier(parcours.telephone, serializer.validated_data['code']):
            return Response({'error': 'Code invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                user, erreur = rattacher_compte(parcours)
                if erreur:
                    transaction.set_rollback(True)
                    return erreur
        except IntegrityError:
            return Response({'error': 'Ce numéro est déjà associé à un autre compte.'},
                            status=status.HTTP_409_CONFLICT)

        user.marquer_connexion()
        auth_token, _ = Token.objects.get_or_create(user=user)
        est_vendeur = parcours.type_parcours == ParcoursIdentification.Type.VENDEUR
        return Response({
            'message': (
                'Téléphone vérifié. Complétez maintenant les informations de votre boutique.'
                if est_vendeur else
                "Téléphone vérifié. Votre commande n'est pas encore validée : "
                'vérifiez le récapitulatif puis procédez au paiement.'
            ),
            'telephone_verifie': True,
            'token': auth_token.key,
            'user_id': user.id,
            'nom_complet': user.get_full_name(),
            'role': user.role,
            'profil_etudiant_actif': user.profil_etudiant_actif,
            'parcours': ParcoursIdentificationSerializer(parcours).data,
        })


def role_compatible(parcours, user):
    if parcours.type_parcours == ParcoursIdentification.Type.ETUDIANT:
        return user.role == Utilisateur.Role.ETUDIANT
    return user.role in (Utilisateur.Role.VENDEUR, Utilisateur.Role.ETUDIANT)


def rattacher_compte(parcours, creer_profil_vendeur=True):
    """
    Retrouve ou crée le compte correspondant au numéro vérifié, y reporte
    les informations du parcours sans écraser celles déjà enregistrées.
    Retourne (utilisateur, None) ou (None, Response d'erreur).
    """
    from .telephone import trouver_utilisateur_par_telephone

    telephone = parcours.telephone
    existant = Utilisateur.objects.select_for_update().filter(
        telephone=telephone, telephone_verifie=True,
    ).first()

    if parcours.utilisateur_id:
        user = parcours.utilisateur
        if existant and existant.pk != user.pk:
            return None, Response({'error': 'Ce numéro est déjà associé à un autre compte.'},
                                  status=status.HTTP_409_CONFLICT)
    elif existant:
        user = existant
    else:
        # Compte créé avant la V1 avec ce numéro, jamais vérifié : on ne
        # l'ouvre pas sur simple OTP (le numéro saisi a pu être erroné).
        ancien = trouver_utilisateur_par_telephone(telephone)
        if ancien and ancien.has_usable_password():
            return None, Response({'error': (
                'Un compte existe déjà avec ce numéro. Connectez-vous avec votre email '
                'et mot de passe, puis vérifiez votre numéro depuis votre profil.'
            )}, status=status.HTTP_409_CONFLICT)
        user = Utilisateur.objects.create_user(
            email=None,
            telephone=telephone,
            nom=parcours.nom,
            prenom=parcours.prenom,
            role=(Utilisateur.Role.ETUDIANT
                  if parcours.type_parcours == ParcoursIdentification.Type.ETUDIANT
                  else Utilisateur.Role.VENDEUR),
            universite=parcours.universite,
        )

    if not user.est_actif:
        return None, Response({'error': 'Ce compte est désactivé.'}, status=status.HTTP_403_FORBIDDEN)
    if not role_compatible(parcours, user):
        return None, Response(
            {'error': 'Ce numéro est associé à un autre type de compte. Connectez-vous avec ce compte.'},
            status=status.HTTP_409_CONFLICT,
        )

    # Report des informations du parcours (champs encore vides uniquement)
    champs = []
    for champ in ('nom', 'prenom', 'jour_naissance', 'mois_naissance'):
        valeur = getattr(parcours, champ)
        if valeur and not getattr(user, champ):
            setattr(user, champ, valeur)
            champs.append(champ)
    if parcours.universite_id and user.universite_id != parcours.universite_id \
            and (user.est_etudiant or not user.universite_id):
        user.universite = parcours.universite
        champs.append('universite')
    if parcours.type_parcours == ParcoursIdentification.Type.VENDEUR and user.est_etudiant:
        user.role = Utilisateur.Role.VENDEUR
        champs.append('role')
    if champs:
        user.save(update_fields=champs)
    user.marquer_telephone_verifie(telephone)

    if creer_profil_vendeur and parcours.type_parcours == ParcoursIdentification.Type.VENDEUR:
        from apps.administration.models import ProfilVendeur
        ProfilVendeur.objects.get_or_create(
            utilisateur=user,
            defaults={'universite': parcours.universite, 'nom_boutique': ''},
        )

    parcours.utilisateur = user
    parcours.save(update_fields=['utilisateur', 'date_modification'])
    return user, None


@api_view(['POST'])
@permission_classes([AllowAny])
def parcours_verifier_telephone_view(request):
    """
    POST /api/auth/parcours/verifier-telephone/

    Variante en un appel du parcours /api/parcours/ : le client envoie les
    niveaux déjà saisis (nom, prénom, jour/mois, université) avec le code
    OTP reçu via /api/auth/otp/envoyer/. Même logique de rattachement ; la
    boutique du vendeur est créée ensuite par POST /api/profil/vendeur/.
    Ne crée ni ne valide aucune commande.
    """
    serializer = VerificationTelephoneSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    if not OTPVerification.verifier(data['telephone'], data['code']):
        return Response({'code': ['Code invalide ou expiré.']}, status=status.HTTP_400_BAD_REQUEST)

    parcours = ParcoursIdentification(
        type_parcours=data['parcours'], telephone=data['telephone'],
        universite=data.get('universite'),
        nom=(data.get('nom') or '').strip(), prenom=(data.get('prenom') or '').strip(),
        jour_naissance=data.get('jour_naissance'), mois_naissance=data.get('mois_naissance'),
    )
    if request.user.is_authenticated:
        parcours.utilisateur = request.user
    else:
        # Connexion par téléphone d'un vendeur déjà inscrit
        existant = Utilisateur.objects.filter(telephone=data['telephone'], telephone_verifie=True).first()
        if existant and existant.role == Utilisateur.Role.VENDEUR:
            parcours.type_parcours = ParcoursIdentification.Type.VENDEUR
    parcours.save()

    nouveau = not Utilisateur.objects.filter(telephone=data['telephone'], telephone_verifie=True).exists() \
        and parcours.utilisateur_id is None
    try:
        with transaction.atomic():
            user, erreur = rattacher_compte(parcours, creer_profil_vendeur=False)
            if erreur:
                transaction.set_rollback(True)
                return erreur
    except IntegrityError:
        return Response({'error': 'Ce numéro est déjà associé à un autre compte.'},
                        status=status.HTTP_409_CONFLICT)

    # Les niveaux ressaisis par le client mettent à jour le compte
    champs = [c for c in ('nom', 'prenom', 'jour_naissance', 'mois_naissance')
              if getattr(parcours, c) not in (None, '') and getattr(user, c) != getattr(parcours, c)]
    for c in champs:
        setattr(user, c, getattr(parcours, c))
    if champs:
        user.save(update_fields=champs)

    user.marquer_connexion()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'nouveau_compte': nouveau,
        'user': UtilisateurDetailSerializer(user).data,
    }, status=status.HTTP_201_CREATED if nouveau else status.HTTP_200_OK)


# ──────────────────── VIEWSET KYC (carte étudiant) ────────────────────
class DossierKYCViewSet(viewsets.ModelViewSet):
    """
    Dossier de vérification de carte étudiant.
    - Étudiant : crée/consulte son propre dossier
    - Admin : consulte tous les dossiers, valide/rejette
    """
    serializer_class = DossierKYCSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['statut', 'utilisateur']
    search_fields = ['utilisateur__nom', 'utilisateur__prenom', 'utilisateur__email', 'numero_carte']

    def get_queryset(self):
        user = self.request.user
        qs = DossierKYC.objects.select_related('utilisateur', 'verifie_par').all()
        if hasattr(user, 'est_admin') and user.est_admin:
            return qs
        return qs.filter(utilisateur=user)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'], url_path='valider', permission_classes=[EstAdmin])
    def valider(self, request, pk=None):
        dossier = self.get_object()
        dossier.valider(request.user)
        return Response(DossierKYCSerializer(dossier).data)

    @action(detail=True, methods=['post'], url_path='rejeter', permission_classes=[EstAdmin])
    def rejeter(self, request, pk=None):
        dossier = self.get_object()
        motif = request.data.get('motif_rejet', '') or request.data.get('motif', '')
        if not motif:
            return Response({'error': 'Le motif est requis'}, status=status.HTTP_400_BAD_REQUEST)
        dossier.rejeter(request.user, motif)
        return Response(DossierKYCSerializer(dossier).data)

    @action(detail=False, methods=['get'], url_path='statistiques', permission_classes=[EstAdmin])
    def statistiques(self, request):
        total_etudiants = Utilisateur.objects.filter(role='ETUDIANT').count()
        en_attente = DossierKYC.objects.filter(statut='EN_ATTENTE').count()
        valides = DossierKYC.objects.filter(statut='VALIDE').count()
        rejetes = DossierKYC.objects.filter(statut='REJETE').count()
        soumis = DossierKYC.objects.count()
        non_soumis = max(0, total_etudiants - soumis)
        taux = round(100 * valides / total_etudiants) if total_etudiants else 0
        return Response({
            'total_etudiants': total_etudiants,
            'en_attente': en_attente,
            'valides': valides,
            'rejetes': rejetes,
            'non_soumis': non_soumis,
            'taux_completion': taux,
        })
