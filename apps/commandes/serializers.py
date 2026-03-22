from rest_framework import serializers
from .models import Commande, LigneCommande, HistoriqueCommande, PaiementSenfenico, Plainte
from apps.administration.models import Produit, Variante, Salle


class LigneCommandeSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.nom', read_only=True)
    variante_nom = serializers.CharField(source='variante.nom', read_only=True)

    class Meta:
        model = LigneCommande
        fields = ['id', 'produit_nom', 'variante_nom', 'quantite', 'prix_unitaire', 'sous_total']


class LigneCommandeCreateSerializer(serializers.Serializer):
    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(est_actif=True))
    variante = serializers.PrimaryKeyRelatedField(
        queryset=Variante.objects.all(), required=False, allow_null=True
    )
    quantite = serializers.IntegerField(min_value=1)
    prix_unitaire = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def validate(self, data):
        if not data.get('prix_unitaire'):
            variante = data.get('variante')
            data['prix_unitaire'] = variante.prix if variante else data['produit'].prix_base
        return data


class CommandeCreateSerializer(serializers.ModelSerializer):
    lignes = LigneCommandeCreateSerializer(many=True, write_only=True)
    salle = serializers.PrimaryKeyRelatedField(queryset=Salle.objects.all())

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ht', 'total_ttc',
            'frais_service',
            'salle',
            'methode_paiement', 'telephone_paiement',
            'description_besoin', 'heure_souhaitee', 'lignes',
        ]
        read_only_fields = ['id', 'numero_commande', 'statut', 'total_ht', 'total_ttc', 'frais_service']
        extra_kwargs = {
            'heure_souhaitee': {'required': True},
        }

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes')
        validated_data['secteur'] = validated_data['salle'].secteur
        validated_data['statut'] = 'EN_ATTENTE'
        commande = Commande.objects.create(**validated_data)
        for ligne in lignes_data:
            ligne.pop('options', None)
            LigneCommande.objects.create(commande=commande, **ligne)
        commande.mettre_a_jour_total()
        return commande


class CommandeListSerializer(serializers.ModelSerializer):
    etudiant_nom = serializers.SerializerMethodField()
    etudiant_email = serializers.CharField(source='etudiant.email', read_only=True)
    salle_nom = serializers.CharField(source='salle.nom', read_only=True)
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    methode_paiement_display = serializers.CharField(
        source='get_methode_paiement_display', read_only=True
    )

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ttc',
            'etudiant_nom', 'etudiant_email', 'etudiant_id',
            'salle_nom', 'secteur_nom',
            'methode_paiement', 'methode_paiement_display',
            'telephone_paiement', 'reference_paiement',
            'heure_souhaitee', 'description_besoin',
            'date_creation', 'date_validation',
        ]

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()


class PaiementSenfenicoInlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaiementSenfenico
        fields = ['charge_reference', 'statut', 'display_text', 'date_creation', 'date_modification']


class CommandeDetailSerializer(serializers.ModelSerializer):
    etudiant_nom = serializers.SerializerMethodField()
    etudiant_email = serializers.CharField(source='etudiant.email', read_only=True)
    salle_nom = serializers.CharField(source='salle.nom', read_only=True)
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    lignes = LigneCommandeSerializer(many=True, read_only=True)
    methode_paiement_display = serializers.CharField(
        source='get_methode_paiement_display', read_only=True
    )
    paiement_senfenico = PaiementSenfenicoInlineSerializer(read_only=True)

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ht', 'total_ttc',
            'frais_service',
            'etudiant_nom', 'etudiant_email', 'etudiant_id',
            'salle_nom', 'secteur_nom',
            'methode_paiement', 'methode_paiement_display',
            'telephone_paiement', 'reference_paiement', 'capture_paiement',
            'description_besoin', 'heure_souhaitee',
            'motif_rejet', 'date_validation',
            'lignes', 'paiement_senfenico',
            'date_creation', 'date_modification',
        ]

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()


class PaiementSenfenicoSerializer(serializers.ModelSerializer):
    numero_commande = serializers.CharField(source='commande.numero_commande', read_only=True)
    commande_id     = serializers.IntegerField(source='commande.id', read_only=True)
    commande_statut = serializers.CharField(source='commande.statut', read_only=True)
    etudiant_nom    = serializers.SerializerMethodField()
    montant         = serializers.DecimalField(source='commande.total_ttc', max_digits=12, decimal_places=2, read_only=True)
    methode_paiement = serializers.CharField(source='commande.methode_paiement', read_only=True)
    telephone       = serializers.CharField(source='commande.telephone_paiement', read_only=True)

    class Meta:
        model = PaiementSenfenico
        fields = [
            'id', 'numero_commande', 'commande_id', 'commande_statut',
            'etudiant_nom', 'montant', 'methode_paiement', 'telephone',
            'charge_reference', 'statut', 'display_text',
            'date_creation', 'date_modification',
        ]

    def get_etudiant_nom(self, obj):
        return obj.commande.etudiant.get_full_name()


class HistoriqueCommandeSerializer(serializers.ModelSerializer):
    modifie_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueCommande
        fields = [
            'id', 'ancien_statut', 'nouveau_statut',
            'modifie_par_nom', 'commentaire', 'date_modification',
        ]

    def get_modifie_par_nom(self, obj):
        return obj.modifie_par.get_full_name() if obj.modifie_par else None


class PlainteSerializer(serializers.ModelSerializer):
    etudiant_nom = serializers.SerializerMethodField(read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_commande', read_only=True)

    class Meta:
        model = Plainte
        fields = [
            'id', 'etudiant', 'etudiant_nom', 'commande', 'commande_numero',
            'categorie', 'sujet', 'description', 'statut', 'reponse_admin',
            'date_creation', 'date_modification',
        ]
        read_only_fields = ['id', 'etudiant', 'statut', 'reponse_admin', 'date_creation', 'date_modification']

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()


class PlainteAdminSerializer(serializers.ModelSerializer):
    """Serializer pour admin/chef — permet de modifier statut et reponse_admin"""
    etudiant_nom = serializers.SerializerMethodField(read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_commande', read_only=True)

    class Meta:
        model = Plainte
        fields = [
            'id', 'etudiant', 'etudiant_nom', 'commande', 'commande_numero',
            'categorie', 'sujet', 'description', 'statut', 'reponse_admin',
            'date_creation', 'date_modification',
        ]
        read_only_fields = ['id', 'etudiant', 'date_creation', 'date_modification']

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()
