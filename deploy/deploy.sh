#!/bin/sh
# Первичный деплой «Цифрового деканата» на VPS: db + app + Caddy (HTTPS).
# Запуск из каталога deploy:
#   sh deploy.sh          # или ./deploy.sh (после chmod +x deploy.sh)
# Вариант с host-nginx (без Caddy):  WITH_CADDY=0 sh deploy.sh
set -eu
. "$(dirname "$0")/lib.sh"

log "Проверка окружения"
# Сначала проверяем .env.prod (это не требует Docker), затем — Docker.
require_env
load_env

# --- Проверки .env.prod -----------------------------------------------------
DOMAIN=${DOMAIN:-}
ACME_EMAIL=${ACME_EMAIL:-}

[ -n "$DOMAIN" ] || die "В deploy/.env.prod не задан DOMAIN."
case "$DOMAIN" in
	*://*|*/*|*" "*) die "DOMAIN должен быть только именем домена, без схемы, слэшей и пробелов (сейчас: $DOMAIN)." ;;
	example.ru|example.com|example.org|*.example.ru|*.example.com|*.example.org)
		die "DOMAIN — заглушка ($DOMAIN). Укажите реальный домен в deploy/.env.prod." ;;
esac
[ -n "$ACME_EMAIL" ] || die "В deploy/.env.prod не задан ACME_EMAIL (нужен для Let's Encrypt)."
case "$ACME_EMAIL" in
	*@example.ru|*@example.com|*@example.org)
		warn "ACME_EMAIL похож на заглушку ($ACME_EMAIL): сертификат выпустится, но уведомления не дойдут." ;;
esac
case "${POSTGRES_PASSWORD:-}" in
	""|*СГЕНЕРИРУЙТЕ*|*CHANGE*|*change*)
		die "POSTGRES_PASSWORD не заполнен. Сгенерируйте: openssl rand -hex 24" ;;
esac
case "${AUTH_SECRET:-}" in
	""|*СГЕНЕРИРУЙТЕ*|*CHANGE*|*change*)
		die "AUTH_SECRET не заполнен. Сгенерируйте: openssl rand -base64 32" ;;
esac
# Пароль БД встраивается в DATABASE_URL, поэтому должен быть URL-безопасным.
case "$POSTGRES_PASSWORD" in
	*[!A-Za-z0-9._~-]*)
		warn "POSTGRES_PASSWORD содержит символы, которые нужно percent-кодировать в DATABASE_URL. Надёжнее: openssl rand -hex 24." ;;
esac

# В прототипе вход работает только с учебной 2FA (см. auth.ts).
if [ "${DEMO_2FA_ENABLED:-}" != "true" ]; then
	warn "DEMO_2FA_ENABLED != true: в этом прототипе вход будет невозможен (Credentials-провайдер откажет)."
fi

[ -f "$DEPLOY_DIR/Caddyfile" ] || die "Не найден deploy/Caddyfile."
[ -f "$DEPLOY_DIR/docker-compose.prod.yml" ] || die "Не найден deploy/docker-compose.prod.yml."

log "Проверка Docker"
require_docker
mkdir -p "$BACKUP_DIR"

if [ "${WITH_CADDY:-1}" = "1" ]; then
	log "Вариант HTTPS: Caddy + автоматический сертификат Let's Encrypt (порты 80/443)"
	# Проверим, не заняты ли 80/443 (частый конфликт — host-nginx).
	if command -v ss >/dev/null 2>&1; then
		if ss -ltn 2>/dev/null | grep -Eq ':(80|443)[[:space:]]'; then
			warn "Порты 80/443 уже кем-то заняты (возможно, host-nginx). Остановите его или используйте WITH_CADDY=0 + nginx/dekanat.conf."
		fi
	fi
else
	log "Вариант host-nginx: Caddy не запускаем, TLS терминирует nginx (см. nginx/README.md)"
fi

log "Сборка образа приложения (npm ci + prisma generate + next build)"
# shellcheck disable=SC2086
$COMPOSE build --pull app

log "Запуск стека (миграции Prisma применяются автоматически перед стартом app)"
# shellcheck disable=SC2086
$COMPOSE up -d --remove-orphans

log "Ожидание готовности БД"
wait_healthy db 120
log "Ожидание готовности приложения (миграции + next start)"
wait_healthy app 300

# Опциональная проверка публичного HTTPS: сертификат выпускается 10-60 секунд.
if [ "${WITH_CADDY:-1}" = "1" ] && command -v curl >/dev/null 2>&1; then
	log "Проверка https://$DOMAIN (выпуск сертификата может занять до минуты)"
	i=0
	while [ "$i" -lt 12 ]; do
		if curl -fsS --max-time 5 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
			log "HTTPS работает: https://$DOMAIN"
			break
		fi
		i=$((i + 1))
		sleep 5
	done
	if [ "$i" -ge 12 ]; then
		warn "Проверить HTTPS не удалось. DNS/фаервол/логи: ./logs.sh caddy"
	fi
fi

cat <<EOF

============================================================
 Деплой завершён.
   Сайт:       https://$DOMAIN
   Health:     https://$DOMAIN/api/health
   Статус:     ./status.sh
   Логи:       ./logs.sh app
   Данные:     ./seed.sh     (демо-данные, пересоздаёт демо-записи)
   Бэкап:      ./backup.sh
============================================================
Осталось проверить вручную: открыть https://$DOMAIN, войти демо-аккаунтом.
Автобэкап (cron на VPS, путь замените на свой):
  0 3 * * * cd /opt/dekanat/deploy && sh backup.sh >> /var/log/dekanat-backup.log 2>&1
EOF
