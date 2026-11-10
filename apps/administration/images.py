"""
Préparation des photos envoyées par les vendeurs (boutiques, produits).

Les fichiers sont conservés tels quels tant qu'ils restent raisonnables : pas
de recadrage, pas de recompression. Seules les très grandes photos (appareils
récents, > TAILLE_MAX px) sont réduites, en gardant leurs proportions, pour
rester rapides à charger sur mobile.
"""
import io
import logging
import os

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

TAILLE_MAX = 2560
QUALITE_JPEG = 90


def optimiser_image(fichier):
    """À appeler avant save() : ne traite qu'un fichier fraîchement envoyé."""
    if not fichier or getattr(fichier, '_committed', True):
        return
    try:
        fichier.seek(0)
        image = Image.open(fichier)
        image.load()
    except Exception:  # fichier illisible : la validation du champ s'en charge
        logger.warning("Image illisible, conservée telle quelle : %s", fichier.name)
        return

    if max(image.size) <= TAILLE_MAX:
        fichier.seek(0)
        return

    # Les photos de téléphone portent leur orientation en EXIF : on l'applique
    # avant de réduire, sinon la photo réduite apparaîtrait couchée.
    image = ImageOps.exif_transpose(image)
    image.thumbnail((TAILLE_MAX, TAILLE_MAX), Image.LANCZOS)

    tampon = io.BytesIO()
    base = os.path.splitext(os.path.basename(fichier.name))[0]
    transparente = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
    if transparente:
        image.save(tampon, format='PNG', optimize=True)
        nom = f'{base}.png'
    else:
        image.convert('RGB').save(tampon, format='JPEG', quality=QUALITE_JPEG, optimize=True, progressive=True)
        nom = f'{base}.jpg'
    fichier.save(nom, ContentFile(tampon.getvalue()), save=False)
