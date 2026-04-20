from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commandes', '0007_commande_frais_service'),
    ]

    operations = [
        migrations.AlterField(
            model_name='commande',
            name='heure_souhaitee',
            field=models.TimeField(blank=True, null=True, verbose_name='Heure souhaitée'),
        ),
    ]
