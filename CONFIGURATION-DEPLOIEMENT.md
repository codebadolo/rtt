# Configuration du Déploiement — Ritoto Express

**Projet** : Ritoto Express
**Serveur** : VPS avec domaine géré sur LWS
**Répertoire d'installation** : `/var/www/ritoto`
**Utilisateur système** : `ritoto`
**Frontend** : https://ritoto-campus.com
**API / Backend** : https://api.ritoto-campus.com

---

## Table des matières

1. Vue d'ensemble de l'architecture
2. Utilisateur système et répertoire
3. Variables d'environnement
4. Configuration Docker
5. Configuration Django (settings)
6. Configuration Nginx
7. Certificats SSL
8. Système de backup
9. Script de déploiement automatique
10. Commandes de gestion courante

---

## 1. Vue d'ensemble de l'architecture

Le projet est composé de six conteneurs Docker qui communiquent entre eux sur un réseau interne. Seul le conteneur Nginx est exposé à l'extérieur (ports 80 et 443).

```
Internet
   |
   v
[Nginx] -- ports 80 et 443
   |
   |-- ritoto-campus.com        --> fichiers dist/ React (frontend statique)
   |
   |-- api.ritoto-campus.com
          |-- /ws/*             --> daphne:8001   (WebSockets temps réel)
          |-- /api/*            --> backend:8000  (API REST)
          |-- /admin/*          --> backend:8000  (interface admin Django)
          |-- /static/*         --> volume static_data (fichiers Django)
          |-- /media/*          --> volume media_data  (uploads)
```

Les six conteneurs sont :

| Conteneur         | Image                | Role                                        |
|-------------------|----------------------|---------------------------------------------|
| ritoto-postgres   | postgres:16-alpine   | Base de données PostgreSQL                  |
| ritoto-redis      | redis:7-alpine       | Cache, sessions, channel layer WebSocket    |
| ritoto-backend    | Dockerfile.prod      | Django avec Gunicorn (requetes HTTP)        |
| ritoto-daphne     | Dockerfile.prod      | Django Channels avec Daphne (WebSockets)    |
| ritoto-frontend   | nginx:1.25-alpine    | Serveur interne des fichiers React          |
| ritoto-nginx      | nginx:1.25-alpine    | Reverse proxy public (ports 80 / 443)       |

---

## 2. Utilisateur système et répertoire

### Pourquoi un utilisateur dedié

Le script de déploiement crée un utilisateur système nommé `ritoto`. Cela signifie que tous les fichiers du projet appartiennent à cet utilisateur, et que les commandes Docker sont executées sous son identité. On évite ainsi de faire tourner l'application en root, ce qui est une bonne pratique de sécurité sur un serveur de production.

### Ce que le script fait concrètement

```bash
# Creation de l'utilisateur avec son dossier personnel dans /var/www/ritoto
useradd --system --create-home --home-dir /var/www/ritoto --shell /bin/bash ritoto

# Ajout au groupe docker pour qu'il puisse lancer docker compose sans sudo
usermod -aG docker ritoto
```

### Structure du répertoire sur le VPS

```
/var/www/ritoto/
|-- docker-compose.prod.yml       fichier de composition Docker production
|-- Dockerfile.prod               image Docker backend
|-- .env.production               variables d'environnement (ne jamais committer)
|-- .env.production.example       modele vide a copier
|-- deploy.sh                     script de premier deploiement
|-- requirements.txt              dependances Python
|-- manage.py                     CLI Django
|-- apps/                         code source backend Django
|-- config/                       settings Django (base / development / production)
|-- frontend/
|   |-- dist/                     build React genere par npm run build
|   |-- src/                      code source React
|   |-- package.json
|-- docker/
|   |-- nginx/
|   |   |-- nginx.conf            configuration principale Nginx
|   |   |-- conf.d/
|   |   |   |-- frontend.conf     vhost ritoto-campus.com
|   |   |   |-- api.conf          vhost api.ritoto-campus.com
|   |   |-- frontend.conf         config interne conteneur frontend
|   |-- scripts/
|       |-- backup.sh             script de sauvegarde quotidienne
|       |-- restore.sh            script de restauration
|-- backups/                      archives de sauvegarde (14 derniers jours)
```

---

## 3. Variables d'environnement

Toute la configuration sensible est centralisée dans le fichier `.env.production`. Ce fichier n'est jamais versionné sur Git. Le modèle vide est dans `.env.production.example`.

### Contenu du fichier .env.production

```
# Module de settings Django a charger
DJANGO_SETTINGS_MODULE=config.settings.production

# Cle secrete Django (generer avec : python -c "import secrets; print(secrets.token_hex(50))")
DJANGO_SECRET_KEY=remplacer-par-une-cle-longue-aleatoire

# Hotes autorises a acceder a l'API
DJANGO_ALLOWED_HOSTS=api.ritoto-campus.com

# URL du frontend (utilisee dans les emails de reinitialisation de mot de passe)
FRONTEND_URL=https://ritoto-campus.com

# Origines autorisees pour les requetes CORS (cross-origin depuis le frontend)
CORS_ALLOWED_ORIGINS=https://ritoto-campus.com,https://www.ritoto-campus.com

# Origines de confiance pour la protection CSRF
CSRF_TRUSTED_ORIGINS=https://api.ritoto-campus.com,https://ritoto-campus.com

# PostgreSQL
POSTGRES_DB=ritoto
POSTGRES_USER=ritoto
POSTGRES_PASSWORD=remplacer-par-mot-de-passe-fort
POSTGRES_HOST=postgres         # nom du conteneur Docker, pas localhost
POSTGRES_PORT=5432

# Redis (DB 0 pour le cache, DB 1 pour les WebSockets)
REDIS_URL=redis://redis:6379/0

# Email via Gmail (mot de passe d'application, pas le mot de passe du compte)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=votre-email@gmail.com
EMAIL_HOST_PASSWORD=votre-mot-de-passe-application-gmail
DEFAULT_FROM_EMAIL=noreply@ritoto-campus.com

# Paiement Senfenico (cles production, distinctes des cles de test)
SENFENICO_API_KEY=votre-cle-production-senfenico
SENFENICO_WEBHOOK_SECRET=votre-secret-webhook-senfenico

# Google OAuth (obtenu sur console.cloud.google.com)
GOOGLE_OAUTH2_CLIENT_ID=votre-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
```

### Points importants sur la configuration

**POSTGRES_HOST vaut "postgres" et non "localhost"**. A l'interieur du reseau Docker, chaque conteneur est joignable par son nom de service. Le backend Django n'accede pas a PostgreSQL via 127.0.0.1 mais via le nom `postgres`, qui est resolu automatiquement par Docker.

**REDIS_URL utilise "redis" comme hote** pour la meme raison. Le conteneur Redis est accessible depuis les autres conteneurs via le nom `redis`.

**DJANGO_SECRET_KEY doit etre unique en production**. Une fuite de cette cle permettrait a un attaquant de falsifier les sessions et tokens. En developpement, une cle statique est codee en dur dans `development.py`. En production, elle est obligatoirement lue depuis les variables d'environnement, et Django refusera de demarrer si elle est absente.

---

## 4. Configuration Docker

### Dockerfile.prod — Construction de l'image backend

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN DJANGO_SECRET_KEY=build-placeholder-key \
    python manage.py collectstatic --noinput

EXPOSE 8000 8001
```

Cette image est utilisee par deux conteneurs differents (backend et daphne). La difference est uniquement dans la commande de demarrage :
- backend : `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120`
- daphne : `daphne -b 0.0.0.0 -p 8001 config.asgi:application`

Le `collectstatic` est execute pendant la construction de l'image. Il a besoin d'une `SECRET_KEY` pour que Django demarre, mais pas de la vraie cle de production. On utilise donc une valeur temporaire `build-placeholder-key` uniquement pour cette etape. Au demarrage du conteneur, c'est la vraie cle depuis `.env.production` qui sera utilisee.

### docker-compose.prod.yml — Orchestration des conteneurs

#### Conteneur postgres

```yaml
postgres:
  image: postgres:16-alpine
  env_file: .env.production
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - internal
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
    interval: 10s
    timeout: 5s
    retries: 5
  restart: always
```

Le healthcheck verifie toutes les 10 secondes que PostgreSQL est pret a accepter des connexions. Les conteneurs backend et daphne ne demarrent qu'apres que ce healthcheck soit valide (`condition: service_healthy`). Cela evite les erreurs de connexion a la base de donnees au demarrage.

Les donnees sont stockees dans un volume Docker nomme `postgres_data`. Ce volume persiste independamment du cycle de vie des conteneurs. Meme apres un `docker compose down`, les donnees sont conservees.

#### Conteneur redis

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  networks:
    - internal
```

Redis est configure avec :
- `--appendonly yes` : persistance sur disque (les donnees survivent a un redemarrage)
- `--maxmemory 256mb` : limite de memoire pour eviter une surconsommation
- `--maxmemory-policy allkeys-lru` : quand la memoire est pleine, on supprime les cles les moins recemment utilisees

Redis joue trois roles dans ce projet : cache HTTP pour les requetes Django, stockage des sessions utilisateur, et channel layer pour les messages WebSocket entre les processus Daphne.

#### Conteneur backend (Gunicorn)

```yaml
backend:
  build:
    context: .
    dockerfile: Dockerfile.prod
  command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
  env_file: .env.production
  volumes:
    - static_data:/app/static
    - media_data:/app/media
  networks:
    - internal
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

Gunicorn demarre 3 processus (workers) en parallele. Chaque worker peut traiter une requete HTTP independamment. Le timeout de 120 secondes est important pour les operations longues comme la generation de recus ou les appels a l'API Senfenico.

#### Conteneur daphne (WebSockets)

```yaml
daphne:
  build:
    context: .
    dockerfile: Dockerfile.prod
  command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
  env_file: .env.production
```

Daphne est un serveur ASGI specialise dans les connexions persistantes. Il gere les connexions WebSocket des etudiants et des chefs de secteur. Quand un etudiant passe commande, le modele Django envoie un message via Redis, et Daphne le transmet aux clients connectes en temps reel.

#### Conteneur nginx (reverse proxy)

```yaml
nginx:
  image: nginx:1.25-alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
    - static_data:/var/www/static:ro
    - media_data:/var/www/media:ro
    - ./frontend/dist:/var/www/html:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  networks:
    - internal
    - external
```

C'est le seul conteneur qui ecoute sur les ports 80 et 443 de l'hote. Il est connecte aux deux reseaux Docker : `external` pour recevoir les connexions publiques, et `internal` pour les transmettre aux autres conteneurs. Les certificats SSL sont montes en lecture seule depuis le dossier `/etc/letsencrypt` du VPS.

#### Reseaux Docker

```yaml
networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

Le reseau `internal` isole les conteneurs (postgres, redis, backend, daphne, frontend) du monde exterieur. Ils ne sont pas accessibles depuis Internet. Seul nginx est sur les deux reseaux, ce qui lui permet de faire le lien entre les requetes publiques et les services internes.

#### Volumes persistants

```yaml
volumes:
  postgres_data:    # donnees PostgreSQL
  redis_data:       # persistance Redis
  static_data:      # fichiers collectstatic Django
  media_data:       # fichiers uploades (photos produits, etc.)
```

Ces volumes sont geres par Docker. Ils survivent aux suppressions de conteneurs et peuvent etre sauvegardés separement.

---

## 5. Configuration Django (settings)

Les settings sont organises en trois fichiers. Ce systeme evite de melanger les configurations qui changent selon l'environnement.

```
config/settings/
|-- __init__.py
|-- base.py           settings communs (toujours charges)
|-- development.py    surcharge pour la machine locale
|-- production.py     surcharge pour le VPS
```

La variable d'environnement `DJANGO_SETTINGS_MODULE` determine quel fichier est charge :
- En developpement : `config.settings.development`
- En production : `config.settings.production`

### base.py — Ce qui est commun aux deux environnements

- La liste des applications installees (INSTALLED_APPS)
- Les middlewares
- La configuration REST Framework (authentification par token, pagination)
- Les paramètres email (host SMTP, port)
- Les parametres Senfenico
- L'application ASGI pour les WebSockets

### development.py — Ce qui change en local

```python
DEBUG = True
SECRET_KEY = 'django-insecure-dev-key-...'
ALLOWED_HOSTS = ['*']

# PostgreSQL en local (Docker Compose de developpement)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
        ...
    }
}

# Channel layer en memoire (pas besoin de Redis en dev)
CHANNEL_LAYERS = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}
}

# Les emails s'affichent dans le terminal au lieu d'etre envoyes
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Toutes les origines CORS sont autorisees en developpement
CORS_ALLOW_ALL_ORIGINS = True
```

### production.py — Ce qui change sur le VPS

```python
DEBUG = False

# SECRET_KEY doit obligatoirement etre dans .env.production
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY est requis en production")

# Seul api.ritoto-campus.com est autorise
ALLOWED_HOSTS = ['api.ritoto-campus.com']

# PostgreSQL dans le conteneur Docker
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'postgres',      # nom du conteneur Docker
        'CONN_MAX_AGE': 60,      # connexions persistantes (performance)
    }
}

# Cache Redis
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://redis:6379/0',
        'TIMEOUT': 300,          # 5 minutes par defaut
    }
}

# Sessions stockees dans Redis plutot qu'en base de donnees
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'

# Channel layer Redis pour les WebSockets multi-processus
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': ['redis://redis:6379/1']},
    }
}

# Headers de securite HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
X_FRAME_OPTIONS = 'DENY'
```

**Pourquoi `SECURE_SSL_REDIRECT = False` alors qu'on est en HTTPS ?**
Parce que Nginx gere lui-meme la redirection HTTP vers HTTPS. Si Django faisait aussi cette redirection, on aurait une double redirection inutile. Django fait confiance a Nginx via le header `X-Forwarded-Proto`.

**Pourquoi stocker les sessions dans Redis ?**
Cela evite une requete SQL pour chaque verification de session. Les sessions sont lues et ecrites directement en memoire via Redis, ce qui est beaucoup plus rapide.

---

## 6. Configuration Nginx

### nginx.conf — Configuration principale

```nginx
user  nginx;
worker_processes  auto;    # un processus par coeur CPU

events {
    worker_connections  1024;    # connexions simultanées par worker
}

http {
    client_max_body_size 20M;    # taille max des uploads

    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript ...;

    include /etc/nginx/conf.d/*.conf;    # charge les vhosts
}
```

La compression gzip est activee avec un niveau 6 (compromis entre vitesse et taux de compression). Cela reduit significativement la taille des reponses JSON de l'API et des fichiers JavaScript du frontend.

### conf.d/frontend.conf — Domaine ritoto-campus.com

Ce fichier contient deux blocs server.

**Premier bloc — redirection HTTP vers HTTPS :**

```nginx
server {
    listen 80;
    server_name ritoto-campus.com www.ritoto-campus.com;

    # Requis pour Let's Encrypt : Certbot doit pouvoir acceder a ce chemin
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Tout le reste est redirige en 301 (permanent) vers HTTPS
    location / {
        return 301 https://ritoto-campus.com$request_uri;
    }
}
```

**Deuxieme bloc — serveur HTTPS :**

```nginx
server {
    listen 443 ssl;
    server_name ritoto-campus.com www.ritoto-campus.com;

    ssl_certificate     /etc/letsencrypt/live/ritoto-campus.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ritoto-campus.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # www.ritoto-campus.com est redirige vers ritoto-campus.com (sans www)
    if ($host = www.ritoto-campus.com) {
        return 301 https://ritoto-campus.com$request_uri;
    }

    root /var/www/html;    # dossier frontend/dist/ monte en volume
    index index.html;

    # Les fichiers d'assets Vite ont un hash dans leur nom
    # On peut donc les cacher pendant 1 an sans risque
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Toutes les autres URL renvoient index.html (SPA React)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

**Pourquoi `try_files $uri $uri/ /index.html` ?**
React Router gere le routing cote client. Si un utilisateur accede directement a `https://ritoto-campus.com/etudiant/commandes`, Nginx ne trouve pas de fichier correspondant et renvoie `index.html`. C'est React qui prend ensuite le relai pour afficher la bonne page.

**Pourquoi `index.html` est en `no-cache` et les assets en `1y` ?**
Le fichier `index.html` est le point d'entree qui charge les assets. Si on le cache, un utilisateur pourrait voir l'ancienne version apres un deploiement. Les assets (JS, CSS) ont un hash dans leur nom genere par Vite, donc ils changent automatiquement a chaque build : on peut les cacher tres longtemps sans risque de version perimee.

### conf.d/api.conf — Domaine api.ritoto-campus.com

```nginx
server {
    listen 443 ssl;
    server_name api.ritoto-campus.com;

    ssl_certificate     /etc/letsencrypt/live/api.ritoto-campus.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ritoto-campus.com/privkey.pem;

    # WebSockets : transmission au conteneur Daphne
    location /ws/ {
        proxy_pass http://daphne:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;    # 24 heures - la connexion reste ouverte
        proxy_send_timeout 86400;
    }

    # API REST : transmission au conteneur backend (Gunicorn)
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout    120s;
    }

    # Admin Django
    location /admin/ {
        proxy_pass http://backend:8000;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fichiers statiques Django (CSS/JS de l'admin, etc.)
    location /static/ {
        alias /var/www/static/;
        expires 30d;
    }

    # Fichiers media (images produits, photos)
    location /media/ {
        alias /var/www/media/;
        expires 7d;
    }
}
```

**Comment fonctionne la connexion WebSocket ?**
Le protocole WebSocket demarre par une requete HTTP classique avec les en-tetes `Upgrade: websocket` et `Connection: upgrade`. Nginx transmet ces en-tetes tels quels a Daphne, qui accepte alors de passer en mode WebSocket. La directive `proxy_http_version 1.1` est obligatoire car les WebSockets ne fonctionnent pas avec HTTP/1.0.

**Pourquoi `proxy_read_timeout 86400` (24 heures) ?**
Une connexion WebSocket reste ouverte indefiniment tant que l'utilisateur est sur l'application. Sans ce timeout long, Nginx fermerait la connexion apres quelques secondes ou minutes d'inactivite, deconnectant l'etudiant qui attend une notification.

**Pourquoi passer `X-Forwarded-Proto` ?**
Django recoit les requetes depuis Nginx en HTTP (reseau interne Docker), meme si l'utilisateur est arrive en HTTPS. Ce header indique a Django que la connexion originale etait en HTTPS. Django l'utilise pour construire correctement les URLs absolues (dans les emails de reinitialisation notamment) et pour valider les cookies securises.

---

## 7. Certificats SSL (Let's Encrypt)

Les certificats sont obtenus via Certbot en mode standalone. Certbot demarre temporairement son propre serveur web sur le port 80 pour repondre au defi de verification de Let's Encrypt.

### Obtention initiale (effectuee par deploy.sh)

```bash
# Pour le frontend
certbot certonly --standalone \
    -d ritoto-campus.com -d www.ritoto-campus.com \
    --non-interactive --agree-tos -m admin@ritoto-campus.com

# Pour l'API
certbot certonly --standalone \
    -d api.ritoto-campus.com \
    --non-interactive --agree-tos -m admin@ritoto-campus.com
```

Les certificats sont stockes sur le VPS dans `/etc/letsencrypt/live/`. Ils sont montes en lecture seule dans le conteneur Nginx via le volume :

```yaml
- /etc/letsencrypt:/etc/letsencrypt:ro
```

### Renouvellement automatique

Les certificats Let's Encrypt expirent apres 90 jours. Un cron en root les renouvelle automatiquement :

```
0 3 * * *  certbot renew --quiet && docker compose -f /var/www/ritoto/docker-compose.prod.yml restart nginx
```

Ce cron tourne a 3h du matin tous les jours. Si le certificat expire dans moins de 30 jours, Certbot le renouvelle. Nginx est ensuite redemarré pour charger le nouveau certificat.

---

## 8. Système de backup

### Ce qui est sauvegardé

| Donnee           | Localisation                  | Methode              |
|------------------|-------------------------------|----------------------|
| Base PostgreSQL  | volume Docker postgres_data   | pg_dump              |
| Fichiers media   | /var/www/ritoto/media/        | tar                  |

Les fichiers de code source ne sont pas sauvegardes car ils sont sur Git. La configuration Nginx est aussi dans Git. Seules les donnees qui changent en production sont archivees.

### Script backup.sh

```bash
COMPOSE_FILE="/var/www/ritoto/docker-compose.prod.yml"
BACKUP_DIR="/var/www/ritoto/backups"
DATE=$(date +%Y%m%d-%H%M)
KEEP=14    # 14 jours de retention

# Dump PostgreSQL depuis le conteneur
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U ritoto ritoto > "$BACKUP_DIR/db-$DATE.sql"

# Archive des fichiers media
tar -czf "$BACKUP_DIR/media-$DATE.tar.gz" -C /var/www/ritoto media/

# Compression de l'ensemble en une seule archive
tar -czf "$BACKUP_DIR/ritoto-backup-$DATE.tar.gz" \
    "$BACKUP_DIR/db-$DATE.sql" \
    "$BACKUP_DIR/media-$DATE.tar.gz"

# Suppression des fichiers intermediaires
rm -f "$BACKUP_DIR/db-$DATE.sql" "$BACKUP_DIR/media-$DATE.tar.gz"

# Rotation : supprimer les archives au-dela de 14
ls -t "$BACKUP_DIR"/ritoto-backup-*.tar.gz | tail -n +15 | xargs -r rm -f
```

Le cron de sauvegarde tourne a 2h du matin tous les jours :

```
0 2 * * *  /var/www/ritoto/docker/scripts/backup.sh >> /var/log/ritoto-backup.log 2>&1
```

### Procédure de restauration

```bash
# Arreter les services applicatifs
docker compose -f /var/www/ritoto/docker-compose.prod.yml stop backend daphne

# Restaurer la base depuis une archive
tar -xzf /var/www/ritoto/backups/ritoto-backup-YYYYMMDD-HHMM.tar.gz -C /tmp/restore/

docker compose -f /var/www/ritoto/docker-compose.prod.yml exec -T postgres \
    psql -U ritoto ritoto < /tmp/restore/db-YYYYMMDD-HHMM.sql

# Restaurer les media
tar -xzf /tmp/restore/media-YYYYMMDD-HHMM.tar.gz -C /var/www/ritoto/

# Redemarrer
docker compose -f /var/www/ritoto/docker-compose.prod.yml up -d
```

Le script `restore.sh` automatise cette procedure. Il prend en argument le chemin de l'archive :

```bash
bash /var/www/ritoto/docker/scripts/restore.sh /var/www/ritoto/backups/ritoto-backup-20260322-0200.tar.gz
```

---

## 9. Script de déploiement automatique (deploy.sh)

Le script `deploy.sh` est concu pour etre execute une seule fois sur un VPS vierge apres avoir clone le depot Git. Il orchestre toutes les etapes dans l'ordre correct.

### Prerequis avant de lancer deploy.sh

1. Docker installe (`curl -fsSL https://get.docker.com | sh`)
2. Certbot installe (`apt-get install -y certbot`)
3. Le depot Git clone dans `/var/www/ritoto`
4. Le fichier `.env.production` rempli

### Ce que le script fait, etape par etape

**Etape 1 — Creation de l'utilisateur ritoto**
Cree le compte systeme et l'ajoute au groupe docker.

**Etape 2 — Preparation du repertoire**
Cree `/var/www/ritoto` si necessaire, configure les permissions.

**Etape 3 — Verification des prerequis**
Verifie que Docker et Certbot sont installes, et que `.env.production` existe.

**Etape 4 — Build du frontend React**
Installe Node.js 20 si absent. Lance `npm ci && npm run build`. Injecte `VITE_GOOGLE_CLIENT_ID` depuis `.env.production` pendant le build.

**Etape 5 — Obtention des certificats SSL**
Si les certificats n'existent pas encore, Certbot les genere pour `ritoto-campus.com`, `www.ritoto-campus.com` et `api.ritoto-campus.com`. Si les certificats existent deja (re-deploiement), cette etape est sautee.

**Etape 6 — Demarrage de la stack Docker**
Lance `docker compose -f docker-compose.prod.yml up -d --build`. Attend que PostgreSQL soit operationnel avant de continuer.

**Etape 7 — Migrations Django**
Execute `python manage.py migrate` dans le conteneur backend pour creer ou mettre a jour les tables.

**Etape 8 — Permissions**
Donne tous les fichiers a l'utilisateur `ritoto`. Rend les scripts de backup executables.

**Etape 9 — Configuration des crons**
Ajoute le cron de backup (2h, sous l'utilisateur `ritoto`) et le cron de renouvellement SSL (3h, en root) s'ils n'existent pas deja.

---

## 10. Commandes de gestion courante

### Creer le compte administrateur

```bash
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml \
    exec backend python manage.py createsuperuser
```

### Voir les logs en direct

```bash
# Tous les conteneurs
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml logs -f

# Un conteneur specifique
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml logs -f backend
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml logs -f daphne
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml logs -f nginx
```

### Deployer une mise a jour du backend

```bash
cd /var/www/ritoto
git pull

sudo -u ritoto docker compose -f docker-compose.prod.yml build backend daphne
sudo -u ritoto docker compose -f docker-compose.prod.yml up -d --no-deps backend daphne
sudo -u ritoto docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

### Deployer une mise a jour du frontend uniquement

```bash
cd /var/www/ritoto/frontend

# Charger la variable Google si necessaire
export VITE_GOOGLE_CLIENT_ID=$(grep VITE_GOOGLE_CLIENT_ID /var/www/ritoto/.env.production | cut -d= -f2)

npm ci && npm run build

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml restart nginx
```

### Acceder au shell Django

```bash
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml \
    exec backend python manage.py shell
```

### Verifier l'etat des conteneurs

```bash
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml ps
```

### Redemarrer un conteneur

```bash
sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml restart nginx
```

### Lancer un backup manuel

```bash
bash /var/www/ritoto/docker/scripts/backup.sh
```

### Voir les backups disponibles

```bash
ls -lh /var/www/ritoto/backups/
```

---

## Recapitulatif des ports et flux reseau

| Source          | Destination                  | Port  | Protocole  |
|-----------------|------------------------------|-------|------------|
| Internet        | Nginx (VPS)                  | 80    | HTTP       |
| Internet        | Nginx (VPS)                  | 443   | HTTPS      |
| Nginx           | backend (Gunicorn)           | 8000  | HTTP       |
| Nginx           | daphne (WebSockets)          | 8001  | HTTP/WS    |
| backend         | postgres                     | 5432  | TCP        |
| backend         | redis                        | 6379  | TCP        |
| daphne          | postgres                     | 5432  | TCP        |
| daphne          | redis                        | 6379  | TCP        |

Aucun port de PostgreSQL ou Redis n'est expose a l'exterieur du VPS. Ils sont uniquement accessibles depuis les autres conteneurs Docker sur le reseau interne.

---

*Ritoto Express — Document de configuration deploiement — Mars 2026*
