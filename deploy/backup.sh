#!/bin/sh
# Резервная копия PostgreSQL: pg_dump -Fc выполняется ВНУТРИ контейнера db,
# готовый дамп пишется в deploy/backups/dekanat-YYYYmmdd-HHMMSS.dump на хосте.
# Хранение: RETENTION_DAYS дней (по умолчанию 14).
# Запуск из каталога deploy:  sh backup.sh
# Cron на VPS (каждый день в 03:00):
#   0 3 * * * cd /opt/dekanat/deploy && sh backup.sh >> /var/log/dekanat-backup.log 2>&1
set -eu
. "$(dirname "$0")/lib.sh"

require_docker
load_env

RETENTION_DAYS=${RETENTION_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)
NAME="dekanat-$STAMP.dump"
TARGET="$BACKUP_DIR/$NAME"

mkdir -p "$BACKUP_DIR"

# Проверяем, что контейнер БД запущен.
cid=$({ $COMPOSE ps -q db; } 2>/dev/null | head -n 1)
[ -n "$cid" ] || die "Контейнер db не запущен — нечего бэкапить. Поднимите стек: sh deploy.sh"

log "pg_dump: база $POSTGRES_DB -> deploy/backups/$NAME"
# -T отключает TTY: иначе бинарный дамп может исказиться.
if ! $COMPOSE exec -T db pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" >"$TARGET"; then
	rm -f "$TARGET"
	die "pg_dump завершился с ошибкой. Логи: ./logs.sh db"
fi

# Проверка размера: пустой или крошечный дамп — признак ошибки.
size=$(wc -c <"$TARGET" | tr -d ' ')
if [ "${size:-0}" -lt 1024 ]; then
	rm -f "$TARGET"
	die "Дамп получился слишком маленьким ($size байт) — проверьте логи: ./logs.sh db"
fi
log "Бэкап создан: deploy/backups/$NAME (${size} байт)"

# Удаляем дампы старше RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name 'dekanat-*.dump' -type f -mtime +"$RETENTION_DAYS" |
	while IFS= read -r old; do
		log "Удалён старый дамп: $(basename "$old")"
		rm -f "$old"
	done

count=$(find "$BACKUP_DIR" -maxdepth 1 -name 'dekanat-*.dump' -type f | wc -l | tr -d ' ')
log "Дампов в архиве: $count (хранение: $RETENTION_DAYS дней)"

cat <<'EOF'

Восстановление из дампа:
  sh restore.sh backups/dekanat-YYYYmmdd-HHMMSS.dump

Автобэкап каждый день в 03:00 (crontab -e; путь под свой проект):
  0 3 * * * cd /opt/dekanat/deploy && sh backup.sh >> /var/log/dekanat-backup.log 2>&1
EOF
