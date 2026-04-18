from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import login, logout
from django.utils import timezone
from django.db.models import Q
from django.conf import settings
from .models import Utilisateur
from .serializers import (
    InscriptionGoogleSerializer, InscriptionSerializer, ConnexionSerializer,
    UtilisateurListSerializer, UtilisateurDetailSerializer,
    ChangementMotDePasseSerializer, DemandeReinitialisationSerializer,
    ReinitialisationMotDePasseSerializer,
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
            Token.objects.filter(user=request.user).delete()
            logout(request)
            logger.info(f"Déconnexion: {request.user.email}")
        return Response({'message': 'Déconnexion réussie'})
    
    @action(detail=False, methods=['get'], url_path='profil')
    def profil(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Non authentifié'}, status=status.HTTP_401_UNAUTHORIZED)
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
