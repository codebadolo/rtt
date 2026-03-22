from django.db import migrations, models
from decimal import Decimal, ROUND_HALF_UP


def recalculer_frais_service(apps, schema_editor):
    """Recalcule frais_service = 10% de total_ht pour toutes les commandes existantes."""
    Commande = apps.get_model('commandes', 'Commande')
    taux = Decimal('10')
    for commande in Commande.objects.all():
        total_ht = Decimal(str(commande.total_ht))
        frais_service = (total_ht * taux / Decimal('100')).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )
        commande.frais_service = frais_service
        commande.total_ttc = total_ht + frais_service
        commande.save(update_fields=['frais_service', 'total_ttc'])


class Migration(migrations.Migration):

    dependencies = [
        ('commandes', '0006_add_plainte_heure_souhaitee_required'),
        ('administration', '0006_configuration_taux_service'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='commande',
            name='frais_livraison',
        ),
        migrations.RemoveField(
            model_name='commande',
            name='frais_paiement',
        ),
        migrations.AddField(
            model_name='commande',
            name='frais_service',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                editable=False,
                max_digits=10,
                verbose_name='Frais de service',
            ),
        ),
        migrations.RunPython(recalculer_frais_service, migrations.RunPython.noop),
    ]
