from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import Utilisateur, OTPVerification, SanctionUtilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(BaseUserAdmin):
    list_display = ['email', 'get_full_name', 'role', 'est_actif', 'date_inscription']
    list_filter = ['role', 'est_actif', 'date_inscription']
    search_fields = ['email', 'nom', 'prenom', 'telephone']
    ordering = ['-date_inscription']

    fieldsets = (
        ('Informations de connexion', {'fields': ('email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'telephone', 'date_naissance', 'adresse')}),
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
        colors = {
            'ETUDIANT': '#2196F3', 'LIVREUR': '#FF9800',
            'VENDEUR_INTERIEUR': '#4CAF50', 'VENDEUR_EXTERIEUR': '#009688',
            'CHEF_SECTEUR': '#9C27B0', 'ADMIN_UNIVERSITAIRE': '#F44336',
            'ADMIN': '#B71C1C',
        }
        color = colors.get(obj.role, 'gray')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_full_name())
    get_full_name.short_description = 'Nom complet'
    get_full_name.admin_order_field = 'nom'

    fieldsets = (
        ('Informations de connexion', {'fields': ('email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'telephone', 'date_naissance', 'adresse')}),
        ('Université & Profil étudiant', {'fields': ('universite', 'filiere', 'niveau_etude')}),
        ('Rôles et statuts', {'fields': ('role', 'est_actif')}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions'), 'classes': ('collapse',)}),
        ('Dates importantes', {'fields': ('date_inscription', 'derniere_connexion'), 'classes': ('collapse',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nom', 'prenom', 'telephone', 'universite', 'role', 'password1', 'password2'),
        }),
    )

    actions = ['activer_utilisateurs', 'desactiver_utilisateurs']

    def activer_utilisateurs(self, request, queryset):
        updated = queryset.update(est_actif=True)
        self.message_user(request, f'{updated} utilisateur(s) activé(s).')
    activer_utilisateurs.short_description = "Activer les utilisateurs sélectionnés"

    def desactiver_utilisateurs(self, request, queryset):
        updated = queryset.update(est_actif=False)
        self.message_user(request, f'{updated} utilisateur(s) désactivé(s).')
    desactiver_utilisateurs.short_description = "Désactiver les utilisateurs sélectionnés"


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ['telephone', 'code', 'est_verifie', 'date_creation', 'date_expiration']
    list_filter = ['est_verifie']
    search_fields = ['telephone']
    ordering = ['-date_creation']
    readonly_fields = ['date_creation']

    def has_add_permission(self, request):
        return False


@admin.register(SanctionUtilisateur)
class SanctionUtilisateurAdmin(admin.ModelAdmin):
    list_display = ['utilisateur', 'type_sanction', 'motif_court', 'prononce_par', 'date_debut', 'date_fin', 'est_actif']
    list_filter = ['type_sanction', 'est_actif']
    search_fields = ['utilisateur__email', 'utilisateur__nom', 'motif']
    ordering = ['-date_debut']
    readonly_fields = ['date_debut']
    actions = ['lever_sanctions']

    def motif_court(self, obj):
        return obj.motif[:60] + '...' if len(obj.motif) > 60 else obj.motif
    motif_court.short_description = 'Motif'

    def lever_sanctions(self, request, queryset):
        for sanction in queryset:
            sanction.lever()
        self.message_user(request, f'{queryset.count()} sanction(s) levée(s).')
    lever_sanctions.short_description = 'Lever les sanctions sélectionnées'
