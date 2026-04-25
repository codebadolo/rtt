import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commandes', '0008_commande_heure_souhaitee_nullable'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='QRCodeCommande',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True, verbose_name='Token unique')),
                ('payload_offline', models.JSONField(default=dict, help_text='Résumé de la commande embarqué dans le QR pour le mode offline', verbose_name='Données hors-ligne')),
                ('est_utilise', models.BooleanField(db_index=True, default=False, verbose_name='Utilisé')),
                ('date_utilisation', models.DateTimeField(blank=True, null=True, verbose_name='Date utilisation')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('commande', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='qr_code', to='commandes.commande')),
                ('utilise_par', models.ForeignKey(blank=True, limit_choices_to={'role': 'LIVREUR'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='qr_codes_scannes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'QR Code commande',
                'verbose_name_plural': 'QR Codes commandes',
            },
        ),
    ]
