from rest_framework import permissions

class EstAdminOuLectureSeule(permissions.BasePermission):
    """
    Permission: Admin peut tout faire, les autres en lecture seule
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.est_admin


class EstAdmin(permissions.BasePermission):
    """
    Permission: Seul l'admin peut accéder
    """
    def has_permission(self, request, view):
        return request.user and request.user.est_admin


class PeutGererProduits(permissions.BasePermission):
    """
    Permission pour gérer les produits : admin, ou vendeur pour le catalogue
    de sa propre boutique (sauf boutique refusée).
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.est_admin:
            return True
        profil = getattr(user, 'profil_vendeur', None) if user.est_vendeur else None
        return bool(profil) and profil.statut_validation != profil.StatutValidation.REFUSE

    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True
        profil = getattr(request.user, 'profil_vendeur', None)
        return bool(profil) and obj.vendeur_id == profil.id


class PeutGererSecteurs(permissions.BasePermission):
    """
    Permission pour gérer les secteurs (admin seulement)
    """
    def has_permission(self, request, view):
        return request.user and request.user.est_admin
