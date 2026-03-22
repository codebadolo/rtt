# Plan de Déploiement — Ritoto Express
## VPS Contabo · Docker · ritoto-campus.com

---

## 1. Architecture cible

```
Internet
   │
   ▼
[ Nginx ] ── SSL Let's Encrypt (Certbot)
   │
   ├── ritoto-campus.com       → Frontend React (fichiers statiques)
   │
   └── api.ritoto-campus.com   → Backend Django
                                   ├── HTTP  → Gunicorn  (requêtes REST)
                                   └── WS    → Daphne    (WebSockets temps réel)
                                                   │
                                              [ Redis ]
                                              ├── Cache Django
                                              ├── Sessions
                                              └── Channel Layer (WebSockets)
                                                   │
                                           [ PostgreSQL ]
                                           └── Base de données principale
                                                   │
                                           [ Volumes Docker ]
                                           └── media / backups / logs
```

**Conteneurs Docker :**

| Service        | Image                 | Rôle                                              | Port interne |
|----------------|-----------------------|---------------------------------------------------|--------------|
| `backend`      | Python 3.11           | Django + Gunicorn (requêtes HTTP REST)             | 8000         |
| `daphne`       | Python 3.11           | Django Channels + Daphne (WebSockets)             | 8001         |
| `worker`       | Python 3.11           | Celery (tâches asynchrones, envoi emails)         | —            |
| `frontend`     | Nginx + build Vite    | Servir les fichiers statiques React               | 80           |
| `nginx`        | Nginx Alpine          | Reverse proxy, SSL, cache HTTP                    | 80 / 443     |
| `redis`        | Redis Alpine          | Cache, sessions, channel layer WebSocket          | 6379         |
| `postgres`     | PostgreSQL 16 Alpine  | Base de données principale                        | 5432         |

---

## 2. Prérequis VPS

- **OS :** Ubuntu 22.04 LTS
- **RAM minimale :** 4 Go (8 Go recommandé avec PostgreSQL + Channels)
- **Stockage :** 40 Go SSD minimum
- **Logiciels :** Docker Engine, Docker Compose v2, Git, Certbot

**DNS à configurer chez le registrar :**
```
ritoto-campus.com      A  →  <IP_VPS>
www.ritoto-campus.com  A  →  <IP_VPS>
api.ritoto-campus.com  A  →  <IP_VPS>
```

---

## 3. Roadmap de déploiement

### Phase 1 — Préparer le serveur

- [ ] Louer et initialiser le VPS Contabo (Ubuntu 22.04)
- [ ] Créer un utilisateur non-root avec accès sudo
- [ ] Configurer le pare-feu : ouvrir ports 80, 443, 22 (SSH)
- [ ] Installer Docker Engine + Docker Compose v2
- [ ] Installer Certbot (pour SSL Let's Encrypt)
- [ ] Pointer les DNS du domaine vers l'IP du VPS
- [ ] Cloner le dépôt Git sur le VPS (`/var/www/ritoto/`)

---

### Phase 2 — PostgreSQL

#### 2.1 Passer de SQLite à PostgreSQL

- [ ] Ajouter `psycopg2-binary` dans `requirements.txt`
- [ ] Mettre à jour `settings.py` :
  ```python
  DATABASES = {
      "default": {
          "ENGINE": "django.db.backends.postgresql",
          "NAME": os.getenv("POSTGRES_DB", "ritoto"),
          "USER": os.getenv("POSTGRES_USER", "ritoto"),
          "PASSWORD": os.getenv("POSTGRES_PASSWORD"),
          "HOST": os.getenv("POSTGRES_HOST", "postgres"),
          "PORT": os.getenv("POSTGRES_PORT", "5432"),
          "CONN_MAX_AGE": 60,
      }
  }
  ```
- [ ] Variables d'environnement à ajouter dans `.env.production` :
  ```
  POSTGRES_DB=ritoto
  POSTGRES_USER=ritoto
  POSTGRES_PASSWORD=<mot de passe fort>
  POSTGRES_HOST=postgres
  ```

#### 2.2 Migration des données existantes

- [ ] Exporter les données SQLite avec `python manage.py dumpdata > data.json`
- [ ] Lancer PostgreSQL, appliquer les migrations (`migrate`)
- [ ] Importer les données : `python manage.py loaddata data.json`
- [ ] Vérifier l'intégrité

---

### Phase 3 — Temps réel (WebSockets)

C'est la partie la plus importante pour l'expérience utilisateur. Elle permet :
- L'étudiant voit son statut de commande changer en direct (EN_ATTENTE → VALIDEE → DISTRIBUEE)
- Les notifications s'affichent instantanément sans recharger la page
- Le chef de secteur reçoit les nouvelles commandes en temps réel

#### 3.1 Stack technique côté backend

**Librairies à ajouter dans `requirements.txt` :**
```
channels==4.*
channels-redis==4.*
daphne==4.*
celery==5.*
celery[redis]
```

**Django Channels** gère les connexions WebSocket.
**Redis** sert de channel layer (bus de messages entre les workers).
**Daphne** est le serveur ASGI qui remplace Gunicorn pour les WebSockets.

> En production, on fait tourner **Gunicorn pour l'HTTP** et **Daphne pour les WebSockets** en parallèle derrière Nginx.

#### 3.2 Ce qu'il faut créer côté backend

**a) Configurer ASGI et les Channels (`config/asgi.py`) :**
```python
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import apps.commandes.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(apps.commandes.routing.websocket_urlpatterns)
    ),
})
```

**b) Ajouter dans `settings.py` :**
```python
INSTALLED_APPS += ["channels", "daphne"]

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.getenv("REDIS_URL", "redis://redis:6379/1")]},
    }
}
```

**c) Créer `apps/commandes/consumers.py` — le Consumer WebSocket :**

Le Consumer écoute les connexions WS et envoie des messages aux clients connectés.

Logique :
- À la connexion : l'utilisateur rejoint son groupe personnel (`user_{id}`)
- Quand une commande change de statut : on envoie un message JSON au groupe
- Le frontend reçoit le message et met à jour l'interface

```python
# Exemple de structure (à implémenter)
class CommandeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Rejoindre le groupe de l'utilisateur connecté
        self.group_name = f"user_{self.scope['user'].id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def commande_update(self, event):
        # Envoyer la mise à jour au client WebSocket
        await self.send(text_data=json.dumps(event["data"]))
```

**d) Déclencher les mises à jour depuis les vues/modèles :**

À chaque changement de statut d'une commande (dans `Commande.valider()`, `distribuer()`, etc.), envoyer un signal au groupe WebSocket :

```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def envoyer_mise_a_jour_commande(commande):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{commande.etudiant_id}",
        {
            "type": "commande.update",
            "data": {
                "commande_id": commande.id,
                "numero": commande.numero_commande,
                "statut": commande.statut,
                "message": f"Commande {commande.numero_commande} : {commande.get_statut_display()}",
            },
        },
    )
```

Appeler cette fonction dans chaque méthode de changement de statut du modèle `Commande` : `valider()`, `rejeter()`, `marquer_prete()`, `distribuer()`.

**e) Créer `apps/commandes/routing.py` :**
```python
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/commandes/$", consumers.CommandeConsumer.as_asgi()),
]
```

#### 3.3 Ce qu'il faut créer côté frontend

**a) Hook `useWebSocket.js` :**

Un hook React qui :
- Ouvre la connexion WebSocket vers `wss://api.ritoto-campus.com/ws/commandes/`
- Écoute les messages entrants
- Reconnecte automatiquement si la connexion est perdue (backoff exponentiel)
- Se déconnecte proprement quand le composant est démonté

**b) Store de notifications (`notificationsStore.js`) :**

Un store Zustand (comme `cartStore`) qui contient :
```javascript
{
  notifications: [],          // liste des notifs non lues
  addNotification(notif),     // ajouter une notif
  markAllRead(),              // tout marquer comme lu
  unreadCount,                // badge compteur
}
```

**c) Composant `NotificationBell.jsx` :**
- Icône cloche dans le topbar avec un badge rouge (nombre de notifs non lues)
- Dropdown qui liste les dernières notifications
- Clic → redirige vers la commande concernée

**d) Intégration dans `DashboardLayout.jsx` :**
- Monter le hook WebSocket dès que l'utilisateur est connecté
- Chaque message reçu → `addNotification()` + `toast.success()` (notification flash)
- Les étudiants voient les mises à jour de leurs commandes
- Les chefs de secteur voient les nouvelles commandes entrantes

**e) URL WebSocket selon l'environnement :**
```javascript
// Dans api/client.js ou un fichier config
const WS_URL = import.meta.env.VITE_WS_URL || "wss://api.ritoto-campus.com"
```

#### 3.4 Groupes WebSocket par rôle

| Groupe              | Qui reçoit            | Événements                                   |
|---------------------|-----------------------|----------------------------------------------|
| `user_{id}`         | Chaque étudiant       | Statut de ses commandes, confirmation paiement |
| `chef_{secteur_id}` | Chef de secteur       | Nouvelle commande reçue dans son secteur       |
| `admin`             | Administrateurs       | Toutes les nouvelles commandes, alertes        |

#### 3.5 Types de notifications

| Événement                     | Destinataire    | Message                                          |
|-------------------------------|-----------------|--------------------------------------------------|
| Commande créée                | Chef secteur    | "Nouvelle commande de {nom} — {total} FCFA"      |
| Paiement validé (Senfenico)   | Étudiant        | "Paiement reçu ! Commande {num} en préparation" |
| Commande validée par chef     | Étudiant        | "Votre commande {num} est validée ✓"             |
| Commande rejetée              | Étudiant        | "Commande {num} rejetée : {motif}"               |
| Commande prête (PRETE)        | Étudiant        | "Votre commande est prête ! Le livreur arrive…"  |
| Commande distribuée           | Étudiant        | "Commande {num} livrée. Bon appétit !"           |

---

### Phase 4 — Cache

#### 4.1 Redis comme backend de cache Django

- [ ] Ajouter dans `settings.py` :
  ```python
  CACHES = {
      "default": {
          "BACKEND": "django.core.cache.backends.redis.RedisCache",
          "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/0"),
          "TIMEOUT": 300,
      }
  }
  SESSION_ENGINE = "django.contrib.sessions.backends.cache"
  SESSION_CACHE_ALIAS = "default"
  ```

#### 4.2 Stratégie de cache par route

| Route                         | Cache Nginx       | Cache Django (Redis) | Invalidation              |
|-------------------------------|-------------------|----------------------|---------------------------|
| `dist/assets/*.js/.css`       | 1 an (immutable)  | —                    | Nom de fichier versionné  |
| `dist/index.html`             | no-cache          | —                    | À chaque déploiement      |
| `GET /api/produits/`          | —                 | 5 minutes            | À la modification produit |
| `GET /api/configuration/`     | —                 | 10 minutes           | À la sauvegarde config    |
| `GET /api/commandes/`         | no-store          | —                    | Toujours frais            |
| `GET /api/commandes/{id}/`    | no-store          | —                    | Toujours frais            |
| `/media/*`                    | 7 jours           | —                    | Rarement modifié          |
| `/admin/`                     | no-store          | —                    | Jamais caché              |

---

### Phase 5 — Adapter le projet pour la production

- [ ] Créer `.env.production` avec toutes les variables :
  ```
  DJANGO_SECRET_KEY=<clé longue et aléatoire>
  DJANGO_DEBUG=False
  DJANGO_ALLOWED_HOSTS=api.ritoto-campus.com
  FRONTEND_URL=https://ritoto-campus.com
  CORS_ALLOWED_ORIGINS=https://ritoto-campus.com
  CSRF_TRUSTED_ORIGINS=https://api.ritoto-campus.com

  POSTGRES_DB=ritoto
  POSTGRES_USER=ritoto
  POSTGRES_PASSWORD=<mot de passe fort>
  POSTGRES_HOST=postgres

  REDIS_URL=redis://redis:6379/0

  SENFENICO_API_KEY=<clé production>
  SENFENICO_WEBHOOK_SECRET=<secret production>

  EMAIL_HOST=smtp.gmail.com
  EMAIL_HOST_USER=<email>
  EMAIL_HOST_PASSWORD=<mot de passe app>

  VITE_API_URL=https://api.ritoto-campus.com/api
  VITE_WS_URL=wss://api.ritoto-campus.com
  ```

- [ ] Activer les headers de sécurité dans `settings.py` :
  ```python
  SECURE_SSL_REDIRECT = True
  SECURE_HSTS_SECONDS = 31536000
  SESSION_COOKIE_SECURE = True
  CSRF_COOKIE_SECURE = True
  ```

---

### Phase 6 — Docker en production

#### 6.1 Structure des conteneurs (`docker-compose.prod.yml`)

- [ ] **`postgres`** — PostgreSQL 16, volume `postgres_data`
- [ ] **`redis`** — Redis Alpine, volume `redis_data`
- [ ] **`backend`** — Gunicorn, volumes `media_data` + `static_data`
- [ ] **`daphne`** — Daphne ASGI pour les WebSockets, même code que `backend`
- [ ] **`worker`** — Celery (emails asynchrones, tâches de fond)
- [ ] **`frontend`** — Nginx servant les fichiers `dist/` buildés
- [ ] **`nginx`** — Reverse proxy (ports 80 et 443)

**Volumes persistants :**
```
postgres_data  → /var/lib/postgresql/data/   (base de données)
redis_data     → /data/                      (persistance Redis)
media_data     → /app/media/                 (images produits, captures)
static_data    → /app/static/                (fichiers statiques Django)
certs          → /etc/letsencrypt/           (certificats SSL)
```

#### 6.2 Routing Nginx pour les WebSockets

Nginx doit router différemment HTTP et WebSocket :
```
/ws/*           → daphne:8001   (upgrade WebSocket)
/api/*          → backend:8000  (Gunicorn HTTP)
/media/*, /static/* → fichiers directs
/               → frontend:80   (React)
```

Configuration Nginx pour le WebSocket :
```nginx
location /ws/ {
    proxy_pass http://daphne:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;  # maintenir la connexion ouverte 24h
}
```

#### 6.3 Dockerfile de production

- [ ] Créer `Dockerfile.prod` :
  - Stage 1 : installer les dépendances Python
  - Stage 2 : copier le code, `collectstatic`
  - Le même image tourne Gunicorn **ou** Daphne selon la commande Docker
  - Ne jamais embarquer `.env`, `media/` dans l'image

---

### Phase 7 — SSL avec Let's Encrypt

- [ ] Lancer Certbot avant de démarrer Nginx :
  ```bash
  certbot certonly --standalone \
    -d ritoto-campus.com \
    -d www.ritoto-campus.com \
    -d api.ritoto-campus.com
  ```
- [ ] Monter `/etc/letsencrypt/` en volume dans le conteneur Nginx
- [ ] Renouvellement automatique (cron) :
  ```bash
  0 3 * * * certbot renew --quiet && docker compose -f docker-compose.prod.yml restart nginx
  ```

---

### Phase 8 — Système de backup

#### 8.1 Ce qu'il faut sauvegarder

| Donnée           | Emplacement                   | Criticité |
|------------------|-------------------------------|-----------|
| Base PostgreSQL  | volume `postgres_data`        | Critique  |
| Fichiers media   | volume `media_data`           | Haute     |
| Fichier `.env`   | `/var/www/ritoto/.env`    | Critique  |
| Config Nginx     | `docker/nginx/conf.d/`        | Moyenne   |
| Certificats SSL  | `/etc/letsencrypt/`           | Haute     |

#### 8.2 Script de backup (`docker/scripts/backup.sh`)

Le script doit :
1. Faire un dump PostgreSQL depuis le conteneur :
   ```bash
   docker compose exec -T postgres pg_dump -U ritoto ritoto > ritoto-$(date +%Y%m%d).sql
   ```
2. Archiver les fichiers `media/`
3. Compresser le tout : `ritoto-backup-YYYYMMDD.tar.gz`
4. Garder les **14 derniers backups** (supprimer les plus anciens)
5. Optionnel : upload vers un stockage distant (Contabo Object Storage, Backblaze B2)

- [ ] Planifier avec cron (backup quotidien à 2h du matin) :
  ```bash
  0 2 * * * /var/www/ritoto/docker/scripts/backup.sh >> /var/log/ritoto-backup.log 2>&1
  ```

#### 8.3 Procédure de restauration

1. Arrêter les conteneurs : `docker compose -f docker-compose.prod.yml down`
2. Restaurer la base : `docker compose exec -T postgres psql -U ritoto ritoto < backup.sql`
3. Restaurer les media dans le volume `media_data`
4. Redémarrer : `docker compose -f docker-compose.prod.yml up -d`

---

### Phase 9 — Mise en ligne

- [ ] Premier démarrage :
  ```bash
  docker compose -f docker-compose.prod.yml up -d --build
  docker compose exec backend python manage.py migrate
  docker compose exec backend python manage.py collectstatic --noinput
  docker compose exec backend python manage.py createsuperuser
  ```

- [ ] Checklist de vérification :
  - [ ] https://ritoto-campus.com → Frontend React s'affiche
  - [ ] https://api.ritoto-campus.com/api/ → API répond en JSON
  - [ ] https://api.ritoto-campus.com/admin/ → Interface admin Django
  - [ ] Connexion / inscription fonctionne
  - [ ] Passer une commande et vérifier le WebSocket (statut en temps réel)
  - [ ] Notification reçue instantanément côté étudiant
  - [ ] Chef de secteur reçoit la notification de nouvelle commande
  - [ ] Paiement Senfenico (clé production)
  - [ ] Certificat SSL valide (cadenas vert)
  - [ ] Backup automatique activé (vérifier le cron)

---

### Phase 10 — Opérations courantes

#### Déployer une mise à jour backend

```bash
git pull
docker compose -f docker-compose.prod.yml build backend daphne worker
docker compose -f docker-compose.prod.yml up -d --no-deps backend daphne worker
docker compose exec backend python manage.py migrate
```

#### Mettre à jour le frontend uniquement

```bash
cd frontend && npm run build
docker compose -f docker-compose.prod.yml restart frontend nginx
```

#### Consulter les logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f daphne   # WebSockets
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f worker    # Celery
```

#### Accéder au shell Django

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

---

## 4. Récapitulatif des fichiers à créer

```
ritoto-express/
├── Dockerfile.prod                        ← Dockerfile production (Gunicorn + Daphne)
├── docker-compose.prod.yml                ← Stack complète production
├── .env.production.example                ← Template des variables d'env
└── docker/
    ├── nginx/
    │   ├── nginx.conf                     ← Config globale Nginx
    │   └── conf.d/
    │       ├── ritoto-campus.com.conf     ← Frontend + SSL
    │       └── api.ritoto-campus.com.conf ← API + WebSocket + SSL
    └── scripts/
        ├── backup.sh                      ← Backup quotidien PostgreSQL + media
        └── restore.sh                     ← Restauration depuis un backup
```

**Fichiers à créer dans le code Django :**
```
apps/commandes/
├── consumers.py      ← Consumer WebSocket (CommandeConsumer)
├── routing.py        ← URL WebSocket (/ws/commandes/)
└── signals.py        ← Signal Django → envoi message WebSocket

config/
└── asgi.py           ← Mettre à jour avec ProtocolTypeRouter
```

**Fichiers à créer dans le code React :**
```
frontend/src/
├── hooks/
│   └── useWebSocket.js        ← Connexion WS + reconnexion auto
├── stores/
│   └── notificationsStore.js  ← Zustand store des notifications
└── components/
    └── NotificationBell.jsx   ← Cloche + badge + dropdown
```

---

## 5. Points d'attention

### Sécurité
- Ne jamais committer `.env` sur Git (vérifier `.gitignore`)
- Changer la `DJANGO_SECRET_KEY` entre dev et prod
- Désactiver `DEBUG=True` en production
- Authentifier les connexions WebSocket côté consumer (vérifier `self.scope["user"].is_authenticated`)

### Senfenico en production
- Obtenir une **clé API production** distincte de la clé de test
- Configurer le **webhook URL** dans le dashboard Senfenico :
  `https://api.ritoto-campus.com/api/commandes/webhook/`
- Après la validation webhook → déclencher l'envoi WebSocket à l'étudiant

### WebSockets en production
- Les connexions WebSocket restent ouvertes longtemps : prévoir `proxy_read_timeout 86400` dans Nginx
- Gérer la reconnexion automatique côté frontend (réseau instable sur mobile)
- Limiter le nombre de connexions WebSocket simultanées par utilisateur

### Monitoring (optionnel, phase suivante)
- **Uptime Robot** (gratuit) : alerte si le site tombe
- **Sentry** : tracking des erreurs Python et JavaScript
- **Flower** : interface de monitoring des tâches Celery

---

*Document de référence — Ritoto Express · Version 2.0 · Mars 2026*
