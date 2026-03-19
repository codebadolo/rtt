# Generated manually
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('authentification', '0003_kyc_images_optional'),
    ]

    operations = [
        migrations.DeleteModel(
            name='VerificationKYC',
        ),
        migrations.RemoveIndex(
            model_name='utilisateur',
            name='authentific_statut__6679df_idx',
        ),
        migrations.RemoveField(
            model_name='utilisateur',
            name='date_soumission_kyc',
        ),
        migrations.RemoveField(
            model_name='utilisateur',
            name='date_verification_kyc',
        ),
        migrations.RemoveField(
            model_name='utilisateur',
            name='statut_kyc',
        ),
    ]
