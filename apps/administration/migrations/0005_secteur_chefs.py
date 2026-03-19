from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('administration', '0004_configuration_tarifaire'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(
            model_name='secteur',
            name='chef_actif',
        ),
        migrations.AddField(
            model_name='secteur',
            name='chefs',
            field=models.ManyToManyField(
                blank=True,
                limit_choices_to={'est_actif': True, 'role': 'CHEF_SECTEUR'},
                related_name='secteurs_supervises',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Chefs de secteur',
            ),
        ),
    ]
