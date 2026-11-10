from django.db import migrations, models


def fusionner_vendeurs(apps, schema_editor):
    Utilisateur = apps.get_model('authentification', 'Utilisateur')
    Utilisateur.objects.filter(role__in=['VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR']).update(role='VENDEUR')


def separer_vendeurs(apps, schema_editor):
    # Retour arrière : la distinction intérieur/extérieur est déduite de l'adresse du commerce
    Utilisateur = apps.get_model('authentification', 'Utilisateur')
    for user in Utilisateur.objects.filter(role='VENDEUR').select_related('profil_vendeur'):
        profil = getattr(user, 'profil_vendeur', None)
        exterieur = profil is not None and (profil.adresse_commerce or '').strip()
        user.role = 'VENDEUR_EXTERIEUR' if exterieur else 'VENDEUR_INTERIEUR'
        user.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('authentification', '0008_parcours_identification_telephone_verifie'),
        ('administration', '0013_vendeur_statut_validation_suppression_cnib'),
    ]

    operations = [
        migrations.AlterField(
            model_name='utilisateur',
            name='role',
            field=models.CharField(
                choices=[
                    ('ETUDIANT', 'Client'), ('LIVREUR', 'Livreur'), ('VENDEUR', 'Vendeur'),
                    ('CHEF_SECTEUR', 'Chef de Secteur'),
                    ('ADMIN_UNIVERSITAIRE', 'Administrateur universitaire'),
                    ('ADMIN', 'Super Administrateur'),
                ],
                db_index=True, default='ETUDIANT', max_length=20, verbose_name='Rôle',
            ),
        ),
        migrations.RunPython(fusionner_vendeurs, separer_vendeurs),
    ]
