#!/bin/bash
# ─── Backup quotidien Ritoto Campus ──────────────────────────────────────────
# Planifier : 0 2 * * * /var/www/ritoto/docker/scripts/backup.sh >> /var/log/ritoto-backup.log 2>&1

set -euo pipefail

COMPOSE_FILE="/var/www/ritoto/docker-compose.prod.yml"
BACKUP_DIR="/var/www/ritoto/backups"
DATE=$(date +%Y%m%d-%H%M)
KEEP=14    # nombre de backups à conserver

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Début backup ==="

# 1. Dump PostgreSQL
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dump PostgreSQL..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-ritoto}" "${POSTGRES_DB:-ritoto}" \
    > "$BACKUP_DIR/db-$DATE.sql"

# 2. Archive media
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Archive media..."
tar -czf "$BACKUP_DIR/media-$DATE.tar.gz" \
    -C /var/www/ritoto media/ 2>/dev/null || true

# 3. Archive globale
tar -czf "$BACKUP_DIR/ritoto-backup-$DATE.tar.gz" \
    "$BACKUP_DIR/db-$DATE.sql" \
    "$BACKUP_DIR/media-$DATE.tar.gz"

# 4. Nettoyer les fichiers intermédiaires
rm -f "$BACKUP_DIR/db-$DATE.sql" "$BACKUP_DIR/media-$DATE.tar.gz"

# 5. Rotation : garder seulement les $KEEP derniers backups
ls -t "$BACKUP_DIR"/ritoto-backup-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

SIZE=$(du -sh "$BACKUP_DIR/ritoto-backup-$DATE.tar.gz" 2>/dev/null | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Backup terminé : ritoto-backup-$DATE.tar.gz ($SIZE) ==="
