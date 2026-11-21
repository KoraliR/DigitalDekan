#!/bin/sh
# Общий helper для скриптов deploy/. Подключается в каждом скрипте:
#   . "$(dirname "$0")/lib.sh"
# POSIX sh, окончания строк LF (иначе на Linux скрипт не запустится).

set -eu

# Каталог, из которого пользователь запустил скрипт (нужен restore.sh
# для относительных путей к дампам, указанных в командной строке).
CALLER_DIR=$(pwd)

# Каталог deploy/ (здесь лежат compose-файлы) и корень проекта.
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$DEPLOY_DIR/.." && pwd)
ENV_FILE="$DEPLOY_DIR/.env.prod"
BACKUP_DIR="$DEPLOY_DIR/backups"

# Все скрипты работают из каталога deploy/: пути в compose-файлах
# (build.context, env_file, volumes) считаются относительно него.
cd "$DEPLOY_DIR"

# Набор compose-файлов:
#   по умолчанию — база + Caddy (автоматический HTTPS);
#   для варианта с host-nginx запускайте с WITH_CADDY=0, например: WITH_CADDY=0 ./deploy.sh
if [ -z "${COMPOSE_FILES:-}" ]; then
	if [ "${WITH_CADDY:-1}" = "1" ] && [ -f "$DEPLOY_DIR/docker-compose.caddy.yml" ]; then
		COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.caddy.yml"
	else
		COMPOSE_FILES="-f docker-compose.prod.yml"
	fi
fi
# shellcheck disable=SC2086  # COMPOSE_FILES должен разложиться на отдельные аргументы
COMPOSE="docker compose --env-file .env.prod $COMPOSE_FILES"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# Проверить наличие файла с переменными окружения.
require_env() {
	[ -f "$ENV_FILE" ] ||
		die "Не найден deploy/.env.prod. Скопируйте .env.prod.example -> .env.prod и заполните."
}

# Загрузить переменные .env.prod в окружение скрипта (POSTGRES_USER, DOMAIN и т.д.).
# Значения в файле — без пробелов и кавычек, см. .env.prod.example.
load_env() {
	require_env
	set -a
	# shellcheck disable=SC1090
	. "$ENV_FILE"
	set +a
}

# Проверить docker, плагин compose и доступ к демону.
require_docker() {
	command -v docker >/dev/null 2>&1 ||
		die "Docker не установлен. Инструкция: https://docs.docker.com/engine/install/ubuntu/"
	docker compose version >/dev/null 2>&1 ||
		die "Не найден плагин docker compose (нужен Docker Compose v2+)."
	docker info >/dev/null 2>&1 ||
		die "Docker-демон недоступен: запустите 'sudo systemctl start docker' и проверьте, что пользователь в группе docker."
}

# Ждать, пока healthcheck сервиса станет healthy: wait_healthy <сервис> [секунды]
# Опрашивает docker inspect, поэтому не зависит от формата `compose ps`.
wait_healthy() {
	service=$1
	limit=${2:-180}
	waited=0
	while [ "$waited" -lt "$limit" ]; do
		cid=$({ $COMPOSE ps -q "$service"; } 2>/dev/null | head -n 1)
		if [ -n "$cid" ]; then
			status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)
			case "$status" in
				healthy) printf '\n'; return 0 ;;
				unhealthy) printf '\n'; die "Сервис $service в состоянии unhealthy. Логи: ./logs.sh $service" ;;
			esac
		fi
		sleep 5
		waited=$((waited + 5))
		printf '.'
	done
	printf '\n'
	die "Сервис $service не стал healthy за ${limit}s. Логи: ./logs.sh $service"
}
