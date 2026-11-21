#!/bin/sh
# Восстановление БД из дампа, созданного backup.sh (pg_dump -Fc).
# Использование (из каталога deploy):  sh restore.sh backups/dekanat-YYYYmmdd-HHMMSS.dump
# ВНИМАНИЕ: текущие данные БД будут перезаписаны (pg_restore --clean --if-exists).
set -eu
. "$(dirname "$0")/lib.sh"

if [ "$#" -ne 1 ]; then
	die "Использование: sh restore.sh <путь к дампу> (например: backups/dekanat-20260101-030000.dump)"
fi

# Путь может быть указан относительно каталога вызова или каталога deploy/.
case "$1" in
	/*) DUMP=$1 ;;
	*)
		if [ -f "$CALLER_DIR/$1" ]; then
			DUMP="$CALLER_DIR/$1"
		else
			DUMP="$DEPLOY_DIR/$1"
		fi
		;;
esac
[ -f "$DUMP" ] || die "Файл дампа не найден: $1"
[ -s "$DUMP" ] || die "Файл дампа пуст: $DUMP"

require_docker
load_env

cid=$({ $COMPOSE ps -q db; } 2>/dev/null | head -n 1)
[ -n "$cid" ] || die "Контейнер db не запущен. Поднимите стек: sh deploy.sh"

cat <<EOF
ВНИМАНИЕ! Восстановление из дампа:
  $DUMP
в базу "$POSTGRES_DB" (пользователь "$POSTGRES_USER").
Текущие данные будут ПЕРЕЗАПИСАНЫ (pg_restore --clean --if-exists --no-owner).
Приложение app будет остановлено на время восстановления.
EOF
printf 'Для подтверждения введите yes: '
read -r answer
[ "$answer" = "yes" ] || die "Восстановление отменено."

log "Останавливаем app (и Caddy, если он в стеке), чтобы не было 502 во время восстановления"
$COMPOSE stop app >/dev/null 2>&1 || true
if [ "${WITH_CADDY:-1}" = "1" ]; then
	$COMPOSE stop caddy >/dev/null 2>&1 || true
fi

log "pg_restore"
# --clean --if-exists — пересоздать объекты, --no-owner — не привязываться к ролям.
$COMPOSE exec -T db pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" <"$DUMP"

log "Поднимаем сервисы обратно"
$COMPOSE up -d
wait_healthy app 300

log "Восстановление завершено. Проверьте: ./status.sh"
