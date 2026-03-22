#!/bin/bash
# ─── Restauration depuis un backup ────────────────────────────────────────────
# Usage : ./restore.sh /var/www/ritoto/backups/ritoto-backup-20260322-0200.tar.gz

set -euo pipefail

COMPOSE_FILE="/var/www/ritoto/docker-compose.prod.yml"
BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
    echo "Usage: $0 <chemin-du-backup.tar.gz>"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration depuis : $BACKUP_FILE"

WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

# Extraire le backup
tar -xzf "$BACKUP_FILE" -C "$WORK_DIR"

# 1. Arrêter les services applicatifs (garder postgres)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Arrêt des services..."
docker compose -f "$COMPOSE_FILE" stop backend daphne nginx frontend 2>/dev/null || true

# 2. Restaurer la base PostgreSQL
DB_FILE=$(find "$WORK_DIR" -name "db-*.sql" | head -1)
if [[ -f "$DB_FILE" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration PostgreSQL..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "${POSTGRES_USER:-ritoto}" "${POSTGRES_DB:-ritoto}" < "$DB_FILE"
fi

# 3. Restaurer les media
MEDIA_FILE=$(find "$WORK_DIR" -name "media-*.tar.gz" | head -1)
if [[ -f "$MEDIA_FILE" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration media..."
    tar -xzf "$MEDIA_FILE" -C /var/www/ritoto/
fi

# 4. Redémarrer tout
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redémarrage des services..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Restauration terminée ==="
