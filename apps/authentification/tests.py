"""
Parcours V1 : identification progressive étudiant / vendeur par OTP SMS.
Règle centrale vérifiée ici : l'OTP valide le téléphone, jamais la commande.
"""
import io
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from apps.administration.models import Universite, Secteur, Salle, Produit, ProfilVendeur
from apps.commandes.models import Commande, StatutCommande
from .models import Utilisateur, OTPVerification, ParcoursIdentification


def image_test():
    buf = io.BytesIO()
    Image.new('RGB', (10, 10)).save(buf, 'PNG')
    return SimpleUploadedFile('boutique.png', buf.getvalue(), content_type='image/png')


@override_settings(DEBUG=True, BBG_SMS_API_TOKEN='', BBG_SMS_SENDER_ID='')
class BaseParcoursTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.univ = Universite.objects.create(nom='Université Joseph Ki-Zerbo', code='UJKZ')
        self.secteur = Secteur.objects.create(nom='Campus', code='CAMPUS', universite=self.univ)
        self.salle = Salle.objects.create(secteur=self.secteur, nom='Amphi A', code='AMPHI-A')
        self.admin = Utilisateur.objects.create_superuser('admin@ritoto.bf', 'Admin123!', nom='A', prenom='B')

    def auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')

    def demarrer(self, type_parcours='ETUDIANT'):
        r = self.client.post('/api/parcours/', {'type_parcours': type_parcours, 'universite': self.univ.id}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data['token']

    def envoyer_et_verifier(self, token, telephone):
        r = self.client.post(f'/api/parcours/{token}/telephone/', {'telephone': telephone}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        code = r.data['envoi']['debug_code']
        r = self.client.post(f'/api/parcours/{token}/verifier-otp/', {'code': code}, format='json')
        return r

    def boutique_validee(self):
        user = Utilisateur.objects.create_user(None, telephone='+22670000001', nom='V', prenom='W',
                                               role='VENDEUR', telephone_verifie=True)
        profil = ProfilVendeur.objects.create(utilisateur=user, universite=self.univ, nom_boutique='Chez V',
                                              statut_validation=ProfilVendeur.StatutValidation.VALIDE)
        produit = Produit.objects.create(nom='Riz', prix_base=Decimal('500'), vendeur=profil)
        return profil, produit


class ParcoursEtudiantTest(BaseParcoursTest):
    def test_parcours_complet_sans_commande_creee(self):
        token = self.demarrer()
        r = self.client.get(f'/api/parcours/{token}/')
        self.assertEqual(r.data['etape_suivante'], 'IDENTITE')

        r = self.client.patch(f'/api/parcours/{token}/', {'nom': 'Ouédraogo', 'prenom': 'Awa'}, format='json')
        self.assertEqual(r.data['etape_suivante'], 'NAISSANCE')
        r = self.client.patch(f'/api/parcours/{token}/', {'jour_naissance': 31, 'mois_naissance': 4}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f'/api/parcours/{token}/', {'jour_naissance': 29, 'mois_naissance': 2}, format='json')
        self.assertEqual(r.data['etape_suivante'], 'TELEPHONE')

        r = self.envoyer_et_verifier(token, '70 11 22 33')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['telephone_verifie'])
        self.assertTrue(r.data['profil_etudiant_actif'])
        self.assertIsNone(r.data['parcours']['etape_suivante'])
        self.assertIn("pas encore validée", r.data['message'])
        # Règle critique : l'OTP ne crée ni ne valide aucune commande
        self.assertEqual(Commande.objects.count(), 0)

        user = Utilisateur.objects.get(pk=r.data['user_id'])
        self.assertEqual((user.telephone, user.email, user.universite), ('+22670112233', None, self.univ))
        self.assertFalse(user.has_usable_password())

    def test_otp_errone_puis_blocage(self):
        token = self.demarrer()
        self.client.post(f'/api/parcours/{token}/telephone/', {'telephone': '70112233'}, format='json')
        for _ in range(OTPVerification.MAX_TENTATIVES):
            r = self.client.post(f'/api/parcours/{token}/verifier-otp/', {'code': '000000'}, format='json')
            self.assertEqual(r.status_code, 400)
        bon_code = OTPVerification.objects.get(telephone='+22670112233', est_verifie=False).code
        r = self.client.post(f'/api/parcours/{token}/verifier-otp/', {'code': bon_code}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_renvoi_otp_limite(self):
        token = self.demarrer()
        self.client.post(f'/api/parcours/{token}/telephone/', {'telephone': '70112233'}, format='json')
        r = self.client.post(f'/api/parcours/{token}/telephone/', {'telephone': '70112233'}, format='json')
        self.assertEqual(r.status_code, 429)

    def test_etudiant_qui_revient_ne_ressaisit_rien(self):
        token = self.demarrer()
        self.client.patch(f'/api/parcours/{token}/', {'nom': 'Kaboré', 'prenom': 'Ali',
                                                      'jour_naissance': 3, 'mois_naissance': 7}, format='json')
        user_id = self.envoyer_et_verifier(token, '70112233').data['user_id']

        self.client.credentials()
        OTPVerification.objects.update(date_creation=timezone.now() - timedelta(minutes=2))
        token2 = self.demarrer()
        r = self.envoyer_et_verifier(token2, '+226 70 11 22 33')
        self.assertEqual(r.data['user_id'], user_id)
        self.assertIsNone(r.data['parcours']['etape_suivante'])
        self.assertEqual(Utilisateur.objects.filter(telephone='+22670112233').count(), 1)

    def test_parcours_rattache_reserve_au_compte(self):
        token = self.demarrer()
        self.envoyer_et_verifier(token, '70112233')
        r = self.client.patch(f'/api/parcours/{token}/', {'nom': 'Pirate'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_retour_arriere_apres_otp_met_a_jour_le_compte(self):
        token = self.demarrer()
        data = self.envoyer_et_verifier(token, '70112233').data
        self.assertEqual(data['parcours']['etape_suivante'], 'IDENTITE')
        self.auth(Utilisateur.objects.get(pk=data['user_id']))
        self.client.patch(f'/api/parcours/{token}/', {'nom': 'Sawadogo', 'prenom': 'Issa',
                                                      'jour_naissance': 1, 'mois_naissance': 1}, format='json')
        self.assertTrue(Utilisateur.objects.get(pk=data['user_id']).profil_etudiant_actif)

    def test_commande_exige_profil_et_telephone_verifie(self):
        _, produit = self.boutique_validee()
        ancien = Utilisateur.objects.create_user('ancien@ritoto.bf', 'Ancien123!', nom='X', prenom='Y',
                                                 telephone='70999999', jour_naissance=1, mois_naissance=2)
        self.auth(ancien)
        payload = {'salle': self.salle.id, 'methode_paiement': 'ORANGE',
                   'lignes': [{'produit': produit.id, 'quantite': 1}]}
        r = self.client.post('/api/commandes/', payload, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], ['PROFIL_INCOMPLET'])
        self.assertIn('TELEPHONE_NON_VERIFIE', r.data['etapes_manquantes'])

        # Compte existant : le parcours reprend ses infos, seul l'OTP reste à faire
        token = self.demarrer()
        self.assertEqual(self.client.get(f'/api/parcours/{token}/').data['etape_suivante'], 'OTP')
        self.envoyer_et_verifier(token, '70999999')

        r = self.client.post('/api/commandes/recapitulatif/', payload, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data['commande_creee'])
        self.assertEqual(Commande.objects.count(), 0)

        r = self.client.post('/api/commandes/', payload, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        commande = Commande.objects.get()
        self.assertEqual(commande.statut, StatutCommande.EN_ATTENTE)
        self.assertEqual(commande.etape_commande, 'PREPARATION_PAIEMENT')
        self.assertEqual(commande.telephone_paiement, '+22670999999')


class ParcoursVendeurTest(BaseParcoursTest):
    def test_parcours_vendeur_jusqu_a_validation(self):
        token = self.demarrer('VENDEUR')
        self.client.patch(f'/api/parcours/{token}/', {'nom': 'Traoré', 'prenom': 'Mariam'}, format='json')
        r = self.envoyer_et_verifier(token, '76554433')
        self.assertEqual(r.status_code, 200, r.data)
        vendeur = Utilisateur.objects.get(pk=r.data['user_id'])
        self.assertEqual(vendeur.role, 'VENDEUR')
        self.auth(vendeur)

        r = self.client.get('/api/profil/vendeur/')
        self.assertEqual(r.data['statut_validation'], 'BROUILLON')
        self.assertNotIn('photo_cnib', r.data)
        self.assertEqual(self.client.post('/api/profil/vendeur/soumettre/').status_code, 400)

        r = self.client.patch('/api/profil/vendeur/', {
            'nom_boutique': 'Chez Mariam', 'categorie_principale': 'SNACK',
            'description': 'Beignets et jus', 'emplacement': self.secteur.id, 'photo_boutique': image_test(),
        }, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        r = self.client.post('/api/produits/', {'nom': 'Beignet', 'prix_base': '100', 'categorie': 'SNACK'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        profil = vendeur.profil_vendeur
        self.assertEqual(Produit.objects.get(pk=r.data['id']).vendeur, profil)

        r = self.client.post('/api/profil/vendeur/soumettre/')
        self.assertEqual(r.data['statut_validation'], 'EN_ATTENTE_VALIDATION')

        # Non active tant que Ritôtô n'a pas validé
        self.client.credentials()
        self.assertEqual(self.client.get(f'/api/boutiques/?universite={self.univ.id}').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/produits/?vendeur={profil.id}').data['count'], 0)

        self.auth(self.admin)
        r = self.client.post(f'/api/admin/vendeurs/{profil.id}/demander-correction/', {'motif': 'Photo floue'}, format='json')
        self.assertEqual(r.data['statut_validation'], 'CORRECTION_DEMANDEE')
        self.auth(vendeur)
        self.assertEqual(self.client.post('/api/profil/vendeur/soumettre/').data['statut_validation'], 'EN_ATTENTE_VALIDATION')
        self.auth(self.admin)
        r = self.client.post(f'/api/admin/vendeurs/{profil.id}/valider/')
        self.assertTrue(r.data['boutique_active'])

        self.client.credentials()
        r = self.client.get(f'/api/boutiques/?universite={self.univ.id}')
        self.assertEqual(r.data['count'], 1)
        self.assertEqual(len(self.client.get(f'/api/boutiques/{profil.id}/produits/').data), 1)

    def test_vendeur_ne_voit_ni_n_accepte_une_commande_non_payee(self):
        profil, produit = self.boutique_validee()
        etudiant = Utilisateur.objects.create_user(None, telephone='+22670111111', nom='E', prenom='F',
                                                   jour_naissance=1, mois_naissance=1, telephone_verifie=True)
        commande = Commande.objects.create(etudiant=etudiant, secteur=self.secteur, salle=self.salle,
                                           vendeur=profil, statut=StatutCommande.EN_ATTENTE,
                                           methode_paiement='ORANGE', telephone_paiement='70111111')
        self.auth(profil.utilisateur)
        self.assertEqual(self.client.get('/api/commandes/').data['count'], 0)
        r = self.client.post(f'/api/commandes/{commande.id}/accepter-vendeur/')
        self.assertEqual(r.status_code, 404)

    def test_vendeur_ne_modifie_que_son_catalogue(self):
        profil, produit = self.boutique_validee()
        autre = Utilisateur.objects.create_user(None, telephone='+22670000002', nom='O', prenom='P',
                                                role='VENDEUR', telephone_verifie=True)
        ProfilVendeur.objects.create(utilisateur=autre, nom_boutique='Autre')
        self.auth(autre)
        r = self.client.patch(f'/api/produits/{produit.id}/', {'prix_base': '1'}, format='json')
        self.assertEqual(r.status_code, 404)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/produits/').status_code, 200)


class VerificationTelephoneCompatTest(BaseParcoursTest):
    """Variante en un appel utilisée par le frontend (/api/auth/parcours/verifier-telephone/)."""

    def envoyer(self, telephone):
        r = self.client.post('/api/auth/otp/envoyer/', {'telephone': telephone}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data['debug_code']

    def test_etudiant_en_un_appel_sans_commande(self):
        code = self.envoyer('70 44 55 66')
        r = self.client.post('/api/auth/parcours/verifier-telephone/', {
            'telephone': '70445566', 'code': code, 'parcours': 'ETUDIANT', 'universite': self.univ.id,
            'nom': 'Zongo', 'prenom': 'Rita', 'jour_naissance': 12, 'mois_naissance': 5,
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['nouveau_compte'])
        self.assertTrue(r.data['user']['etat_parcours']['profil_etudiant_actif'])
        self.assertEqual(Commande.objects.count(), 0)

    def test_ancien_compte_avec_mot_de_passe_non_ouvert_par_otp(self):
        Utilisateur.objects.create_user('old@ritoto.bf', 'Old12345!', nom='O', prenom='L', telephone='70 44 55 66')
        code = self.envoyer('70445566')
        r = self.client.post('/api/auth/parcours/verifier-telephone/',
                             {'telephone': '70445566', 'code': code}, format='json')
        self.assertEqual(r.status_code, 409)

    def test_vendeur_se_reconnecte_par_telephone(self):
        profil, _ = self.boutique_validee()
        code = self.envoyer(profil.utilisateur.telephone)
        r = self.client.post('/api/auth/parcours/verifier-telephone/',
                             {'telephone': profil.utilisateur.telephone, 'code': code}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['user']['id'], profil.utilisateur_id)
        self.assertEqual(r.data['user']['etat_parcours']['statut_boutique'], 'VALIDE')


@override_settings(DEBUG=False, BBG_SMS_API_TOKEN='318|jeton-test', BBG_SMS_SENDER_ID='RITOTO')
class EnvoiOTPBBGSMSTest(TestCase):
    """Envoi réel de l'OTP via BBG SMS (requête HTTP simulée)."""

    def setUp(self):
        self.client = APIClient()

    def reponse(self, json, status_code=200):
        return mock.Mock(status_code=status_code, ok=status_code < 400, json=lambda: json, text=str(json))

    @mock.patch('apps.authentification.sms_bbg.requests.request')
    def test_code_envoye_par_sms(self, requete):
        requete.return_value = self.reponse({'status': 'success', 'data': {'uid': 'abc'}})
        r = self.client.post('/api/auth/otp/envoyer/', {'telephone': '70 11 22 33'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['envoye'])
        self.assertNotIn('debug_code', r.data)

        methode, url = requete.call_args.args
        corps = requete.call_args.kwargs['json']
        self.assertEqual((methode, url), ('POST', 'https://bbgsmsapp.betterbegoing.com/api/http/sms/send'))
        self.assertEqual(corps['recipient'], '22670112233')
        self.assertEqual(corps['sender_id'], 'RITOTO')
        self.assertEqual(corps['type'], 'plain')
        self.assertEqual(corps['api_token'], '318|jeton-test')
        code = OTPVerification.objects.get(telephone='+22670112233').code
        self.assertIn(code, corps['message'])

    @mock.patch('apps.authentification.sms_bbg.requests.request')
    def test_erreur_fournisseur_remontee(self, requete):
        requete.return_value = self.reponse({'status': 'error', 'message': 'Sender ID non activé'})
        r = self.client.post('/api/auth/otp/envoyer/', {'telephone': '70112233'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('SMS', str(r.data))

    @override_settings(BBG_SMS_API_TOKEN='')
    def test_sans_fournisseur_en_production(self):
        r = self.client.post('/api/auth/otp/envoyer/', {'telephone': '70112233'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Aucun fournisseur SMS', str(r.data))
