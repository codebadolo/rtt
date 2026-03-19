from rest_framework import permissions

class EstAuthentifie(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est authentifié et actif
    """
    def has_permission(self, request, view):
        return (request.user and 
                request.user.is_authenticated and 
                request.user.est_actif)


class EstEtudiant(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est un étudiant actif
    """
    message = "Seuls les étudiants peuvent effectuer cette action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.est_etudiant and request.user.est_actif


class EstChefSecteur(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est un chef de secteur actif
    """
    message = "Seuls les chefs de secteur peuvent effectuer cette action."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.est_chef_secteur and 
                request.user.est_actif)


class EstChefSecteurOuAdmin(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est un chef de secteur ou un admin
    """
    message = "Seuls les chefs de secteur et les administrateurs peuvent effectuer cette action."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return ((request.user.est_chef_secteur or request.user.est_admin) and 
                request.user.est_actif)
    
    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True
        
        # Pour les chefs de secteur, vérifier l'accès à l'objet
        if request.user.est_chef_secteur:
            # Si l'objet a un attribut secteur
            if hasattr(obj, 'secteur'):
                return obj.secteur.chefs.filter(id=request.user.id).exists()
            # Si l'objet est un secteur
            if hasattr(obj, 'chefs'):
                return obj.chefs.filter(id=request.user.id).exists()
        return False


class EstLivreur(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est un livreur actif
    """
    message = "Seuls les livreurs peuvent effectuer cette action."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.est_livreur and 
                request.user.est_actif)


class EstAdmin(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est un administrateur
    """
    message = "Seuls les administrateurs peuvent effectuer cette action."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (request.user.est_admin and 
                request.user.est_actif)


class EstProprietaireOuAdmin(permissions.BasePermission):
    """
    Vérifie que l'utilisateur est le propriétaire de l'objet ou un admin
    """
    message = "Vous n'êtes pas autorisé à modifier cette ressource."
    
    def has_object_permission(self, request, view, obj):
        # Admin peut tout faire
        if request.user.est_admin:
            return True
        
        # Vérifier la propriété selon le type d'objet
        if hasattr(obj, 'utilisateur'):
            return obj.utilisateur == request.user
        elif hasattr(obj, 'etudiant'):
            return obj.etudiant == request.user
        elif hasattr(obj, 'id'):
            return obj == request.user
        
        return False


class EstDansSecteur(permissions.BasePermission):
    """
    Vérifie que l'utilisateur appartient au secteur concerné
    """
    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True
        
        if request.user.est_chef_secteur:
            if hasattr(obj, 'secteur'):
                return obj.secteur.chefs.filter(id=request.user.id).exists()

        return False


class PeutValiderCommande(permissions.BasePermission):
    """
    Vérifie que l'utilisateur peut valider une commande
    """
    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True

        if request.user.est_chef_secteur:
            return obj.secteur.chefs.filter(id=request.user.id).exists()
        
        return False


class PeutDistribuerCommande(permissions.BasePermission):
    """
    Vérifie que le livreur peut distribuer la commande
    """
    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True
        
        if request.user.est_livreur:
            # Vérifier que le livreur est assigné à la salle
            return (request.user == obj.salle.livreur_1 or 
                    request.user == obj.salle.livreur_2)
        
        return False
