from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0005_secteur_chefs'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='configuration',
            name='frais_livraison_actif',
        ),
        migrations.RemoveField(
            model_name='configuration',
            name='frais_livraison_montant',
        ),
        migrations.RemoveField(
            model_name='configuration',
            name='frais_livraison_type',
        ),
        migrations.RemoveField(
            model_name='configuration',
            name='frais_orange',
        ),
        migrations.RemoveField(
            model_name='configuration',
            name='frais_moov',
        ),
        migrations.RemoveField(
            model_name='configuration',
            name='frais_sank',
        ),
        migrations.AddField(
            model_name='configuration',
            name='taux_service',
            field=models.DecimalField(
                decimal_places=2,
                default=10,
                help_text='Pourcentage appliqué sur le sous-total produits (ex: 10 = 10%)',
                max_digits=5,
                verbose_name='Taux de frais de service (%)',
            ),
        ),
    ]
