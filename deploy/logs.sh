#!/bin/sh
# Логи контейнеров стека.
# Использование (из каталога deploy):
#   sh logs.sh            # все сервисы, последние 200 строк, режим follow
#   sh logs.sh app        # только приложение
#   sh logs.sh caddy      # только Caddy (сертификаты, ошибки ACME)
set -eu
. "$(dirname "$0")/lib.sh"

require_docker
require_env

# shellcheck disable=SC2086
exec $COMPOSE logs --tail=200 -f "$@"
