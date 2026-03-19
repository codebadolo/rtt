"""
Management command: reorganiser_secteurs
Réorganise les secteurs et salles selon la structure physique réelle :

  Secteur 1 — Amphis       : R0, R1, R2, R4
  Secteur 2 — Salles 01-13 : Salle 01 → Salle 13
  Secteur 3 — Salles 14-27 : Salle 14 → Salle 27 + Tour du Savoir 1 & 2
  Secteur 4 — Laboratoires : LAB A R01, LAB B R01-03, Room 03-08

Usage:
  docker exec ritoto-express-backend python manage.py reorganiser_secteurs
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import Secteur, Salle
from apps.commandes.models import Commande


SECTEURS = [
    {
        'code': 'SEC1',
        'nom': 'Secteur 1',
        'description': 'Amphis : R0, R1, R2, R4',
    },
    {
        'code': 'SEC2',
        'nom': 'Secteur 2',
        'description': 'Salles 01 à 13',
    },
    {
        'code': 'SEC3',
        'nom': 'Secteur 3',
        'description': 'Salles 14 à 27 — Tour du Savoir',
    },
    {
        'code': 'SEC4',
        'nom': 'Secteur 4',
        'description': 'Laboratoires : LAB A, LAB B, Rooms 03-08',
    },
]

# code_salle → code_secteur de destination
SALLE_SECTEUR_MAP = {
    # ── Secteur 1 : Amphis ──────────────────────────────────
    'AMPHI-R0': 'SEC1',
    'AMPHI-R1': 'SEC1',
    'AMPHI-R2': 'SEC1',
    'AMPHI-R4': 'SEC1',

    # ── Secteur 2 : Salles 01-13 ────────────────────────────
    'S01': 'SEC2', 'S02': 'SEC2', 'S03': 'SEC2', 'S04': 'SEC2',
    'S05': 'SEC2', 'S06': 'SEC2', 'S07': 'SEC2', 'S08': 'SEC2',
    'S09': 'SEC2', 'S10': 'SEC2', 'S11': 'SEC2', 'S12': 'SEC2',
    'S13': 'SEC2',

    # ── Secteur 3 : Salles 14-27 + Tour du Savoir ───────────
    'S14': 'SEC3', 'S15': 'SEC3', 'S16': 'SEC3', 'S17': 'SEC3',
    'S18': 'SEC3', 'S19': 'SEC3', 'S20': 'SEC3', 'S21': 'SEC3',
    'S22': 'SEC3', 'S23': 'SEC3', 'S24': 'SEC3', 'S25': 'SEC3',
    'S26': 'SEC3', 'S27': 'SEC3',
    'TOUR-SAVOIR-1': 'SEC3',
    'TOUR-SAVOIR-2': 'SEC3',
    'PR-TOGUYENI':   'SEC3',

    # ── Secteur 4 : Laboratoires ────────────────────────────
    'LAB-A-01':  'SEC4',
    'LAB-B-01':  'SEC4', 'LAB-B-02': 'SEC4', 'LAB-B-03': 'SEC4',
    'ROOM-03':   'SEC4', 'ROOM-04':  'SEC4', 'ROOM-05':  'SEC4',
    'ROOM-06':   'SEC4', 'ROOM-07':  'SEC4', 'ROOM-08':  'SEC4',
}

# Salles à créer si elles n'existent pas encore
SALLES_A_CREER = [
    {
        'code': 'TOUR-SAVOIR-1',
        'nom': 'Salle Tour du Savoir 1',
        'batiment': 'Tour du Savoir',
        'etage': 'RDC',
    },
    {
        'code': 'TOUR-SAVOIR-2',
        'nom': 'Salle Tour du Savoir 2',
        'batiment': 'Tour du Savoir',
        'etage': 'Étage 1',
    },
]

# Anciens codes à remplacer (ex: TOUR-SAVOIR → TOUR-SAVOIR-1)
CODE_RENAMES = {
    'TOUR-SAVOIR': 'TOUR-SAVOIR-1',
}


class Command(BaseCommand):
    help = 'Réorganise les secteurs et salles selon la structure physique réelle'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n📐 Réorganisation des secteurs et salles\n'))

        # ── 1. Créer / mettre à jour les 4 secteurs ───────────────────
        secteurs = {}
        for data in SECTEURS:
            sec, created = Secteur.objects.update_or_create(
                code=data['code'],
                defaults={
                    'nom': data['nom'],
                    'description': data['description'],
                    'est_actif': True,
                }
            )
            secteurs[data['code']] = sec
            label = '✅ Créé' if created else '🔄 Mis à jour'
            self.stdout.write(f'  {label}  {sec.nom} ({sec.code})')

        # ── 2. Renommer les anciens codes de salles ────────────────────
        for old_code, new_code in CODE_RENAMES.items():
            updated = Salle.objects.filter(code=old_code).update(code=new_code)
            if updated:
                self.stdout.write(f'  🔁 Salle renommée : {old_code} → {new_code}')

        # ── 3. Créer les salles manquantes ─────────────────────────────
        # (secteur temporaire, sera mis à jour juste après)
        tmp_secteur = list(secteurs.values())[0]
        for salle_data in SALLES_A_CREER:
            _, created = Salle.objects.get_or_create(
                code=salle_data['code'],
                defaults={
                    'secteur': tmp_secteur,
                    'nom': salle_data['nom'],
                    'batiment': salle_data.get('batiment', ''),
                    'etage': salle_data.get('etage', ''),
                    'est_actif': True,
                }
            )
            if created:
                self.stdout.write(f'  ➕ Salle créée : {salle_data["nom"]}')

        # ── 4. Réassigner chaque salle au bon secteur ─────────────────
        reassigned = 0
        unknown = []
        for salle in Salle.objects.all():
            sec_code = SALLE_SECTEUR_MAP.get(salle.code)
            if sec_code and sec_code in secteurs:
                salle.secteur = secteurs[sec_code]
                salle.save(update_fields=['secteur'])
                reassigned += 1
            else:
                unknown.append(salle.code)

        self.stdout.write(self.style.SUCCESS(f'\n  ✅ {reassigned} salles réassignées'))
        if unknown:
            self.stdout.write(self.style.WARNING(f'  ⚠️  Salles sans mapping : {", ".join(unknown)}'))

        # ── 5. Mettre à jour secteur des commandes ─────────────────────
        cmd_updated = 0
        for commande in Commande.objects.select_related('salle__secteur').all():
            if commande.salle and commande.salle.secteur != commande.secteur:
                commande.secteur = commande.salle.secteur
                commande.save(update_fields=['secteur'])
                cmd_updated += 1
        if cmd_updated:
            self.stdout.write(f'  📦 {cmd_updated} commandes mises à jour (secteur)')

        # ── 6. Supprimer l'ancien secteur ISIG s'il est vide ──────────
        try:
            isig = Secteur.objects.get(code='ISIG')
            salles_restantes = Salle.objects.filter(secteur=isig).count()
            commandes_restantes = Commande.objects.filter(secteur=isig).count()
            if salles_restantes == 0 and commandes_restantes == 0:
                isig.delete()
                self.stdout.write(self.style.SUCCESS('  🗑  Ancien secteur ISIG supprimé (plus de dépendances)'))
            else:
                self.stdout.write(self.style.WARNING(
                    f'  ⚠️  Secteur ISIG conservé ({salles_restantes} salles, {commandes_restantes} commandes encore liées)'
                ))
        except Secteur.DoesNotExist:
            pass

        # ── Résumé ─────────────────────────────────────────────────────
        self.stdout.write('\n' + self.style.MIGRATE_HEADING('📊 Résumé final :'))
        for sec in Secteur.objects.order_by('code'):
            nb = Salle.objects.filter(secteur=sec).count()
            self.stdout.write(f'  {sec.nom} ({sec.code}) — {nb} salle(s)')

        self.stdout.write(self.style.SUCCESS('\n✅ Réorganisation terminée\n'))
