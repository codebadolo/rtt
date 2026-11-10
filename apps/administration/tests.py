import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from apps.authentification.models import Utilisateur
from .images import TAILLE_MAX
from .models import ProfilVendeur

MEDIA_TEST = tempfile.mkdtemp()


def photo(largeur, hauteur, fmt='JPEG', mode='RGB', exif_orientation=None):
    buf = io.BytesIO()
    image = Image.new(mode, (largeur, hauteur), 'orange')
    kwargs = {}
    if exif_orientation:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation
        kwargs['exif'] = exif
    image.save(buf, fmt, **kwargs)
    ext = 'jpg' if fmt == 'JPEG' else fmt.lower()
    return SimpleUploadedFile(f'photo.{ext}', buf.getvalue(), content_type=f'image/{ext}')


@override_settings(MEDIA_ROOT=MEDIA_TEST)
class PhotoBoutiqueTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TEST, ignore_errors=True)
        super().tearDownClass()

    def creer(self, fichier):
        user = Utilisateur.objects.create_user(None, telephone='+22670000010', nom='V', prenom='D', role='VENDEUR')
        profil = ProfilVendeur.objects.create(utilisateur=user, nom_boutique='Chez D', photo_boutique=fichier)
        profil.refresh_from_db()
        return Image.open(profil.photo_boutique.path)

    def test_photo_raisonnable_conservee_telle_quelle(self):
        fichier = photo(1600, 900)
        original = fichier.read()
        fichier.seek(0)
        user = Utilisateur.objects.create_user(None, telephone='+22670000011', nom='V', prenom='D', role='VENDEUR')
        profil = ProfilVendeur.objects.create(utilisateur=user, nom_boutique='X', photo_boutique=fichier)
        with open(profil.photo_boutique.path, 'rb') as f:
            self.assertEqual(f.read(), original)

    def test_grande_photo_reduite_sans_deformation(self):
        image = self.creer(photo(5000, 2500))
        self.assertEqual(image.size, (TAILLE_MAX, TAILLE_MAX // 2))
        self.assertEqual(image.format, 'JPEG')

    def test_orientation_exif_appliquee(self):
        # Photo prise en portrait : stockée 4000x3000, orientation EXIF "rotation 90°"
        image = self.creer(photo(4000, 3000, exif_orientation=6))
        self.assertEqual(image.size, (1920, TAILLE_MAX))

    def test_transparence_conservee(self):
        image = self.creer(photo(3000, 3000, fmt='PNG', mode='RGBA'))
        self.assertEqual(image.format, 'PNG')
        self.assertEqual(image.mode, 'RGBA')
