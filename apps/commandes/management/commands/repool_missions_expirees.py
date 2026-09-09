from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.commandes.models import Commande, StatutCommande, HistoriqueCommande


class Command(BaseCommand):
    """
    Remet dans le pool disponible les missions acceptées par un livreur mais
    restées sans mise à jour de statut pendant 20-30 minutes (§7, §14.6).
    Incrémente le compteur d'abandon du livreur pour signal admin en cas de
    récidive.

    À planifier toutes les 5-10 minutes (cron / celery beat).
    """

    help = "Remet en pool les missions livreur acceptées et abandonnées depuis plus de 25 minutes"

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes', type=int, default=25,
            help="Délai en minutes avant remise en pool (§7 : 20-30 min)",
        )

    def handle(self, *args, **options):
        delai = options['minutes']
        seuil = timezone.now() - timedelta(minutes=delai)

        expirees = Commande.objects.filter(
            statut=StatutCommande.EN_LIVRAISON,
            date_acceptation_livreur__lt=seuil,
        ).select_related('livreur_assigne')

        count = 0
        for commande in expirees:
            livreur = commande.livreur_assigne
            commande.statut = StatutCommande.PRETE
            commande.livreur_assigne = None
            commande.date_acceptation_livreur = None
            commande.save(update_fields=['statut', 'livreur_assigne', 'date_acceptation_livreur'])

            HistoriqueCommande.objects.create(
                commande=commande,
                ancien_statut=StatutCommande.EN_LIVRAISON,
                nouveau_statut=StatutCommande.PRETE,
                modifie_par=None,
                commentaire=f"Mission abandonnée par {livreur.get_full_name() if livreur else 'un livreur'} "
                            f"après {delai} min sans mise à jour — remise dans le pool",
            )

            if livreur is not None and hasattr(livreur, 'profil_livreur'):
                profil = livreur.profil_livreur
                profil.compteur_abandon += 1
                profil.save(update_fields=['compteur_abandon'])

            from apps.commandes.consumers import envoyer_mise_a_jour_commande
            envoyer_mise_a_jour_commande(commande)

            count += 1

        self.stdout.write(self.style.SUCCESS(f"{count} mission(s) remise(s) dans le pool."))
