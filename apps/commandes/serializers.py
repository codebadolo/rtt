from rest_framework import serializers
from .models import (
    Commande, LigneCommande, OptionLigneCommande, HistoriqueCommande, PaiementSenfenico,
    Plainte, Remboursement, NoteVendeur, NoteLivreur, WalletVendeur, TransactionWallet,
)
from apps.administration.models import Produit, Variante, Option, Salle, Configuration, CreneauLivraison


class OptionLigneSerializer(serializers.ModelSerializer):
    option_nom = serializers.CharField(source='option.nom', read_only=True)

    class Meta:
        model = OptionLigneCommande
        fields = ['option_nom', 'prix_applique']


class LigneCommandeSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.nom', read_only=True)
    variante_nom = serializers.CharField(source='variante.nom', read_only=True)
    options = OptionLigneSerializer(many=True, read_only=True)

    class Meta:
        model = LigneCommande
        fields = ['id', 'produit_nom', 'variante_nom', 'options', 'quantite', 'prix_unitaire', 'sous_total']


class LigneCommandeCreateSerializer(serializers.Serializer):
    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(est_actif=True))
    variante = serializers.PrimaryKeyRelatedField(
        queryset=Variante.objects.all(), required=False, allow_null=True
    )
    options = serializers.PrimaryKeyRelatedField(
        queryset=Option.objects.filter(est_actif=True),
        many=True,
        required=False,
        default=list,
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
    creneau = serializers.PrimaryKeyRelatedField(
        queryset=CreneauLivraison.objects.filter(est_actif=True), required=False, allow_null=True
    )

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ht', 'total_ttc',
            'frais_service',
            'salle', 'mode_reception', 'creneau',
            'methode_paiement', 'telephone_paiement',
            'description_besoin', 'lignes',
        ]
        read_only_fields = ['id', 'numero_commande', 'statut', 'total_ht', 'total_ttc', 'frais_service']

    def validate(self, data):
        config = Configuration.get_active()
        ouvert, message = config.commandes_sont_ouvertes()
        if not ouvert:
            raise serializers.ValidationError({'detail': message})

        lignes = data.get('lignes', [])
        total_ht = sum(
            (l.get('prix_unitaire') or (l['variante'].prix if l.get('variante') else l['produit'].prix_base))
            * l['quantite']
            for l in lignes
        )
        if total_ht < 100:
            raise serializers.ValidationError({'detail': 'Le montant minimum de commande est de 100 FCFA.'})

        # Un panier, un seul vendeur (§4.1)
        vendeurs = {l['produit'].vendeur_id for l in lignes if l['produit'].vendeur_id}
        if len(vendeurs) > 1:
            raise serializers.ValidationError(
                {'detail': 'Une commande ne peut contenir que des produits d\'un seul vendeur. '
                           'Créez une commande séparée pour chaque vendeur.'}
            )
        data['_vendeur_id'] = vendeurs.pop() if vendeurs else None

        return data

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes')
        vendeur_id = validated_data.pop('_vendeur_id', None)
        validated_data['secteur'] = validated_data['salle'].secteur
        validated_data['statut'] = 'EN_ATTENTE'
        if vendeur_id:
            validated_data['vendeur_id'] = vendeur_id
        commande = Commande.objects.create(**validated_data)
        for ligne in lignes_data:
            options_data = ligne.pop('options', [])
            ligne_obj = LigneCommande.objects.create(commande=commande, **ligne)
            for option in options_data:
                OptionLigneCommande.objects.create(
                    ligne_commande=ligne_obj,
                    option=option,
                    prix_applique=option.prix,
                )
        commande.mettre_a_jour_total()
        return commande


class CommandeListSerializer(serializers.ModelSerializer):
    etudiant_nom = serializers.SerializerMethodField()
    etudiant_email = serializers.CharField(source='etudiant.email', read_only=True)
    salle_nom = serializers.CharField(source='salle.nom', read_only=True)
    secteur_nom = serializers.CharField(source='secteur.nom', read_only=True)
    vendeur_nom = serializers.CharField(source='vendeur.nom_boutique', read_only=True, default=None)
    mode_reception_display = serializers.CharField(source='get_mode_reception_display', read_only=True)
    creneau_label = serializers.CharField(source='creneau.label', read_only=True, default=None)
    methode_paiement_display = serializers.CharField(
        source='get_methode_paiement_display', read_only=True
    )

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ttc',
            'etudiant_nom', 'etudiant_email', 'etudiant_id',
            'salle_nom', 'secteur_nom',
            'vendeur', 'vendeur_nom', 'mode_reception', 'mode_reception_display',
            'creneau', 'creneau_label', 'code_retrait',
            'methode_paiement', 'methode_paiement_display',
            'telephone_paiement', 'reference_paiement',
            'description_besoin',
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
    vendeur_nom = serializers.CharField(source='vendeur.nom_boutique', read_only=True, default=None)
    mode_reception_display = serializers.CharField(source='get_mode_reception_display', read_only=True)
    creneau_label = serializers.CharField(source='creneau.label', read_only=True, default=None)
    lignes = LigneCommandeSerializer(many=True, read_only=True)
    methode_paiement_display = serializers.CharField(
        source='get_methode_paiement_display', read_only=True
    )
    paiement_senfenico = PaiementSenfenicoInlineSerializer(read_only=True)
    a_note_vendeur = serializers.SerializerMethodField()
    a_note_livreur = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_commande', 'statut', 'total_ht', 'total_ttc',
            'frais_service',
            'etudiant_nom', 'etudiant_email', 'etudiant_id',
            'salle_nom', 'secteur_nom',
            'vendeur', 'vendeur_nom', 'mode_reception', 'mode_reception_display',
            'creneau', 'creneau_label', 'code_retrait',
            'methode_paiement', 'methode_paiement_display',
            'telephone_paiement', 'reference_paiement', 'capture_paiement',
            'description_besoin',
            'motif_rejet', 'date_validation',
            'lignes', 'paiement_senfenico',
            'a_note_vendeur', 'a_note_livreur',
            'date_creation', 'date_modification',
        ]

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()

    def get_a_note_vendeur(self, obj):
        return hasattr(obj, 'note_vendeur')

    def get_a_note_livreur(self, obj):
        return hasattr(obj, 'note_livreur')


class PaiementSenfenicoSerializer(serializers.ModelSerializer):
    numero_commande  = serializers.CharField(source='commande.numero_commande', read_only=True)
    commande_id      = serializers.IntegerField(source='commande.id', read_only=True)
    commande_statut  = serializers.CharField(source='commande.statut', read_only=True)
    etudiant_nom     = serializers.SerializerMethodField()
    montant          = serializers.DecimalField(source='commande.total_ttc', max_digits=12, decimal_places=2, read_only=True)
    methode_paiement = serializers.CharField(source='commande.methode_paiement', read_only=True)
    telephone        = serializers.CharField(source='commande.telephone_paiement', read_only=True)
    secteur_nom      = serializers.CharField(source='commande.secteur.nom', read_only=True, default='—')

    class Meta:
        model = PaiementSenfenico
        fields = [
            'id', 'numero_commande', 'commande_id', 'commande_statut',
            'etudiant_nom', 'montant', 'methode_paiement', 'telephone',
            'secteur_nom',
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
    auteur_nom = serializers.SerializerMethodField(read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_commande', read_only=True)

    class Meta:
        model = Plainte
        fields = [
            'id', 'etudiant', 'etudiant_nom', 'auteur', 'auteur_nom', 'commande', 'commande_numero',
            'categorie', 'sujet', 'description', 'photo_preuve', 'statut', 'reponse_admin',
            'date_creation', 'date_modification',
        ]
        read_only_fields = ['id', 'etudiant', 'auteur', 'statut', 'reponse_admin', 'date_creation', 'date_modification']

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()

    def get_auteur_nom(self, obj):
        return obj.auteur_effectif.get_full_name()


class PlainteAdminSerializer(serializers.ModelSerializer):
    """Serializer pour admin/chef — permet de modifier statut et reponse_admin"""
    etudiant_nom = serializers.SerializerMethodField(read_only=True)
    auteur_nom = serializers.SerializerMethodField(read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_commande', read_only=True)

    class Meta:
        model = Plainte
        fields = [
            'id', 'etudiant', 'etudiant_nom', 'auteur', 'auteur_nom', 'commande', 'commande_numero',
            'categorie', 'sujet', 'description', 'photo_preuve', 'statut', 'reponse_admin',
            'date_creation', 'date_modification',
        ]
        read_only_fields = ['id', 'etudiant', 'date_creation', 'date_modification']

    def get_etudiant_nom(self, obj):
        return obj.etudiant.get_full_name()

    def get_auteur_nom(self, obj):
        return obj.auteur_effectif.get_full_name()


# ──────────────────── SERIALIZER REMBOURSEMENT ────────────────────
class RemboursementSerializer(serializers.ModelSerializer):
    numero_commande = serializers.CharField(source='commande.numero_commande', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    traite_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = Remboursement
        fields = [
            'id', 'commande', 'numero_commande', 'montant', 'motif', 'automatique',
            'statut', 'statut_display', 'traite_par_nom',
            'date_creation', 'date_traitement',
        ]
        read_only_fields = fields

    def get_traite_par_nom(self, obj):
        return obj.traite_par.get_full_name() if obj.traite_par else None


# ──────────────────── SERIALIZER NOTATION ────────────────────
class NoteVendeurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteVendeur
        fields = ['id', 'commande', 'note', 'commentaire']
        read_only_fields = ['id']

    def validate_commande(self, commande):
        if commande.etudiant != self.context['request'].user:
            raise serializers.ValidationError("Cette commande ne vous appartient pas.")
        if commande.statut != 'LIVREE':
            raise serializers.ValidationError("Seule une commande livrée peut être notée.")
        if not commande.vendeur_id:
            raise serializers.ValidationError("Cette commande n'a pas de vendeur rattaché.")
        if hasattr(commande, 'note_vendeur'):
            raise serializers.ValidationError("Cette commande a déjà été notée.")
        return commande

    def create(self, validated_data):
        validated_data['client'] = self.context['request'].user
        validated_data['vendeur'] = validated_data['commande'].vendeur
        return super().create(validated_data)


class NoteLivreurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteLivreur
        fields = ['id', 'commande', 'note', 'commentaire']
        read_only_fields = ['id']

    def validate_commande(self, commande):
        if commande.etudiant != self.context['request'].user:
            raise serializers.ValidationError("Cette commande ne vous appartient pas.")
        if commande.statut != 'LIVREE':
            raise serializers.ValidationError("Seule une commande livrée peut être notée.")
        if not commande.livreur_assigne_id and not commande.distribue_par_id:
            raise serializers.ValidationError("Cette commande n'a pas été livrée par un livreur.")
        if hasattr(commande, 'note_livreur'):
            raise serializers.ValidationError("Cette commande a déjà été notée.")
        return commande

    def create(self, validated_data):
        commande = validated_data['commande']
        validated_data['client'] = self.context['request'].user
        validated_data['livreur'] = commande.livreur_assigne or commande.distribue_par
        return super().create(validated_data)


# ──────────────────── SERIALIZER WALLET ────────────────────
class WalletVendeurSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletVendeur
        fields = ['solde', 'solde_en_attente', 'total_encaisse', 'total_commissions', 'date_modification']


class TransactionWalletSerializer(serializers.ModelSerializer):
    commande_numero = serializers.CharField(source='commande.numero_commande', read_only=True, default=None)
    type_transaction_display = serializers.CharField(source='get_type_transaction_display', read_only=True)

    class Meta:
        model = TransactionWallet
        fields = [
            'id', 'type_transaction', 'type_transaction_display', 'montant', 'commission',
            'commande', 'commande_numero', 'note', 'date_creation',
        ]
