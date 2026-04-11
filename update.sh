#!/bin/bash
# update.sh — Mettre a jour ritoto-express sur le VPS
# Usage : bash update.sh [option]
#
#   bash update.sh          -> mise a jour complete (pull + rebuild + migrate)
#   bash update.sh nginx    -> recharger nginx uniquement (config changed)
#   bash update.sh front    -> rebuild frontend uniquement
#   bash update.sh back     -> rebuild backend uniquement
#   bash update.sh restart  -> redemarrer tous les containers sans rebuild

set -euo pipefail

APP_DIR="/var/www/ritoto"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
info() { echo -e "${BLUE}[..]${NC}   $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

cd "$APP_DIR"

case "${1:-all}" in

# ── Mise a jour complete ──────────────────────────────────────────────────────
all)
    info "Pull git..."
    git pull || err "git pull echoue"
    ok "Code mis a jour"

    info "Build frontend React..."
    cd "$APP_DIR/frontend"
    npm ci --prefer-offline 2>/dev/null || npm install
    npm run build
    cd "$APP_DIR"
    ok "Frontend builde"

    info "Rebuild et redemarrage backend..."
    $COMPOSE up -d --build --force-recreate web
    ok "Backend redémarre"

    info "Migrations Django..."
    $COMPOSE exec web python manage.py migrate --noinput
    ok "Migrations appliquees"

    info "Rechargement nginx..."
    $COMPOSE exec nginx nginx -s reload
    ok "Nginx rechargé"

    echo ""
    ok "Mise a jour complete !"
    ;;

# ── Nginx uniquement (apres modif nginx.conf) ────────────────────────────────
nginx)
    info "Pull git..."
    git pull || err "git pull echoue"

    info "Recreation du container nginx..."
    $COMPOSE up -d --force-recreate nginx
    ok "Nginx redémarre avec la nouvelle config"
    ;;

# ── Frontend uniquement (apres modif React) ──────────────────────────────────
front)
    info "Pull git..."
    git pull || err "git pull echoue"

    info "Build frontend React..."
    cd "$APP_DIR/frontend"
    npm ci --prefer-offline 2>/dev/null || npm install
    npm run build
    cd "$APP_DIR"
    ok "Frontend builde — nginx sert les nouveaux fichiers automatiquement"
    ;;

# ── Backend uniquement (apres modif Python/Django) ───────────────────────────
back)
    info "Pull git..."
    git pull || err "git pull echoue"

    info "Rebuild backend..."
    $COMPOSE up -d --build --force-recreate web

    info "Migrations Django..."
    $COMPOSE exec web python manage.py migrate --noinput
    ok "Backend mis a jour"
    ;;

# ── Redemarrage simple sans rebuild ──────────────────────────────────────────
restart)
    info "Redemarrage de tous les containers..."
    $COMPOSE up -d --force-recreate
    ok "Tous les containers redemarres"
    ;;

*)
    echo "Usage: bash update.sh [all|nginx|front|back|restart]"
    exit 1
    ;;

esac

# Afficher l'etat final
echo ""
$COMPOSE ps
