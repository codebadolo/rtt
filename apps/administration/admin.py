from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.http import urlencode
from django.db import models
from .models import Secteur, Salle, Produit, Variante, Option, HoraireCommande, Configuration, SettlementRecord

# ──────────────────── ADMIN SECTEUR ────────────────────
@admin.register(Secteur)
class SecteurAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les secteurs
    """
    list_display = [
        'nom',
        'code',
        'chefs_noms',
        'nombre_salles',
        'est_actif',
        'date_creation'
    ]
    list_filter = ['est_actif', 'date_creation']
    search_fields = ['nom', 'code', 'description']
    ordering = ['nom']

    fieldsets = (
        ('Informations générales', {
            'fields': ('nom', 'code', 'description', 'est_actif')
        }),
        ('Chefs de secteur', {
            'fields': ('chefs',),
            'description': 'Sélectionner les chefs de secteur (doivent avoir le rôle CHEF_SECTEUR)'
        }),
        ('Localisation', {
            'fields': ('adresse', 'latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['date_creation', 'date_modification']

    def chefs_noms(self, obj):
        """Affiche les noms des chefs de secteur"""
        chefs = obj.chefs.all()
        if not chefs:
            return format_html('<span style="color: red;">Aucun chef assigné</span>')
        links = []
        for chef in chefs:
            url = reverse('admin:authentification_utilisateur_change', args=[chef.id])
            links.append(format_html('<a href="{}">{}</a>', url, chef.get_full_name()))
        return format_html(', '.join(str(l) for l in links))
    chefs_noms.short_description = 'Chefs de secteur'
    
    def nombre_salles(self, obj):
        """Affiche le nombre de salles avec un lien vers la liste filtrée"""
        count = obj.salles.count()
        url = reverse('admin:administration_salle_changelist') + '?' + urlencode({'secteur__id__exact': obj.id})
        return format_html('<a href="{}">{} salle(s)</a>', url, count)
    nombre_salles.short_description = 'Salles'
    
    # Actions personnalisées
    actions = ['activer_secteurs', 'desactiver_secteurs']
    
    def activer_secteurs(self, request, queryset):
        updated = queryset.update(est_actif=True)
        self.message_user(request, f'{updated} secteur(s) activé(s).')
    activer_secteurs.short_description = "Activer les secteurs sélectionnés"
    
    def desactiver_secteurs(self, request, queryset):
        updated = queryset.update(est_actif=False)
        self.message_user(request, f'{updated} secteur(s) désactivé(s).')
    desactiver_secteurs.short_description = "Désactiver les secteurs sélectionnés"


# ──────────────────── ADMIN SALLE ────────────────────
@admin.register(Salle)
class SalleAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les salles
    """
    list_display = [
        'nom',
        'code',
        'secteur_nom',
        'capacite',
        'livreurs_info',
        'est_actif'
    ]
    list_filter = ['secteur', 'est_actif', 'etage', 'batiment']
    search_fields = ['nom', 'code', 'secteur__nom']
    ordering = ['secteur', 'nom']
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('secteur', 'nom', 'code', 'capacite', 'est_actif')
        }),
        ('Livreurs', {
            'fields': ('livreur_1', 'livreur_2'),
            'description': 'Assigner les 2 livreurs pour cette salle'
        }),
        ('Localisation', {
            'fields': ('batiment', 'etage'),
            'classes': ('collapse',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['date_creation', 'date_modification']
    
    def secteur_nom(self, obj):
        """Affiche le secteur avec un lien"""
        url = reverse('admin:administration_secteur_change', args=[obj.secteur.id])
        return format_html('<a href="{}">{}</a>', url, obj.secteur.nom)
    secteur_nom.short_description = 'Secteur'
    secteur_nom.admin_order_field = 'secteur__nom'
    
    def livreurs_info(self, obj):
        """Affiche les livreurs avec des badges"""
        html = '<div style="display: flex; gap: 5px;">'
        
        if obj.livreur_1:
            url = reverse('admin:authentification_utilisateur_change', args=[obj.livreur_1.id])
            html += format_html('<span style="background-color: #2196F3; color: white; padding: 2px 8px; border-radius: 10px;"><a href="{}" style="color: white; text-decoration: none;">L1: {}</a></span>', url, obj.livreur_1.get_short_name())
        else:
            html += '<span style="background-color: #f44336; color: white; padding: 2px 8px; border-radius: 10px;">L1: Vacant</span>'
        
        if obj.livreur_2:
            url = reverse('admin:authentification_utilisateur_change', args=[obj.livreur_2.id])
            html += format_html('<span style="background-color: #4CAF50; color: white; padding: 2px 8px; border-radius: 10px;"><a href="{}" style="color: white; text-decoration: none;">L2: {}</a></span>', url, obj.livreur_2.get_short_name())
        else:
            html += '<span style="background-color: #f44336; color: white; padding: 2px 8px; border-radius: 10px;">L2: Vacant</span>'
        
        html += '</div>'
        return format_html(html)
    livreurs_info.short_description = 'Livreurs'
    
    # Actions personnalisées
    actions = ['activer_salles', 'desactiver_salles']
    
    def activer_salles(self, request, queryset):
        updated = queryset.update(est_actif=True)
        self.message_user(request, f'{updated} salle(s) activée(s).')
    activer_salles.short_description = "Activer les salles sélectionnées"
    
    def desactiver_salles(self, request, queryset):
        updated = queryset.update(est_actif=False)
        self.message_user(request, f'{updated} salle(s) désactivée(s).')
    desactiver_salles.short_description = "Désactiver les salles sélectionnées"


# ──────────────────── ADMIN PRODUIT ────────────────────
class VarianteInline(admin.TabularInline):
    """Inline pour les variantes dans le formulaire produit"""
    model = Variante
    extra = 1
    fields = ['nom', 'ajustement_prix', 'est_actif']

class OptionInline(admin.TabularInline):
    """Inline pour les options dans le formulaire produit"""
    model = Option
    extra = 2
    fields = ['nom', 'prix', 'est_actif']

@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les produits
    """
    list_display = [
        'nom',
        'categorie',
        'prix_base',
        'apercu_image',
        'stock_info',
        'nombre_variantes',
        'est_actif'
    ]
    list_filter = ['categorie', 'est_actif', 'stock_limite']
    search_fields = ['nom', 'description']
    ordering = ['categorie', 'nom']
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('nom', 'description', 'categorie', 'prix_base', 'est_actif')
        }),
        ('Image', {
            'fields': ('image',),
            'classes': ('wide',)
        }),
        ('Gestion du stock', {
            'fields': ('stock_limite', 'quantite_stock'),
            'classes': ('collapse',),
            'description': 'Si "Stock limité" est coché, indiquez la quantité disponible'
        }),
        ('Métadonnées', {
            'fields': ('cree_par', 'date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['date_creation', 'date_modification', 'cree_par']
    inlines = [VarianteInline, OptionInline]
    
    def apercu_image(self, obj):
        """Affiche une miniature de l'image"""
        if obj.image:
            return format_html('<img src="{}" style="max-width: 50px; max-height: 50px;" />', obj.image.url)
        return format_html('<span style="color: gray;">Aucune image</span>')
    apercu_image.short_description = 'Image'
    
    def stock_info(self, obj):
        """Affiche les informations de stock"""
        if obj.stock_limite:
            if obj.quantite_stock and obj.quantite_stock > 0:
                color = 'green' if obj.quantite_stock > 10 else 'orange'
                return format_html('<span style="color: {};">{} en stock</span>', color, obj.quantite_stock)
            else:
                return format_html('<span style="color: red;">Rupture</span>')
        return format_html('<span style="color: green;">Illimité</span>')
    stock_info.short_description = 'Stock'
    
    def nombre_variantes(self, obj):
        """Affiche le nombre de variantes actives"""
        count = obj.variantes.filter(est_actif=True).count()
        return count if count > 0 else '-'
    nombre_variantes.short_description = 'Variantes'
    
    def save_model(self, request, obj, form, change):
        """Ajoute automatiquement l'utilisateur qui crée le produit"""
        if not change:  # Si c'est une création
            obj.cree_par = request.user
        super().save_model(request, obj, form, change)
    
    # Actions personnalisées
    actions = ['activer_produits', 'desactiver_produits']
    
    def activer_produits(self, request, queryset):
        updated = queryset.update(est_actif=True)
        self.message_user(request, f'{updated} produit(s) activé(s).')
    activer_produits.short_description = "Activer les produits sélectionnés"
    
    def desactiver_produits(self, request, queryset):
        updated = queryset.update(est_actif=False)
        self.message_user(request, f'{updated} produit(s) désactivé(s).')
    desactiver_produits.short_description = "Désactiver les produits sélectionnés"


# ──────────────────── ADMIN VARIANTE ────────────────────
@admin.register(Variante)
class VarianteAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les variantes
    """
    list_display = ['nom', 'produit_nom', 'ajustement_prix', 'prix_total', 'est_actif']
    list_filter = ['produit', 'est_actif']
    search_fields = ['nom', 'produit__nom']
    ordering = ['produit', 'nom']
    
    def produit_nom(self, obj):
        url = reverse('admin:administration_produit_change', args=[obj.produit.id])
        return format_html('<a href="{}">{}</a>', url, obj.produit.nom)
    produit_nom.short_description = 'Produit'
    produit_nom.admin_order_field = 'produit__nom'
    
    def prix_total(self, obj):
        total = obj.produit.prix_base + obj.ajustement_prix
        return f"{total} FCFA"
    prix_total.short_description = 'Prix total'


# ──────────────────── ADMIN OPTION ────────────────────
@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les options
    """
    list_display = ['nom', 'produit_nom', 'prix', 'est_actif']
    list_filter = ['produit', 'est_actif']
    search_fields = ['nom', 'produit__nom']
    ordering = ['produit', 'nom']
    
    def produit_nom(self, obj):
        url = reverse('admin:administration_produit_change', args=[obj.produit.id])
        return format_html('<a href="{}">{}</a>', url, obj.produit.nom)
    produit_nom.short_description = 'Produit'
    produit_nom.admin_order_field = 'produit__nom'


# ──────────────────── ADMIN HORAIRE COMMANDE ────────────────────
@admin.register(HoraireCommande)
class HoraireCommandeAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface admin pour les horaires de commande
    """
    list_display = ['secteur', 'jour_semaine_display', 'heure_debut', 'heure_fin', 'limite_commandes', 'est_actif']
    list_filter = ['secteur', 'jour_semaine', 'est_actif']
    search_fields = ['secteur__nom']
    ordering = ['secteur', 'jour_semaine', 'heure_debut']
    
    fieldsets = (
        ('Informations', {
            'fields': ('secteur', 'jour_semaine', 'heure_debut', 'heure_fin', 'est_actif')
        }),
        ('Limites', {
            'fields': ('limite_commandes',),
            'classes': ('collapse',)
        }),
    )
    
    def jour_semaine_display(self, obj):
        colors = {
            1: '#2196F3',  # Lundi - Bleu
            2: '#4CAF50',  # Mardi - Vert
            3: '#FF9800',  # Mercredi - Orange
            4: '#9C27B0',  # Jeudi - Violet
            5: '#F44336',  # Vendredi - Rouge
            6: '#009688',  # Samedi - Turquoise
            7: '#795548',  # Dimanche - Marron
        }
        color = colors.get(obj.jour_semaine, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_jour_semaine_display()
        )
    jour_semaine_display.short_description = 'Jour'
    jour_semaine_display.admin_order_field = 'jour_semaine'


# ──────────────────── ADMIN CONFIGURATION ────────────────────
@admin.register(Configuration)
class ConfigurationAdmin(admin.ModelAdmin):
    list_display = ['taux_service', 'commandes_actives', 'horaires_actifs', 'heure_ouverture', 'heure_fermeture', 'date_modification']
    readonly_fields = ['date_modification']

    fieldsets = (
        ('Frais de service', {
            'fields': ('taux_service',),
            'description': 'Pourcentage appliqué sur le sous-total de chaque commande.',
        }),
        ('Disponibilité des commandes', {
            'fields': ('commandes_actives', 'horaires_actifs', 'heure_ouverture', 'heure_fermeture'),
        }),
        ('Comptes de paiement (Senfenico)', {
            'fields': ('numero_orange', 'numero_moov', 'numero_sank'),
            'classes': ('collapse',),
        }),
        ('Métadonnées', {
            'fields': ('date_modification',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return not Configuration.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


# ──────────────────── ADMIN SETTLEMENT ────────────────────
@admin.register(SettlementRecord)
class SettlementRecordAdmin(admin.ModelAdmin):
    list_display = ['reference_senfenico', 'montant_format', 'compte', 'statut_badge', 'declenche_par', 'date_creation']
    list_filter = ['statut', 'compte', 'date_creation']
    search_fields = ['reference_senfenico', 'note']
    ordering = ['-date_creation']
    readonly_fields = ['reference_senfenico', 'montant', 'compte', 'declenche_par', 'date_creation', 'date_modification']

    fieldsets = (
        ('Informations', {
            'fields': ('reference_senfenico', 'montant', 'compte', 'statut', 'note'),
        }),
        ('Déclenchement', {
            'fields': ('declenche_par', 'date_creation', 'date_modification'),
            'classes': ('collapse',),
        }),
    )

    def montant_format(self, obj):
        return format_html('<strong style="color: #4CAF50;">{} FCFA</strong>', f'{obj.montant:,.0f}')
    montant_format.short_description = 'Montant'
    montant_format.admin_order_field = 'montant'

    def statut_badge(self, obj):
        colors = {
            'processing': '#FF9800',
            'in_transit': '#2196F3',
            'success':    '#4CAF50',
            'cancelled':  '#9E9E9E',
            'failed':     '#F44336',
        }
        color = colors.get(obj.statut, '#9E9E9E')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px;">{}</span>',
            color, obj.get_statut_display()
        )
    statut_badge.short_description = 'Statut'

    def has_add_permission(self, request):
        return False