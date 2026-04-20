from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0009_add_horaires_actifs'),
    ]

    operations = [
        migrations.CreateModel(
            name='HoraireSemaine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jour', models.IntegerField(
                    choices=[
                        (0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'), (3, 'Jeudi'),
                        (4, 'Vendredi'), (5, 'Samedi'), (6, 'Dimanche'),
                    ],
                    verbose_name='Jour',
                )),
                ('actif', models.BooleanField(default=True, verbose_name='Ouvert')),
                ('heure_ouverture', models.TimeField(blank=True, null=True, verbose_name="Heure d'ouverture")),
                ('heure_fermeture', models.TimeField(blank=True, null=True, verbose_name='Heure de fermeture')),
                ('configuration', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='horaires_semaine',
                    to='administration.configuration',
                )),
            ],
            options={
                'verbose_name': 'Horaire hebdomadaire',
                'verbose_name_plural': 'Horaires hebdomadaires',
                'ordering': ['jour'],
                'unique_together': {('configuration', 'jour')},
            },
        ),
    ]
