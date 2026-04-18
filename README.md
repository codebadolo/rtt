● Bash(cd /home/olli/ritoto-Campus && python manage.py shell -c "
from apps.authentification.models import Utilisateur…)
⎿  23 objects imported automatically (use -v 2 for details).

 Créé : Ritoto Admin - admin@ritoto.com
● Compte créé :

- Email : admin@ritoto.com
- Mot de passe : admin123
- Rôle : Admin (superuser)

❯ je veut que tu fasse un review du script de deploiement
⎿  ⧉ Selected 1 lines from deploy.sh in Visual Studio Code

Searched for 3 patterns, read 5 files (ctrl+o to expand)

● Voici le review complet :

---

Review deploy.sh

Ce qui est bien fait ✅

- set -euo pipefail — arrêt propre en cas d'erreur
- Vérification root avant de commencer
- Healthcheck PostgreSQL avant migrations
- Cron dédupliqué (pas d'ajout en double)
- Séparation cron backup (user ritoto) / SSL (root)
- Couleurs + messages clairs
- Vérification des prérequis (docker, certbot, .env.production)

---

Problèmes à corriger 🔴

1. collectstatic manquant

# Ligne 119 — après migrate, il faut collecter les fichiers statiques

sudo -u "$APP_USER" docker compose -f "$APP_DIR/docker-compose.prod.yml" exec backend python manage.py collectstatic --noinputSans ça, le CSS/JS admin Django et les fichiers statiques ne seront pas servis par Nginx.

2. seed_data non lancé
   La base sera vide au premier déploiement. Il faut un prompt :
   read -r -p "Initialiser les données (secteurs, salles, produits) ? [o/N] " SEED
   [[ "$SEED" =~ ^[oO]$ ]] && \
   sudo -u "$APP_USER" docker compose -f "$APP_DIR/docker-compose.prod.yml" \
   exec backend python manage.py seed_data
3. POSTGRES_USER non exporté avant le healthcheck (ligne 111)

# Ligne 111 — la variable $ {POSTGRES_USER:-ritoto} lue depuis le shell host

# mais elle n'est définie que dans .env.production → utiliser la valeur par défaut uniquement

until sudo -u "$APP_USER" docker compose -f ... exec -T postgres \pg_isready -U ritoto >/dev/null 2>&1; doLe ${} est évalué dans le shell host où POSTGRES_USER n'est pas défini — la valeur par défaut ritoto fonctionne mais c'esttrompeur. Soit lire explicitement le .env, soit hardcoder.

4. VITE_GOOGLE_CLIENT_ID extraction fragile (ligne 68)

# Actuel — casse si la valeur contient un =

VITE_GOOGLE_CLIENT_ID=$(grep "^VITE_GOOGLE_CLIENT_ID=" "$APP_DIR/.env.production" | cut -d= -f2 || true)

# Mieux

VITE_GOOGLE_CLIENT_ID=$(grep "^VITE_GOOGLE_CLIENT_ID=" "$APP_DIR/.env.production" | cut -d= -f2- || true)cut -d= -f2 coupe au premier = et ignore tout ce qui suit. Utiliser -f2- pour prendre tout après le premier =.

5. certbot renew dans le cron root sans --deploy-hook (ligne 133)

# Actuel — nginx redémarre même si aucun certificat n'a été renouvelé

CRON_SSL="0 3 * * * certbot renew --quiet && docker compose ... restart nginx"

# Mieux

CRON_SSL="0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f $APP_DIR/docker-compose.prod.yml restart nginx'"
Avec &&, nginx redémarre chaque nuit même si rien n'est renouvelé. Le --deploy-hook ne s'exécute que si un certificat a
réellement été renouvelé.

---

Points à améliorer 🟡

6. Pas de git pull dans le script
   Le script assume que les fichiers sont déjà présents dans $APP_DIR. Pour un re-déploiement, il faudrait un git pull ou préciser
   clairement que c'est un script premier déploiement uniquement.
7. Pas de rollback en cas d'échec
   Si migrate échoue, les conteneurs sont déjà up avec l'ancienne image. Prévoir :
   sudo -u "$APP_USER" docker compose ... migrate --noinput || {
   warn "Migration échouée — rollback"
   sudo -u "$APP_USER" docker compose ... down
   exit 1
   }
8. backup.sh — POSTGRES_USER non défini

# backup.sh ligne 19 — POSTGRES_USER n'est pas dans l'environnement du cron

pg_dump -U "${POSTGRES_USER:-ritoto}"En cron, les variables d'env ne sont pas chargées. Ajouter en début de backup.sh :source /var/www/ritoto/.env.production 2>/dev/null || true

9. docker-compose.prod.yml — collectstatic non automatisé
   Le service backend démarre directement avec gunicorn sans lancer collectstatic. Ajouter un entrypoint ou un service init :
   command: >
   sh -c "python manage.py collectstatic --noinput &&
   gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"

---

Résumé des priorités

┌──────────────┬──────────────────────────────────────────────┐
│   Priorité   │                   Problème                   │
├──────────────┼──────────────────────────────────────────────┤
│ 🔴 Bloquant  │ collectstatic manquant → CSS admin cassé     │
├──────────────┼──────────────────────────────────────────────┤
│ 🔴 Bloquant  │ backup.sh : POSTGRES_USER non résolu en cron │
├──────────────┼──────────────────────────────────────────────┤
│ 🟡 Important │ certbot renew avec --deploy-hook             │
├──────────────┼──────────────────────────────────────────────┤
│ 🟡 Important │ cut -d= -f2- pour VITE_GOOGLE_CLIENT_ID      │
├──────────────┼──────────────────────────────────────────────┤
│ 🟢 Mineur    │ Prompt seed_data au premier déploiement      │
├──────────────┼──────────────────────────────────────────────┤
│ 🟢 Mineur    │ Rollback sur échec migration                 │
└──────────────┴──────────────────────────────────────────────┘

Veux-tu que j'applique ces corrections directement dans le script ?

✻ Cooked for 53s

❯ quest ce que je doit concretement faire sur le serveur afin que ca marche  ?

Searched for 1 pattern, read 1 file (ctrl+o to expand)

● Voici exactement ce que tu dois faire, étape par étape, dans l'ordre.

---

Prérequis sur ton PC local

Avant de toucher au serveur, assure-toi que ton code est à jour sur GitHub :

# Sur ton PC

cd /home/olli/ritoto-Campus
git add -A
git commit -m "deploy ready"
git push origin main

---

Sur le serveur VPS — dans l'ordre

Étape 1 — Se connecter en root

ssh root@IP_DU_SERVEUR

---

Étape 2 — Installer Docker

curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

---

Étape 3 — Installer Certbot

apt-get update
apt-get install -y certbot

---

Étape 4 — Cloner le projet

mkdir -p /var/www/ritoto
git clone https://github.com/TON_COMPTE/ritoto-Campus.git /var/www/ritoto

---

Étape 5 — Créer le fichier .env.production

cp /var/www/ritoto/.env.production.example /var/www/ritoto/.env.production
nano /var/www/ritoto/.env.production

Remplir obligatoirement ces valeurs :

DJANGO_SECRET_KEY=      # générer avec : python3 -c "import secrets; print(secrets.token_hex(50))"
POSTGRES_PASSWORD=      # un mot de passe fort, ex: Rit0t0@2026!
SENFENICO_API_KEY=      # ta clé API Senfenico (production)
SENFENICO_WEBHOOK_SECRET=  # ton secret webhook Senfenico
EMAIL_HOST_USER=        # ton gmail
EMAIL_HOST_PASSWORD=    # mot de passe application Gmail
VITE_GOOGLE_CLIENT_ID=  # si tu utilises Google OAuth, sinon laisser vide

Les autres valeurs peuvent rester comme dans l'exemple.

---

Étape 6 — Vérifier que les DNS pointent vers le serveur

Avant de lancer Certbot, tes domaines doivent pointer vers l'IP du VPS :

┌───────────────────────┬──────┬───────────┐
│        Domaine        │ Type │  Valeur   │
├───────────────────────┼──────┼───────────┤
│ ritoto-campus.com     │ A    │ IP du VPS │
├───────────────────────┼──────┼───────────┤
│ www.ritoto-campus.com │ A    │ IP du VPS │
├───────────────────────┼──────┼───────────┤
│ api.ritoto-campus.com │ A    │ IP du VPS │
└───────────────────────┴──────┴───────────┘

Vérifier :
dig +short ritoto-campus.com
dig +short api.ritoto-campus.com

# les deux doivent retourner l'IP du serveur

---

Étape 7 — Lancer le script de déploiement

cd /var/www/ritoto
bash deploy.sh

Le script va automatiquement :

- Créer l'utilisateur ritoto
- Builder le frontend React
- Obtenir les certificats SSL
- Lancer tous les conteneurs Docker
- Appliquer les migrations

---

Étape 8 — Corriger collectstatic (manquant dans le script)

C'est le bug identifié dans le review — à faire après que le script tourne :

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml 
exec backend python manage.py collectstatic --noinput

---

Étape 9 — Charger les données initiales

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml 
exec backend python manage.py seed_data

---

Étape 10 — Créer le compte admin

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml 
exec backend python manage.py shell -c "
from apps.authentification.models import Utilisateur
Utilisateur.objects.create_superuser(
email='admin@ritoto.com',
password='MOT_DE_PASSE_FORT',
nom='Admin',
prenom='Ritoto',
telephone='70000000'
)
print('Admin créé')
"

---

Étape 11 — Vérifier que tout fonctionne

# Voir les logs

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml logs -f

# Vérifier que tous les conteneurs sont UP

sudo -u ritoto docker compose -f /var/www/ritoto/docker-compose.prod.yml ps

Les 5 conteneurs doivent être en running :
ritoto-postgres   ✅ running
ritoto-redis      ✅ running
ritoto-backend    ✅ running
ritoto-daphne     ✅ running
ritoto-frontend   ✅ running
ritoto-nginx      ✅ running

---

Résumé des URLs une fois déployé

┌──────────────────────────────────────┬──────────────────────┐
│                 URL                  │     Description      │
├──────────────────────────────────────┼──────────────────────┤
│ https://ritoto-campus.com            │ Application frontend │
├──────────────────────────────────────┼──────────────────────┤
│ https://api.ritoto-campus.com/api/   │ API REST             │
├──────────────────────────────────────┼──────────────────────┤
│ https://api.ritoto-campus.com/admin/ │ Admin Django         │
└──────────────────────────────────────┴──────────────────────┘

---

Pour les mises à jour futures

ssh root@IP_DU_SERVEUR
cd /var/www/ritoto
git pull origin main

# Rebuild du frontend si changements UI

sudo -u ritoto npm --prefix frontend ci && sudo -u ritoto npm --prefix frontend run build

# Relancer les conteneurs

sudo -u ritoto docker compose -f docker-compose.prod.yml up -d --build
sudo -u ritoto docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
