#!/bin/sh
# Обновление приложения на VPS: бэкап БД, git pull (если это git-репозиторий),
# пересборка образа, перезапуск. Миграции Prisma применяются автоматически
# командой app при старте контейнера.
# Запуск из каталога deploy:  sh update.sh
set -eu
. "$(dirname "$0")/lib.sh"

log "Проверка окружения"
require_docker
load_env
mkdir -p "$BACKUP_DIR"

# 1. Бэкап перед изменениями (если БД уже запущена).
if $COMPOSE ps -q db 2>/dev/null | grep -q .; then
	log "Бэкап БД перед обновлением"
	if ! sh "$DEPLOY_DIR/backup.sh"; then
		warn "Бэкап не удался. Прервите обновление (Ctrl+C) или продолжите на свой риск."
		printf 'Продолжить без бэкапа? Введите yes: '
		read -r answer
		[ "$answer" = "yes" ] || die "Обновление отменено."
	fi
else
	warn "Контейнер db не запущен — бэкап пропущен (первичная установка?)."
fi

# 2. Обновление кода.
cd "$PROJECT_DIR"
if [ -d .git ]; then
	if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
		log "git pull --ff-only"
		git pull --ff-only || warn "git pull не удался — продолжаем с текущим кодом."
	else
		warn "В репозитории есть локальные изменения — git pull пропущен (обновляем текущий код)."
	fi
else
	warn "Каталог не является git-репозиторием — git pull пропущен, используется текущий код."
fi
cd "$DEPLOY_DIR"

# 3. Пересборка и перезапуск.
log "Пересборка образа приложения"
# shellcheck disable=SC2086
$COMPOSE build --pull app

log "Перезапуск стека (миграции применяются автоматически при старте app)"
# shellcheck disable=SC2086
$COMPOSE up -d --remove-orphans

wait_healthy db 120
wait_healthy app 300

# 4. Чистка старых образов (безопасно: неиспользуемые слои).
log "Чистка старых образов"
docker image prune -f >/dev/null 2>&1 || true

cat <<EOF

============================================================
 Обновление завершено.
   Сайт:    https://$DOMAIN
   Статус:  ./status.sh
   Логи:    ./logs.sh app
============================================================
EOF
