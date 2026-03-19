from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('commandes', '0002_senfenico_payment'),
    ]

    operations = [
        migrations.CreateModel(
            name='PaiementSenfenico',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('charge_reference', models.CharField(max_length=100, unique=True, verbose_name='Référence charge')),
                ('statut', models.CharField(
                    choices=[
                        ('send_otp', 'En attente OTP'),
                        ('pay_offline', 'Paiement hors ligne'),
                        ('success', 'Succès'),
                        ('failed', 'Échoué'),
                        ('pending', 'En attente'),
                    ],
                    default='pending',
                    max_length=20,
                    verbose_name='Statut',
                )),
                ('display_text', models.TextField(blank=True, verbose_name='Texte affiché')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('date_modification', models.DateTimeField(auto_now=True)),
                ('commande', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='paiement_senfenico',
                    to='commandes.commande',
                )),
            ],
            options={
                'verbose_name': 'Paiement Senfenico',
                'verbose_name_plural': 'Paiements Senfenico',
            },
        ),
    ]
