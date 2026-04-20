from rest_framework import serializers
from django.db.models import Q
from .models import Secteur, Salle, Produit, Variante, Option, HoraireCommande, Configuration, HoraireSemaine, SettlementRecord
from apps.authentification.models import Utilisateur

# ──────────────────── SERIALIZER SECTEUR ────────────────────
class SecteurListSerializer(serializers.ModelSerializer):
    """
    Serializer pour la liste des secteurs
    """
    chefs_noms = serializers.SerializerMethodField()
    chefs = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Utilisateur.objects.filter(role='CHEF_SECTEUR', est_actif=True),
    )
    nombre_salles_actives = serializers.SerializerMethodField()

    class Meta:
        model = Secteur
        fields = [
            'id', 'nom', 'code', 'chefs', 'chefs_noms',
            'nombre_salles_actives', 'est_actif', 'date_creation'
        ]

    def get_chefs_noms(self, obj):
        return [c.get_full_name() for c in obj.chefs.all()]

    def get_nombre_salles_actives(self, obj):
        return obj.salles.filter(est_actif=True).count()


class SecteurDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pour le détail d'un secteur
    """
    chefs = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Utilisateur.objects.filter(role='CHEF_SECTEUR', est_actif=True),
    )
    chefs_details = serializers.SerializerMethodField()
    salles_list = serializers.SerializerMethodField()

    class Meta:
        model = Secteur
        fields = [
            'id', 'nom', 'code', 'description', 'chefs', 'chefs_details',
            'adresse', 'latitude', 'longitude', 'est_actif',
            'salles_list', 'date_creation', 'date_modification'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification']

    def get_chefs_details(self, obj):
        return [
            {
                'id': c.id,
                'nom': c.nom,
                'prenom': c.prenom,
                'email': c.email,
                'telephone': c.telephone,
            }
            for c in obj.chefs.all()
        ]

    def get_salles_list(self, obj):
        salles = obj.salles.filter(est_actif=True)[:5]
        return [{'id': s.id, 'nom': s.nom, 'code': s.code} for s in salles]

    def validate_chefs(self, value):
        for chef in value:
            if chef.role != 'CHEF_SECTEUR':
                raise serializers.ValidationError(
                    f"{chef.get_full_name()} doit avoir le rôle CHEF_SECTEUR"
                )
        return value


# ──────────────────── SERIALIZER SALLE ────────────────────
class SalleListSerializer(serializers.ModelSerializer):
    """
    Serializer pour la liste des salles
    """
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    secteur_code = serializers.CharField(source='secteur.code', read_only=True)
    livreur_1_nom = serializers.SerializerMethodField()
    livreur_2_nom = serializers.SerializerMethodField()
    
    class Meta:
        model = Salle
        fields = [
            'id', 'nom', 'code', 'secteur', 'secteur_nom', 'secteur_code',
            'capacite', 'livreur_1', 'livreur_2', 'livreur_1_nom', 'livreur_2_nom',
            'batiment', 'etage', 'est_actif'
        ]
    
    def get_livreur_1_nom(self, obj):
        if obj.livreur_1:
            return obj.livreur_1.get_full_name()
        return None
    
    def get_livreur_2_nom(self, obj):
        if obj.livreur_2:
            return obj.livreur_2.get_full_name()
        return None


class SalleDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pour le détail d'une salle
    """
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    livreur_1_details = serializers.SerializerMethodField()
    livreur_2_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Salle
        fields = [
            'id', 'secteur', 'secteur_nom', 'nom', 'code',
            'capacite', 'livreur_1', 'livreur_2', 
            'livreur_1_details', 'livreur_2_details',
            'batiment', 'etage', 'est_actif',
            'date_creation', 'date_modification'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification']
    
    def get_livreur_1_details(self, obj):
        if obj.livreur_1:
            return {
                'id': obj.livreur_1.id,
                'nom': obj.livreur_1.nom,
                'prenom': obj.livreur_1.prenom,
                'email': obj.livreur_1.email,
                'telephone': obj.livreur_1.telephone
            }
        return None
    
    def get_livreur_2_details(self, obj):
        if obj.livreur_2:
            return {
                'id': obj.livreur_2.id,
                'nom': obj.livreur_2.nom,
                'prenom': obj.livreur_2.prenom,
                'email': obj.livreur_2.email,
                'telephone': obj.livreur_2.telephone
            }
        return None
    
    def validate(self, data):
        """Vérifie que les livreurs ont bien le rôle LIVREUR"""
        livreur_1 = data.get('livreur_1')
        livreur_2 = data.get('livreur_2')
        
        if livreur_1 and livreur_1.role != 'LIVREUR':
            raise serializers.ValidationError({
                'livreur_1': 'L\'utilisateur doit avoir le rôle LIVREUR'
            })
        
        if livreur_2 and livreur_2.role != 'LIVREUR':
            raise serializers.ValidationError({
                'livreur_2': 'L\'utilisateur doit avoir le rôle LIVREUR'
            })
        
        if livreur_1 and livreur_2 and livreur_1.id == livreur_2.id:
            raise serializers.ValidationError(
                'Les deux livreurs doivent être différents'
            )
        
        return data


# ──────────────────── SERIALIZER PRODUIT ────────────────────
class VarianteSerializer(serializers.ModelSerializer):
    """
    Serializer pour les variantes
    """
    prix_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Variante
        fields = [
            'id', 'produit', 'nom', 'ajustement_prix',
            'prix_total', 'est_actif'
        ]
        read_only_fields = ['id']
    
    def get_prix_total(self, obj):
        return float(obj.produit.prix_base) + float(obj.ajustement_prix)
    
    def validate(self, data):
        """Vérifie que le nom de variante est unique pour ce produit"""
        produit = data.get('produit')
        nom = data.get('nom')
        instance_id = self.instance.id if self.instance else None
        
        if produit and nom:
            queryset = Variante.objects.filter(produit=produit, nom=nom)
            if instance_id:
                queryset = queryset.exclude(id=instance_id)
            if queryset.exists():
                raise serializers.ValidationError(
                    f'Une variante "{nom}" existe déjà pour ce produit'
                )
        return data


class OptionSerializer(serializers.ModelSerializer):
    """
    Serializer pour les options
    """
    class Meta:
        model = Option
        fields = [
            'id', 'produit', 'nom', 'prix', 'est_actif'
        ]
        read_only_fields = ['id']
    
    def validate(self, data):
        """Vérifie que le nom d'option est unique pour ce produit"""
        produit = data.get('produit')
        nom = data.get('nom')
        instance_id = self.instance.id if self.instance else None
        
        if produit and nom:
            queryset = Option.objects.filter(produit=produit, nom=nom)
            if instance_id:
                queryset = queryset.exclude(id=instance_id)
            if queryset.exists():
                raise serializers.ValidationError(
                    f'Une option "{nom}" existe déjà pour ce produit'
                )
        return data


class ProduitListSerializer(serializers.ModelSerializer):
    """
    Serializer pour la liste des produits
    """
    categorie_display = serializers.CharField(source='get_categorie_display', read_only=True)
    image_url = serializers.SerializerMethodField()
    en_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Produit
        fields = [
            'id', 'nom', 'categorie', 'categorie_display',
            'prix_base', 'image', 'image_url', 'en_stock', 'est_actif'
        ]
    
    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None


class ProduitDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pour le détail d'un produit
    """
    variantes = VarianteSerializer(many=True, read_only=True)
    options = OptionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    cree_par_nom = serializers.SerializerMethodField()
    
    class Meta:
        model = Produit
        fields = [
            'id', 'nom', 'description', 'categorie', 'prix_base',
            'image', 'image_url', 'stock_limite', 'quantite_stock',
            'en_stock', 'variantes', 'options', 'est_actif',
            'cree_par', 'cree_par_nom', 'date_creation', 'date_modification'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification', 'cree_par']
    
    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None
    
    def get_cree_par_nom(self, obj):
        if obj.cree_par:
            return obj.cree_par.get_full_name()
        return None
    
    def validate(self, data):
        """Validation croisée"""
        if data.get('stock_limite') and not data.get('quantite_stock'):
            raise serializers.ValidationError(
                'La quantité en stock est requise quand le stock est limité'
            )
        return data


# ──────────────────── SERIALIZER HORAIRE ────────────────────
class HoraireCommandeSerializer(serializers.ModelSerializer):
    """
    Serializer pour les horaires de commande
    """
    jour_display = serializers.CharField(source='get_jour_semaine_display', read_only=True)
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    est_ouvert_maintenant = serializers.SerializerMethodField()
    
    class Meta:
        model = HoraireCommande
        fields = [
            'id', 'secteur', 'secteur_nom', 'jour_semaine', 'jour_display',
            'heure_debut', 'heure_fin', 'limite_commandes',
            'est_actif', 'est_ouvert_maintenant'
        ]
    
    def get_est_ouvert_maintenant(self, obj):
        from django.utils import timezone
        return obj.est_ouvert(timezone.now())
    
    def validate(self, data):
        """Vérifie que l'heure de début est avant l'heure de fin"""
        if data.get('heure_debut') and data.get('heure_fin'):
            if data['heure_debut'] >= data['heure_fin']:
                raise serializers.ValidationError(
                    'L\'heure de début doit être antérieure à l\'heure de fin'
                )
        return data


# ──────────────────── SERIALIZER DASHBOARD ────────────────────
class SecteurStatsSerializer(serializers.Serializer):
    """
    Serializer pour les statistiques d'un secteur
    """
    id = serializers.IntegerField()
    nom = serializers.CharField()
    total_commandes = serializers.IntegerField()
    commandes_en_attente = serializers.IntegerField()
    commandes_validees = serializers.IntegerField()
    total_ca = serializers.DecimalField(max_digits=12, decimal_places=2)


class DashboardStatsSerializer(serializers.Serializer):
    """
    Serializer pour les statistiques du dashboard admin
    """
    total_secteurs = serializers.IntegerField()
    total_salles = serializers.IntegerField()
    total_produits = serializers.IntegerField()
    total_commandes = serializers.IntegerField()
    commandes_aujourdhui = serializers.IntegerField()
    ca_aujourdhui = serializers.DecimalField(max_digits=12, decimal_places=2)
    ca_mois = serializers.DecimalField(max_digits=12, decimal_places=2)
    top_secteurs = SecteurStatsSerializer(many=True)
    produits_populaires = serializers.ListField()
    commandes_recentes = serializers.ListField()


# ──────────────────── SERIALIZER CONFIGURATION ────────────────────
class HoraireSemaineSerializer(serializers.ModelSerializer):
    class Meta:
        model = HoraireSemaine
        fields = ['jour', 'actif', 'heure_ouverture', 'heure_fermeture']


class ConfigurationSerializer(serializers.ModelSerializer):
    """
    Serializer pour la configuration tarifaire (singleton).
    """
    horaires_semaine = HoraireSemaineSerializer(many=True, required=False)

    class Meta:
        model = Configuration
        fields = [
            'taux_service',
            'commandes_actives',
            'heure_ouverture',
            'heure_fermeture',
            'horaires_actifs',
            'numero_orange',
            'numero_moov',
            'numero_sank',
            'horaires_semaine',
            'date_modification',
        ]
        read_only_fields = ['date_modification']

    def update(self, instance, validated_data):
        horaires_data = validated_data.pop('horaires_semaine', None)
        instance = super().update(instance, validated_data)
        if horaires_data is not None:
            for h in horaires_data:
                HoraireSemaine.objects.update_or_create(
                    configuration=instance,
                    jour=h['jour'],
                    defaults={
                        'actif': h.get('actif', True),
                        'heure_ouverture': h.get('heure_ouverture'),
                        'heure_fermeture': h.get('heure_fermeture'),
                    },
                )
        return instance


# ──────────────────── SERIALIZER SETTLEMENT ────────────────────
class SettlementRecordSerializer(serializers.ModelSerializer):
    declenche_par_nom = serializers.SerializerMethodField()
    compte_display = serializers.CharField(source='get_compte_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = SettlementRecord
        fields = [
            'id', 'reference_senfenico', 'montant', 'compte', 'compte_display',
            'statut', 'statut_display', 'note', 'declenche_par_nom',
            'date_creation', 'date_modification',
        ]

    def get_declenche_par_nom(self, obj):
        if obj.declenche_par:
            return obj.declenche_par.get_full_name()
        return None


class SettlementCreateSerializer(serializers.Serializer):
    montant = serializers.IntegerField(min_value=100)
    compte = serializers.ChoiceField(choices=['orange', 'moov', 'sank'])
    note = serializers.CharField(required=False, allow_blank=True, default='')
