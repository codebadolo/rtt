from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0007_add_comptes_admin_settlement'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuration',
            name='commandes_actives',
            field=models.BooleanField(
                default=True,
                help_text='Désactiver pour bloquer toutes les commandes (maintenance, fermeture exceptionnelle)',
                verbose_name='Commandes actives',
            ),
        ),
        migrations.AddField(
            model_name='configuration',
            name='heure_ouverture',
            field=models.TimeField(
                blank=True,
                null=True,
                help_text="Heure à partir de laquelle les commandes sont acceptées (ex: 07:00)",
                verbose_name="Heure d'ouverture",
            ),
        ),
        migrations.AddField(
            model_name='configuration',
            name='heure_fermeture',
            field=models.TimeField(
                blank=True,
                null=True,
                help_text="Heure à partir de laquelle les commandes sont bloquées (ex: 17:00)",
                verbose_name='Heure de fermeture',
            ),
        ),
    ]
