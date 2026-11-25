#!/usr/bin/env bash
# Ежедневный бэкап Postgres → S3 (п.4.4). Настраивается один раз при деплое.
# Cron на VPS (03:00 МСК): 0 3 * * * /opt/nexu/scripts/backup.sh >> /var/log/nexu-backup.log 2>&1
# Хранение: 7 дневных + 4 недельных (воскресные). Раз в месяц — тестовое восстановление!
# Требует: s3cmd (или aws cli) с ключами к ОТДЕЛЬНОМУ бакету nexu-backups.
set -euo pipefail

STAMP=$(date +%F)
FILE="/tmp/nexu-${STAMP}.sql.gz"
BUCKET="s3://nexu-backups"

docker compose -f /opt/nexu/docker-compose.yml exec -T db \
  pg_dump -U nexu nexu | gzip > "$FILE"

s3cmd put "$FILE" "$BUCKET/daily/"
# Воскресенье — дублируем в weekly
[ "$(date +%u)" = "7" ] && s3cmd put "$FILE" "$BUCKET/weekly/"
rm "$FILE"

# Ротация: daily старше 7 дней, weekly старше 28 дней
s3cmd ls "$BUCKET/daily/" | awk -v cutoff="$(date -d '7 days ago' +%F)" '$1 < cutoff {print $4}' | xargs -r -n1 s3cmd del
s3cmd ls "$BUCKET/weekly/" | awk -v cutoff="$(date -d '28 days ago' +%F)" '$1 < cutoff {print $4}' | xargs -r -n1 s3cmd del

echo "backup ${STAMP} ok"
