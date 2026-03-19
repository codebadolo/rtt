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
    Permission pour gérer les produits (admin seulement)
    """
    def has_permission(self, request, view):
        return request.user and request.user.est_admin


class PeutGererSecteurs(permissions.BasePermission):
    """
    Permission pour gérer les secteurs (admin seulement)
    """
    def has_permission(self, request, view):
        return request.user and request.user.est_admin
