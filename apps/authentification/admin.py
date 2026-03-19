from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(BaseUserAdmin):
    list_display = ['email', 'get_full_name', 'role', 'est_actif', 'date_inscription']
    list_filter = ['role', 'est_actif', 'date_inscription']
    search_fields = ['email', 'nom', 'prenom', 'matricule', 'telephone']
    ordering = ['-date_inscription']

    fieldsets = (
        ('Informations de connexion', {'fields': ('email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'matricule', 'telephone', 'date_naissance', 'adresse')}),
        ('Rôles et statuts', {'fields': ('role', 'est_actif')}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions'), 'classes': ('collapse',)}),
        ('Dates importantes', {'fields': ('date_inscription', 'derniere_connexion'), 'classes': ('collapse',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nom', 'prenom', 'telephone', 'password1', 'password2', 'role'),
        }),
    )

    readonly_fields = ['date_inscription', 'derniere_connexion']

    def get_full_name(self, obj):
        colors = {'ETUDIANT': 'blue', 'CHEF_SECTEUR': 'green', 'ADMIN': 'red', 'LIVREUR': 'orange'}
        color = colors.get(obj.role, 'gray')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_full_name())
    get_full_name.short_description = 'Nom complet'
    get_full_name.admin_order_field = 'nom'

    actions = ['activer_utilisateurs', 'desactiver_utilisateurs']

    def activer_utilisateurs(self, request, queryset):
        updated = queryset.update(est_actif=True)
        self.message_user(request, f'{updated} utilisateur(s) activé(s).')
    activer_utilisateurs.short_description = "Activer les utilisateurs sélectionnés"

    def desactiver_utilisateurs(self, request, queryset):
        updated = queryset.update(est_actif=False)
        self.message_user(request, f'{updated} utilisateur(s) désactivé(s).')
    desactiver_utilisateurs.short_description = "Désactiver les utilisateurs sélectionnés"
