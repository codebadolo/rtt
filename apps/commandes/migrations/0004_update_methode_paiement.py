from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commandes', '0003_paiementsenfenico'),
    ]

    operations = [
        migrations.AlterField(
            model_name='commande',
            name='methode_paiement',
            field=models.CharField(
                choices=[
                    ('ORANGE', 'Orange Money'),
                    ('MOOV', 'Moov Money'),
                    ('SANK', 'Sank Money'),
                ],
                max_length=10,
                verbose_name='Méthode de paiement',
            ),
        ),
    ]
