#!/bin/sh
# Состояние стека: контейнеры и healthcheck, сертификаты Caddy, последние логи app.
# Запуск из каталога deploy:  sh status.sh
set -eu
. "$(dirname "$0")/lib.sh"

require_docker
load_env

echo "=== Контейнеры (${COMPOSE_FILES}) ==="
# shellcheck disable=SC2086
$COMPOSE ps

echo
echo "=== Healthcheck ==="
for svc in $({ $COMPOSE config --services; } 2>/dev/null); do
	cid=$({ $COMPOSE ps -q "$svc"; } 2>/dev/null | head -n 1)
	if [ -z "$cid" ]; then
		printf '  %-8s не запущен\n' "$svc"
		continue
	fi
	state=$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
	health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}нет healthcheck{{end}}' "$cid" 2>/dev/null || echo unknown)
	printf '  %-8s %-10s %s\n' "$svc" "$state" "$health"
done

# Сертификаты Caddy (только если Caddy в стеке).
if [ "${WITH_CADDY:-1}" = "1" ] && $COMPOSE ps -q caddy 2>/dev/null | grep -q .; then
	echo
	echo "=== Сертификаты Caddy (volume dekanat-caddy-data) ==="
	$COMPOSE exec -T caddy sh -c 'ls -1R /data/caddy/certificates 2>/dev/null | head -n 20' ||
		echo "  сертификаты ещё не выпущены (проверьте DNS и логи: ./logs.sh caddy)"
fi

echo
echo "=== Последние логи app (20 строк) ==="
# shellcheck disable=SC2086
$COMPOSE logs --tail=20 app 2>/dev/null || true

echo
echo "=== Диск ==="
df -h "$DEPLOY_DIR" | tail -n 1
