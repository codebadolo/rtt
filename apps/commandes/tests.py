from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from apps.administration.models import (
    Configuration, Produit, ProfilVendeur, Salle, Secteur, Universite,
)
from apps.authentification.models import Utilisateur
from .models import Commande, Remboursement, StatutCommande


class ParcoursCommandeV1Tests(TestCase):
    """Dossier V1 §4 : OTP ≠ validation de commande ; seul le paiement confirme."""

    def setUp(self):
        config = Configuration.get_active()
        config.commandes_actives = True
        config.horaires_actifs = False
        config.save()

        self.univ = Universite.objects.create(nom='UJKZ', code='UJKZ')
        self.secteur = Secteur.objects.create(nom='Campus', code='CAMP', universite=self.univ)
        self.salle = Salle.objects.create(nom='Amphi A', code='AMPHI-A', secteur=self.secteur)

        vendeur_user = Utilisateur.objects.create_user(
            email='v@ex.com', nom='K', prenom='I', telephone='+22670000009', role='VENDEUR_INTERIEUR',
        )
        self.boutique = ProfilVendeur.objects.create(
            utilisateur=vendeur_user, nom_boutique='Chez Issa', emplacement=self.secteur,
            statut_validation='VALIDE', est_valide=True,
        )
        self.produit = Produit.objects.create(nom='Riz gras', prix_base=1000, vendeur=self.boutique)

        self.etudiant = Utilisateur.objects.create_user(
            email='e@ex.com', nom='O', prenom='A', telephone='+22670000001',
            jour_naissance=1, mois_naissance=1, telephone_verifie=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.etudiant)

    def _payload(self):
        return {
            'salle': self.salle.id, 'mode_reception': 'LIVRAISON',
            'methode_paiement': 'ORANGE', 'telephone_paiement': '70000001',
            'lignes': [{'produit': self.produit.id, 'quantite': 1, 'options': []}],
        }

    def test_commande_creee_en_attente_de_paiement_et_invisible_du_vendeur(self):
        res = self.client.post('/api/commandes/', self._payload(), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        commande = Commande.objects.get(pk=res.data['id'])
        self.assertEqual(commande.statut, StatutCommande.BROUILLON)

        vendeur_client = APIClient()
        vendeur_client.force_authenticate(self.boutique.utilisateur)
        res = vendeur_client.get('/api/commandes/')
        self.assertEqual(res.data['count'] if 'count' in res.data else len(res.data), 0)
        res = vendeur_client.post(f'/api/commandes/{commande.id}/accepter-vendeur/')
        self.assertEqual(res.status_code, 404)

    def test_telephone_non_verifie_bloque_la_commande(self):
        self.etudiant.telephone_verifie = False
        self.etudiant.save()
        res = self.client.post('/api/commandes/', self._payload(), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'][0], 'profil_incomplet')

    def test_boutique_non_validee_refusee(self):
        self.boutique.statut_validation = 'EN_ATTENTE'
        self.boutique.est_valide = False
        self.boutique.save()
        res = self.client.post('/api/commandes/', self._payload(), format='json')
        self.assertEqual(res.status_code, 400)

    @mock.patch('apps.commandes.views.senfenico_soumettre_otp', return_value={'status': 'success'})
    @mock.patch('apps.commandes.views.creer_charge',
                return_value={'reference': 'CHG-1', 'status': 'send_otp', 'display_text': ''})
    def test_paiement_confirme_la_commande(self, _charge, _otp):
        commande_id = self.client.post('/api/commandes/', self._payload(), format='json').data['id']
        res = self.client.post(f'/api/commandes/{commande_id}/initier-paiement/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Commande.objects.get(pk=commande_id).statut, StatutCommande.BROUILLON)

        res = self.client.post(f'/api/commandes/{commande_id}/soumettre-otp/', {'otp': '1234'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        commande = Commande.objects.get(pk=commande_id)
        self.assertEqual(commande.statut, StatutCommande.VALIDEE)
        self.assertTrue(commande.paiement_confirme)

    def test_annulation_avant_paiement_sans_remboursement(self):
        commande_id = self.client.post('/api/commandes/', self._payload(), format='json').data['id']
        res = self.client.post(f'/api/commandes/{commande_id}/annuler/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(Remboursement.objects.exists())


class BoutiquesPubliquesTests(TestCase):
    def setUp(self):
        self.univ = Universite.objects.create(nom='UJKZ', code='UJKZ')
        self.secteur = Secteur.objects.create(nom='Campus', code='CAMP', universite=self.univ)

        def boutique(nom, statut, tel):
            user = Utilisateur.objects.create_user(
                email=f'{nom}@ex.com', nom=nom, prenom=nom, telephone=tel, role='VENDEUR_INTERIEUR',
            )
            b = ProfilVendeur.objects.create(
                utilisateur=user, nom_boutique=nom, emplacement=self.secteur,
                statut_validation=statut, est_valide=statut == 'VALIDE',
            )
            Produit.objects.create(nom=f'Produit {nom}', prix_base=500, vendeur=b)
            return b

        self.active = boutique('Active', 'VALIDE', '+22670000002')
        self.attente = boutique('Attente', 'EN_ATTENTE', '+22670000003')

    def test_seules_les_boutiques_validees_sont_visibles_sans_compte(self):
        client = APIClient()
        res = client.get(f'/api/boutiques/?universite={self.univ.id}')
        self.assertEqual(res.status_code, 200)
        noms = [b['nom_boutique'] for b in res.data['results']]
        self.assertEqual(noms, ['Active'])

        res = client.get('/api/produits/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['nom'] for p in res.data['results']], ['Produit Active'])

    def test_vendeur_gere_son_catalogue_et_soumet(self):
        client = APIClient()
        user = self.attente.utilisateur
        user.telephone_verifie = True
        user.save()
        self.attente.statut_validation = 'BROUILLON'
        self.attente.save()
        client.force_authenticate(user)

        res = client.post('/api/produits/', {'nom': 'Jus', 'prix_base': 300, 'categorie': 'BOISSON'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Produit.objects.get(pk=res.data['id']).vendeur, self.attente)
        # Ne voit que son propre catalogue
        noms = [p['nom'] for p in client.get('/api/produits/').data['results']]
        self.assertEqual(sorted(noms), ['Jus', 'Produit Attente'])

        res = client.post('/api/profil/vendeur/soumettre/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['statut_validation'], 'EN_ATTENTE')

        admin = Utilisateur.objects.create_superuser(email='admin@ex.com', password='x', nom='A', prenom='A')
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        res = admin_client.post(f'/api/admin/vendeurs/{self.attente.id}/demander-correction/',
                                {'motif': 'Ajoutez une photo'}, format='json')
        self.assertEqual(res.data['statut_validation'], 'CORRECTION')
        res = client.post('/api/profil/vendeur/soumettre/')
        self.assertEqual(res.status_code, 200)
        res = admin_client.post(f'/api/admin/vendeurs/{self.attente.id}/valider/')
        self.assertEqual(res.data['statut_validation'], 'VALIDE')
        self.assertTrue(res.data['boutique_active'])
