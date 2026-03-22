#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy.sh — Script de déploiement Ritoto Express
# À exécuter en root sur le VPS (une seule fois)
#
# Usage : bash deploy.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN="ritoto-campus.com"
API_DOMAIN="api.ritoto-campus.com"
APP_DIR="/var/www/ritoto"
APP_USER="ritoto"
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root (sudo bash deploy.sh)"

echo ""
echo "═══════════════════════════════════════════"
echo "   Ritoto Express — Déploiement VPS"
echo "═══════════════════════════════════════════"
echo ""

# ── 1. Créer l'utilisateur ritoto ────────────────────────────────────────────
info "Création de l'utilisateur $APP_USER..."
if id "$APP_USER" &>/dev/null; then
    warn "Utilisateur $APP_USER existe déjà"
else
    useradd --system --create-home --home-dir "$APP_DIR" \
            --shell /bin/bash "$APP_USER"
    success "Utilisateur $APP_USER créé"
fi

# Ajouter ritoto au groupe docker pour pouvoir lancer docker compose
usermod -aG docker "$APP_USER"
success "Utilisateur $APP_USER ajouté au groupe docker"

# ── 2. Préparer le répertoire ─────────────────────────────────────────────────
info "Préparation de $APP_DIR..."
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 3. Vérifications préalables ───────────────────────────────────────────────
info "Vérification des prérequis..."
command -v docker  >/dev/null || error "Docker n'est pas installé. Installez-le avec : curl -fsSL https://get.docker.com | sh"
command -v certbot >/dev/null || error "Certbot n'est pas installé. Installez-le avec : apt-get install -y certbot"

if [[ ! -f "$APP_DIR/.env.production" ]]; then
    error "Fichier .env.production manquant dans $APP_DIR.\nCopiez .env.production.example et remplissez-le :\n  cp $APP_DIR/.env.production.example $APP_DIR/.env.production\n  nano $APP_DIR/.env.production"
fi
success "Prérequis OK"

# ── 4. Build du frontend ──────────────────────────────────────────────────────
info "Build du frontend React..."
if ! command -v node >/dev/null; then
    info "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Charger VITE_GOOGLE_CLIENT_ID depuis .env.production si présent
VITE_GOOGLE_CLIENT_ID=$(grep "^VITE_GOOGLE_CLIENT_ID=" "$APP_DIR/.env.production" | cut -d= -f2 || true)

cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm ci --prefer-offline 2>/dev/null || sudo -u "$APP_USER" npm install
VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" sudo -u "$APP_USER" npm run build
chown -R "$APP_USER:$APP_USER" "$APP_DIR/frontend/dist"
success "Frontend buildé → dist/"
cd "$APP_DIR"

# ── 5. Certificats SSL (Let's Encrypt) ────────────────────────────────────────
info "Obtention des certificats SSL..."
if [[ -d "/etc/letsencrypt/live/$DOMAIN" && -d "/etc/letsencrypt/live/$API_DOMAIN" ]]; then
    warn "Certificats déjà présents, passage à la suite."
else
    # Libérer le port 80 si nginx tourne déjà
    docker compose -f "$APP_DIR/docker-compose.prod.yml" stop nginx 2>/dev/null || true

    EMAIL=$(grep "^DEFAULT_FROM_EMAIL=" "$APP_DIR/.env.production" | cut -d= -f2)
    [[ -z "$EMAIL" ]] && error "DEFAULT_FROM_EMAIL manquant dans .env.production"

    info "Obtention cert pour $DOMAIN et www.$DOMAIN..."
    certbot certonly --standalone \
        -d "$DOMAIN" -d "www.$DOMAIN" \
        --non-interactive --agree-tos -m "$EMAIL" \
        || error "Échec SSL pour $DOMAIN. Vérifiez que les DNS pointent vers ce serveur."

    info "Obtention cert pour $API_DOMAIN..."
    certbot certonly --standalone \
        -d "$API_DOMAIN" \
        --non-interactive --agree-tos -m "$EMAIL" \
        || error "Échec SSL pour $API_DOMAIN."

    success "Certificats SSL obtenus"
fi

# ── 6. Démarrage de la stack Docker ──────────────────────────────────────────
info "Build et démarrage des conteneurs..."
cd "$APP_DIR"
sudo -u "$APP_USER" docker compose -f docker-compose.prod.yml up -d --build

# Attendre que PostgreSQL soit prêt
info "Attente PostgreSQL..."
until sudo -u "$APP_USER" docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_isready -U "${POSTGRES_USER:-ritoto}" >/dev/null 2>&1; do
    sleep 2
done
success "PostgreSQL prêt"

# ── 7. Migrations Django ──────────────────────────────────────────────────────
info "Migrations Django..."
sudo -u "$APP_USER" docker compose -f "$APP_DIR/docker-compose.prod.yml" \
    exec backend python manage.py migrate --noinput
success "Migrations appliquées"

# ── 8. Permissions des fichiers ───────────────────────────────────────────────
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod +x "$APP_DIR/docker/scripts/backup.sh"
chmod +x "$APP_DIR/docker/scripts/restore.sh"
mkdir -p "$APP_DIR/backups"
chown "$APP_USER:$APP_USER" "$APP_DIR/backups"

# ── 9. Cron : backup + renouvellement SSL ─────────────────────────────────────
info "Configuration du cron (utilisateur $APP_USER)..."

CRON_BACKUP="0 2 * * * $APP_DIR/docker/scripts/backup.sh >> /var/log/ritoto-backup.log 2>&1"
CRON_SSL="0 3 * * * certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.prod.yml restart nginx"

# Cron backup → sous l'utilisateur ritoto
( sudo -u "$APP_USER" crontab -l 2>/dev/null | grep -qF "backup.sh" ) || \
    ( sudo -u "$APP_USER" crontab -l 2>/dev/null; echo "$CRON_BACKUP" ) | sudo -u "$APP_USER" crontab -

# Cron SSL → en root (certbot a besoin de root)
( crontab -l 2>/dev/null | grep -qF "certbot renew" ) || \
    ( crontab -l 2>/dev/null; echo "$CRON_SSL" ) | crontab -

success "Cron configuré"

# ── 10. Résumé ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
success "Déploiement terminé !"
echo "═══════════════════════════════════════════"
echo ""
echo "  Répertoire : $APP_DIR"
echo "  Utilisateur: $APP_USER"
echo "  Frontend   : https://$DOMAIN"
echo "  API        : https://$API_DOMAIN/api/"
echo "  Admin      : https://$API_DOMAIN/admin/"
echo ""
echo "Prochaine étape — créer le superutilisateur admin :"
echo "  sudo -u $APP_USER docker compose -f $APP_DIR/docker-compose.prod.yml exec backend python manage.py createsuperuser"
echo ""
echo "Logs en direct :"
echo "  sudo -u $APP_USER docker compose -f $APP_DIR/docker-compose.prod.yml logs -f"
echo ""
