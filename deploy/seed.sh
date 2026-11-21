#!/bin/sh
# Заполнение БД «Цифрового деканата» демонстрационными данными и аккаунтами.
# Запуск из каталога deploy:  sh seed.sh
# ВНИМАНИЕ: сид пересоздаёт/обновляет демо-данные. Перед запуском на данных,
# которые нужны, сделайте бэкап: sh backup.sh
set -eu
. "$(dirname "$0")/lib.sh"

log "Проверка стека"
require_docker
load_env
cid=$({ $COMPOSE ps -q app; } 2>/dev/null | head -n 1)
[ -n "$cid" ] || die "Контейнер app не запущен. Сначала выполните sh deploy.sh"
db_cid=$({ $COMPOSE ps -q db; } 2>/dev/null | head -n 1)
[ -n "$db_cid" ] || die "Контейнер db не запущен. Сначала выполните sh deploy.sh"

warn "Сид ПЕРЕСОЗДАЁТ демонстрационные данные (группы, студенты, расписание, заявки, новости)."
warn "Боевые данные не трогает, но лучше сделать бэкап: sh backup.sh"
warn "Пароль демо-аккаунтов = DEMO_ACCOUNT_PASSWORD из deploy/.env.prod."

log "1/2: npm run db:seed — демо-данные"
# В package.json db:seed = node --env-file-if-exists=.env scripts/seed-full.mjs;
# секреты приходят из env_file контейнера, отдельный .env внутри образа не нужен.
if ! $COMPOSE exec -T app npm run db:seed; then
	warn "npm run db:seed завершился с ошибкой — запускаю сид напрямую: node scripts/seed-full.mjs"
	$COMPOSE exec -T app node scripts/seed-full.mjs
fi

log "2/2: npm run db:accounts — учётные записи для входа"
if $COMPOSE exec -T app node -e "var s=require('./package.json').scripts||{};process.exit(s['db:accounts']?0:1)" >/dev/null 2>&1; then
	if ! $COMPOSE exec -T app npm run db:accounts; then
		warn "npm run db:accounts завершился с ошибкой — пробую node scripts/export-accounts.mjs"
		$COMPOSE exec -T app node scripts/export-accounts.mjs ||
			warn "Экспорт аккаунтов не удался — список логинов см. в docs/ACCOUNTS.md репозитория."
	fi
else
	warn "npm-скрипт db:accounts пока не добавлен в package.json — пропускаю шаг аккаунтов."
fi

# Экспорт создаётся в контейнере (/app/docs) — копируем файлы к проекту на хосте.
for f in ACCOUNTS.md accounts.csv accounts.xlsx; do
	if $COMPOSE cp "app:/app/docs/$f" "$PROJECT_DIR/docs/$f" >/dev/null 2>&1; then
		log "Экспорт скопирован на хост: docs/$f"
	fi
done

cat <<EOF

============================================================
 Сид выполнен.
   Демо-аккаунты и пароли: docs/ACCOUNTS.md (docs/accounts.csv)
   Вход:                   https://$DOMAIN/login  (сотрудник: /staff-login)
   Пароль демо-аккаунтов:  DEMO_ACCOUNT_PASSWORD из deploy/.env.prod
============================================================
EOF
