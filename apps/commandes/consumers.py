import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class CommandeConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer pour les mises à jour de commandes en temps réel.

    Chaque utilisateur connecté rejoint son groupe personnel `user_{id}`.
    Les chefs de secteur rejoignent aussi `chef_{secteur_id}`.
    Les admins rejoignent le groupe `admin`.

    Pour envoyer une mise à jour depuis n'importe où dans Django :
        from apps.commandes.consumers import envoyer_mise_a_jour_commande
        envoyer_mise_a_jour_commande(commande)
    """

    async def connect(self):
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user
        self.groups_joined = []

        # Groupe personnel de l'utilisateur
        await self._join_group(f'user_{user.id}')

        # Groupe selon le rôle
        if hasattr(user, 'est_admin') and user.est_admin:
            await self._join_group('admin')

        elif hasattr(user, 'est_chef_secteur') and user.est_chef_secteur:
            # Rejoindre le groupe de chaque secteur supervisé
            secteur_ids = await self._get_secteur_ids(user)
            for sid in secteur_ids:
                await self._join_group(f'chef_{sid}')

        await self.accept()

    async def disconnect(self, close_code):
        for group in getattr(self, 'groups_joined', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data):
        # Le client n'envoie pas de messages — connexion lecture seule
        pass

    # ── Handlers de messages ──────────────────────────────────────────────────

    async def commande_update(self, event):
        """Reçoit un événement du channel layer et le transmet au client WS."""
        await self.send(text_data=json.dumps(event['data']))

    async def notification(self, event):
        """Notification générique (nouvelle commande, alerte, etc.)."""
        await self.send(text_data=json.dumps(event['data']))

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _join_group(self, group_name):
        await self.channel_layer.group_add(group_name, self.channel_name)
        self.groups_joined.append(group_name)

    @staticmethod
    async def _get_secteur_ids(user):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def fetch():
            return list(user.secteurs_supervises.values_list('id', flat=True))

        return await fetch()


# ─── Fonctions utilitaires ────────────────────────────────────────────────────
# Appeler depuis les modèles / vues pour envoyer des mises à jour temps réel.

def envoyer_mise_a_jour_commande(commande):
    """
    Envoie la mise à jour de statut d'une commande à l'étudiant concerné
    et aux chefs du secteur via WebSocket.
    Les erreurs WebSocket sont silencieuses pour ne pas bloquer la validation.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        messages_statut = {
            'EN_ATTENTE': 'Commande reçue, en attente de traitement.',
            'VALIDEE':    'Paiement confirmé ! Votre commande est en préparation.',
            'REJETEE':    'Votre commande a été rejetée.',
            'PRETE':      'Votre commande est prête ! Le livreur arrive.',
            'DISTRIBUEE': 'Commande livrée. Bon appétit !',
            'ANNULEE':    'Votre commande a été annulée.',
        }

        payload = {
            'type':    'commande_update',
            'commande_id': commande.id,
            'numero':  commande.numero_commande,
            'statut':  commande.statut,
            'message': messages_statut.get(commande.statut, f'Statut : {commande.statut}'),
            'total':   str(commande.total_ttc),
        }

        async_to_sync(channel_layer.group_send)(
            f'user_{commande.etudiant_id}',
            {'type': 'commande.update', 'data': payload},
        )
        async_to_sync(channel_layer.group_send)(
            f'chef_{commande.secteur_id}',
            {'type': 'commande.update', 'data': payload},
        )
    except Exception as e:
        logger.warning("WebSocket notification failed for commande %s: %s", commande.pk, e)


def notifier_nouvelle_commande(commande):
    """
    Notifie les chefs de secteur et les admins quand une nouvelle commande arrive.
    """
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    payload = {
        'type':        'notification',
        'event':       'nouvelle_commande',
        'commande_id': commande.id,
        'numero':      commande.numero_commande,
        'etudiant':    commande.etudiant.get_full_name(),
        'secteur':     commande.secteur.nom,
        'total':       str(commande.total_ttc),
        'message':     f'Nouvelle commande de {commande.etudiant.get_full_name()} — {commande.total_ttc} FCFA',
    }

    # Notifier les chefs du secteur
    async_to_sync(channel_layer.group_send)(
        f'chef_{commande.secteur_id}',
        {'type': 'notification', 'data': payload},
    )

    # Notifier les admins
    async_to_sync(channel_layer.group_send)(
        'admin',
        {'type': 'notification', 'data': payload},
    )
