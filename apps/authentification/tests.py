from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.administration.models import Universite
from .models import OTPVerification, Utilisateur
from .telephone import normaliser_telephone

URL_ENVOYER = '/api/auth/otp/envoyer/'
URL_VERIFIER = '/api/auth/parcours/verifier-telephone/'


class NormalisationTelephoneTests(TestCase):
    def test_formats_equivalents(self):
        for saisie in ('70 00 00 01', '+226 70000001', '0022670000001', '226-70-00-00-01'):
            self.assertEqual(normaliser_telephone(saisie), '+22670000001')

    def test_invalide(self):
        self.assertIsNone(normaliser_telephone('123'))
        self.assertIsNone(normaliser_telephone(''))


@override_settings(DEBUG=True)
class ParcoursEtudiantOTPTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.univ = Universite.objects.create(nom='Université Joseph Ki-Zerbo', code='UJKZ')

    def _code(self, telephone='70 00 00 01'):
        res = self.client.post(URL_ENVOYER, {'telephone': telephone}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data['debug_code']

    def test_creation_compte_par_otp(self):
        code = self._code()
        res = self.client.post(URL_VERIFIER, {
            'telephone': '70000001', 'code': code, 'parcours': 'ETUDIANT',
            'nom': 'Ouédraogo', 'prenom': 'Awa', 'jour_naissance': 12, 'mois_naissance': 3,
            'universite': self.univ.id,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['nouveau_compte'])
        self.assertIn('token', res.data)
        etat = res.data['user']['etat_parcours']
        self.assertTrue(etat['telephone_verifie'])
        self.assertTrue(etat['profil_etudiant_actif'])
        user = Utilisateur.objects.get(telephone='+22670000001')
        self.assertEqual(user.role, 'ETUDIANT')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.universite, self.univ)

    def test_reconnexion_sans_ressaisie(self):
        code = self._code()
        self.client.post(URL_VERIFIER, {
            'telephone': '70000001', 'code': code, 'nom': 'Ouédraogo', 'prenom': 'Awa',
            'jour_naissance': 12, 'mois_naissance': 3,
        }, format='json')
        OTPVerification.objects.all().delete()  # lève la limite de renvoi
        code = self._code('+226 70 00 00 01')
        res = self.client.post(URL_VERIFIER, {'telephone': '+22670000001', 'code': code}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data['nouveau_compte'])
        self.assertEqual(res.data['user']['prenom'], 'Awa')
        self.assertEqual(Utilisateur.objects.count(), 1)

    def test_mauvais_code_puis_blocage(self):
        code = self._code()
        faux = '000000' if code != '000000' else '111111'
        for _ in range(OTPVerification.MAX_TENTATIVES):
            res = self.client.post(URL_VERIFIER, {'telephone': '70000001', 'code': faux}, format='json')
            self.assertEqual(res.status_code, 400)
        # Le bon code est désormais refusé : il faut en redemander un
        res = self.client.post(URL_VERIFIER, {'telephone': '70000001', 'code': code}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Utilisateur.objects.exists())

    def test_limite_renvoi(self):
        self._code()
        res = self.client.post(URL_ENVOYER, {'telephone': '70000001'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_compte_existant_non_verifie_avec_mot_de_passe_refuse(self):
        Utilisateur.objects.create_user(
            email='ancien@exemple.com', password='Secret#123', nom='A', prenom='B', telephone='70 00 00 01',
        )
        code = self._code()
        res = self.client.post(URL_VERIFIER, {'telephone': '70000001', 'code': code}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_jour_mois_invalide(self):
        code = self._code()
        res = self.client.post(URL_VERIFIER, {
            'telephone': '70000001', 'code': code, 'jour_naissance': 31, 'mois_naissance': 2,
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_parcours_vendeur_cree_un_compte_vendeur(self):
        code = self._code()
        res = self.client.post(URL_VERIFIER, {
            'telephone': '70000001', 'code': code, 'parcours': 'VENDEUR', 'nom': 'Kaboré', 'prenom': 'Issa',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['user']['role'], 'VENDEUR_INTERIEUR')
