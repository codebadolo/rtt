from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from django.db.models import Sum, Count
from .models import Commande, LigneCommande, OptionLigneCommande, HistoriqueCommande, ClotureJournaliere, PaiementSenfenico, Plainte

# ──────────────────── ADMIN LIGNE COMMANDE (INLINE) ────────────────────
class OptionLigneCommandeInline(admin.TabularInline):
    """Inline pour les options dans une ligne de commande"""
    model = OptionLigneCommande
    extra = 0
    readonly_fields = ['option', 'prix_applique']
    can_delete = False

class LigneCommandeInline(admin.TabularInline):
    """Inline pour les lignes dans une commande"""
    model = LigneCommande
    extra = 0
    readonly_fields = ['produit', 'variante', 'quantite', 'prix_unitaire', 'sous_total']
    inlines = [OptionLigneCommandeInline]
    can_delete = False


# ──────────────────── ADMIN COMMANDE ────────────────────
@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les commandes
    """
    list_display = [
        'numero_commande',
        'etudiant_nom',
        'secteur_nom',
        'salle_nom',
        'total_ttc_format',
        'statut_badge',
        'date_creation_courte'
    ]
    list_filter = [
        'statut',
        'secteur',
        'methode_paiement',
        'date_creation'
    ]
    search_fields = [
        'numero_commande',
        'etudiant__email',
        'etudiant__nom',
        'etudiant__prenom',
        'reference_paiement'
    ]
    ordering = ['-date_creation']
    
    fieldsets = (
        ('Informations commande', {
            'fields': ('numero_commande', 'statut', 'date_creation')
        }),
        ('Client', {
            'fields': ('etudiant', 'secteur', 'salle')
        }),
        ('Détails commande', {
            'fields': ('description_besoin', 'heure_souhaitee')
        }),
        ('Paiement', {
            'fields': ('methode_paiement', 'telephone_paiement', 'reference_paiement', 'capture_paiement', 'total_ht', 'total_ttc')
        }),
        ('Validation', {
            'fields': ('valide_par', 'date_validation', 'motif_rejet'),
            'classes': ('collapse',)
        }),
        ('Distribution', {
            'fields': ('distribue_par', 'date_distribution'),
            'classes': ('collapse',)
        }),
        ('Métadonnées', {
            'fields': ('ip_creation',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = [
        'numero_commande',
        'total_ht',
        'total_ttc',
        'date_creation',
        'date_modification',
        'apercu_capture'
    ]
    
    inlines = [LigneCommandeInline]
    
    def etudiant_nom(self, obj):
        """Affiche le nom de l'étudiant avec un lien"""
        url = reverse('admin:authentification_utilisateur_change', args=[obj.etudiant.id])
        return format_html('<a href="{}">{}</a>', url, obj.etudiant.get_full_name())
    etudiant_nom.short_description = 'Étudiant'
    etudiant_nom.admin_order_field = 'etudiant__nom'
    
    def secteur_nom(self, obj):
        """Affiche le secteur avec un lien"""
        url = reverse('admin:administration_secteur_change', args=[obj.secteur.id])
        return format_html('<a href="{}">{}</a>', url, obj.secteur.nom)
    secteur_nom.short_description = 'Secteur'
    
    def salle_nom(self, obj):
        """Affiche la salle avec un lien"""
        url = reverse('admin:administration_salle_change', args=[obj.salle.id])
        return format_html('<a href="{}">{}</a>', url, obj.salle.nom)
    salle_nom.short_description = 'Salle'
    
    def total_ttc_format(self, obj):
        """Affiche le total formaté"""
        return format_html(
            '<span style="font-weight: bold; color: #4CAF50;">{} FCFA</span>',
            obj.total_ttc
        )
    total_ttc_format.short_description = 'Total'
    total_ttc_format.admin_order_field = 'total_ttc'
    
    def statut_badge(self, obj):
        """Affiche un badge coloré pour le statut"""
        colors = {
            'BROUILLON': '#9E9E9E',
            'EN_ATTENTE': '#FF9800',
            'VALIDEE': '#4CAF50',
            'REJETEE': '#F44336',
            'PRETE': '#2196F3',
            'DISTRIBUEE': '#9C27B0',
            'ANNULEE': '#795548'
        }
        color = colors.get(obj.statut, '#9E9E9E')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color,
            obj.get_statut_display()
        )
    statut_badge.short_description = 'Statut'
    statut_badge.admin_order_field = 'statut'
    
    def date_creation_courte(self, obj):
        """Affiche la date de création formatée"""
        return obj.date_creation.strftime('%d/%m/%Y %H:%M')
    date_creation_courte.short_description = 'Créée le'
    date_creation_courte.admin_order_field = 'date_creation'
    
    def apercu_capture(self, obj):
        """Affiche un aperçu de la capture de paiement"""
        if obj.capture_paiement:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-width: 200px; max-height: 200px;" /></a>',
                obj.capture_paiement.url,
                obj.capture_paiement.url
            )
        return "Aucune capture"
    apercu_capture.short_description = 'Aperçu paiement'
    
    actions = ['valider_commandes', 'rejeter_commandes', 'marquer_pretes', 'marquer_distribuees']
    
    def valider_commandes(self, request, queryset):
        """Action pour valider les commandes sélectionnées"""
        count = 0
        for commande in queryset.filter(statut='EN_ATTENTE'):
            commande.valider(request.user)
            count += 1
        self.message_user(request, f'{count} commande(s) validée(s) avec succès.')
    valider_commandes.short_description = "Valider les commandes sélectionnées (en attente)"
    
    def rejeter_commandes(self, request, queryset):
        """Action pour rejeter les commandes sélectionnées"""
        # Version simplifiée - dans la vraie vie, il faudrait un formulaire pour le motif
        count = 0
        for commande in queryset.filter(statut='EN_ATTENTE'):
            commande.rejeter(request.user, "Rejeté via admin")
            count += 1
        self.message_user(request, f'{count} commande(s) rejetée(s).')
    rejeter_commandes.short_description = "Rejeter les commandes sélectionnées"
    
    def marquer_pretes(self, request, queryset):
        """Action pour marquer les commandes comme prêtes"""
        count = queryset.filter(statut='VALIDEE').update(statut='PRETE')
        self.message_user(request, f'{count} commande(s) marquée(s) comme prêtes.')
    marquer_pretes.short_description = "Marquer comme prêtes"
    
    def marquer_distribuees(self, request, queryset):
        """Action pour marquer les commandes comme distribuées"""
        count = 0
        for commande in queryset.filter(statut='PRETE'):
            commande.distribuer(request.user)
            count += 1
        self.message_user(request, f'{count} commande(s) marquée(s) comme distribuées.')
    marquer_distribuees.short_description = "Marquer comme distribuées"


# ──────────────────── ADMIN HISTORIQUE COMMANDE ────────────────────
@admin.register(HistoriqueCommande)
class HistoriqueCommandeAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour l'historique des commandes
    """
    list_display = ['commande_numero', 'ancien_statut', 'nouveau_statut', 'modifie_par_nom', 'date_modification']
    list_filter = ['ancien_statut', 'nouveau_statut', 'date_modification']
    search_fields = ['commande__numero_commande', 'commentaire']
    ordering = ['-date_modification']
    readonly_fields = ['commande', 'ancien_statut', 'nouveau_statut', 'modifie_par', 'commentaire', 'date_modification']
    
    def commande_numero(self, obj):
        url = reverse('admin:commandes_commande_change', args=[obj.commande.id])
        return format_html('<a href="{}">{}</a>', url, obj.commande.numero_commande)
    commande_numero.short_description = 'Commande'
    
    def modifie_par_nom(self, obj):
        if obj.modifie_par:
            url = reverse('admin:authentification_utilisateur_change', args=[obj.modifie_par.id])
            return format_html('<a href="{}">{}</a>', url, obj.modifie_par.get_full_name())
        return "Système"
    modifie_par_nom.short_description = 'Modifié par'
    
    def has_add_permission(self, request):
        """Empêche l'ajout manuel d'entrées d'historique"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Empêche la modification des entrées d'historique"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Empêche la suppression des entrées d'historique"""
        return False


# ──────────────────── ADMIN CLÔTURE JOURNALIÈRE ────────────────────
@admin.register(ClotureJournaliere)
class ClotureJournaliereAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les clôtures journalières
    """
    list_display = [
        'secteur_nom',
        'date_cloture',
        'nombre_commandes',
        'montant_total_format',
        'commandes_validees',
        'commandes_rejetees',
        'est_verrouillee_badge'
    ]
    list_filter = ['secteur', 'date_cloture', 'est_verrouillee']
    search_fields = ['secteur__nom', 'secteur__code']
    ordering = ['-date_cloture']
    readonly_fields = [
        'secteur',
        'date_cloture',
        'cloture_par',
        'nombre_commandes',
        'montant_total',
        'commandes_validees',
        'commandes_rejetees',
        'commandes_distribuees',
        'resume_commandes',
        'date_creation'
    ]
    
    def secteur_nom(self, obj):
        url = reverse('admin:administration_secteur_change', args=[obj.secteur.id])
        return format_html('<a href="{}">{}</a>', url, obj.secteur.nom)
    secteur_nom.short_description = 'Secteur'
    
    def montant_total_format(self, obj):
        return format_html(
            '<span style="font-weight: bold; color: #4CAF50;">{} FCFA</span>',
            obj.montant_total
        )
    montant_total_format.short_description = 'Montant total'
    
    def est_verrouillee_badge(self, obj):
        if obj.est_verrouillee:
            return format_html('<span style="background-color: #4CAF50; color: white; padding: 3px 8px; border-radius: 3px;">Verrouillée</span>')
        return format_html('<span style="background-color: #FF9800; color: white; padding: 3px 8px; border-radius: 3px;">Non verrouillée</span>')
    est_verrouillee_badge.short_description = 'Statut'
    
    fieldsets = (
        ('Informations', {
            'fields': ('secteur', 'date_cloture', 'cloture_par', 'est_verrouillee')
        }),
        ('Statistiques', {
            'fields': ('nombre_commandes', 'montant_total', 'commandes_validees', 'commandes_rejetees', 'commandes_distribuees')
        }),
        ('Détail', {
            'fields': ('resume_commandes',),
            'classes': ('collapse',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation',),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        """Les clôtures sont créées automatiquement, pas manuellement"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Empêche la modification des clôtures"""
        if obj and obj.est_verrouillee:
            return False
        return super().has_change_permission(request, obj)
    
    actions = ['verrouiller_clotures']
    
    def verrouiller_clotures(self, request, queryset):
        """Action pour verrouiller les clôtures sélectionnées"""
        updated = queryset.update(est_verrouillee=True)
        self.message_user(request, f'{updated} clôture(s) verrouillée(s).')
    verrouiller_clotures.short_description = "Verrouiller les clôtures sélectionnées"


# ──────────────────── ADMIN PAIEMENT SENFENICO ────────────────────
@admin.register(PaiementSenfenico)
class PaiementSenfenicoAdmin(admin.ModelAdmin):
    list_display = ['charge_reference', 'commande_numero', 'statut', 'date_creation']
    list_filter = ['statut', 'date_creation']
    search_fields = ['charge_reference', 'commande__numero_commande']
    ordering = ['-date_creation']
    readonly_fields = ['commande', 'charge_reference', 'statut', 'display_text', 'date_creation', 'date_modification']

    def commande_numero(self, obj):
        url = reverse('admin:commandes_commande_change', args=[obj.commande.id])
        return format_html('<a href="{}">{}</a>', url, obj.commande.numero_commande)
    commande_numero.short_description = 'Commande'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ──────────────────── ADMIN PLAINTE ────────────────────
@admin.register(Plainte)
class PlainteAdmin(admin.ModelAdmin):
    list_display = ['id', 'etudiant_nom', 'categorie', 'sujet', 'statut_badge', 'date_creation']
    list_filter = ['statut', 'categorie', 'date_creation']
    search_fields = ['sujet', 'description', 'etudiant__nom', 'etudiant__prenom', 'etudiant__email']
    ordering = ['-date_creation']
    readonly_fields = ['etudiant', 'commande', 'categorie', 'sujet', 'description', 'date_creation', 'date_modification']

    fieldsets = (
        ('Plainte', {
            'fields': ('etudiant', 'commande', 'categorie', 'sujet', 'description'),
        }),
        ('Traitement', {
            'fields': ('statut', 'reponse_admin'),
        }),
        ('Dates', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',),
        }),
    )

    def etudiant_nom(self, obj):
        url = reverse('admin:authentification_utilisateur_change', args=[obj.etudiant.id])
        return format_html('<a href="{}">{}</a>', url, obj.etudiant.get_full_name())
    etudiant_nom.short_description = 'Étudiant'
    etudiant_nom.admin_order_field = 'etudiant__nom'

    def statut_badge(self, obj):
        colors = {
            'EN_ATTENTE': '#FF9800',
            'EN_COURS':   '#2196F3',
            'RESOLUE':    '#4CAF50',
            'REJETEE':    '#F44336',
        }
        color = colors.get(obj.statut, '#9E9E9E')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px;">{}</span>',
            color, obj.get_statut_display()
        )
    statut_badge.short_description = 'Statut'

    actions = ['marquer_en_cours', 'marquer_resolues', 'marquer_rejetees']

    def marquer_en_cours(self, request, queryset):
        updated = queryset.filter(statut='EN_ATTENTE').update(statut='EN_COURS')
        self.message_user(request, f'{updated} plainte(s) marquée(s) en cours.')
    marquer_en_cours.short_description = 'Marquer en cours de traitement'

    def marquer_resolues(self, request, queryset):
        updated = queryset.update(statut='RESOLUE')
        self.message_user(request, f'{updated} plainte(s) marquée(s) résolue(s).')
    marquer_resolues.short_description = 'Marquer comme résolues'

    def marquer_rejetees(self, request, queryset):
        updated = queryset.update(statut='REJETEE')
        self.message_user(request, f'{updated} plainte(s) rejetée(s).')
    marquer_rejetees.short_description = 'Marquer comme rejetées'