# Production-деплой «Цифрового деканата» на VPS

Кит для развёртывания на Ubuntu 22.04/24.04: PostgreSQL 18 + Next.js 16 в Docker,
HTTPS с автоматическим сертификатом Let's Encrypt (Caddy), бэкапы и скрипты
обслуживания. Подробная пошаговая инструкция — в
[DEPLOY-VPS.md](../docs/DEPLOY-VPS.md) (каталог `docs/`).

## Что внутри

| Файл | Назначение |
| --- | --- |
| `docker-compose.prod.yml` | Базовый стек: `db` (PostgreSQL 18) + `app` (Next.js), порт app только на loopback |
| `docker-compose.caddy.yml` | HTTPS-фронтенд Caddy: порты 80/443, автосертификат |
| `Caddyfile` | Конфиг Caddy: reverse_proxy, HSTS/security-заголовки, логи ERROR |
| `.env.prod.example` | Шаблон production-переменных (скопировать в `.env.prod`) |
| `.env.prod` | Готовые переменные этого развёртывания (секреты уже сгенерированы, заменить DOMAIN/ACME_EMAIL) |
| `deploy.sh` | Первичный деплой: проверки → build → up → ожидание healthy |
| `seed.sh` | Демо-данные (`db:seed`) + аккаунты (`db:accounts`), экспорт копируется в `docs/` |
| `update.sh` | Бэкап → git pull → rebuild → up → чистка образов |
| `backup.sh` | `pg_dump -Fc` в `deploy/backups/`, retention 14 дней |
| `restore.sh` | Восстановление из дампа (`pg_restore --clean --if-exists`) |
| `logs.sh`, `status.sh` | Логи контейнеров; статус, сертификаты Caddy, последние логи |
| `lib.sh` | Общий helper: `cd` в deploy/, `COMPOSE=...`, `wait_healthy` |
| `nginx/` | Альтернатива Caddy: host-nginx + certbot |
| `backups/` | Каталог дампов (в git не коммитятся) |

## Требования

- VPS **2 vCPU / 2–4 GB RAM / 20+ GB SSD**, Ubuntu 22.04 или 24.04;
- домен и доступ к его DNS (A-запись на IPv4 VPS, при IPv6 — ещё AAAA);
- открытые порты **80/tcp, 443/tcp, 443/udp** (для Caddy) и SSH;
- Docker Engine + плагин Docker Compose v2:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" && newgrp docker   # перелогиньтесь
  docker compose version
  ```

## Вариант A: Caddy (рекомендуется) — автоматический HTTPS

`app` + `db` + `caddy`; Caddy сам получает и продлевает сертификат.

## Вариант B: host-nginx + certbot

Запускается только `docker-compose.prod.yml`, TLS — на nginx хоста.
См. [nginx/README.md](nginx/README.md), скрипты вызывать с `WITH_CADDY=0`.

## Быстрый старт (10–15 шагов)

1. **DNS**: создайте A-запись `dekanat.ваш-домен.ru` → IP VPS (и AAAA, если есть IPv6).
   Дождитесь распространения: `dig +short dekanat.ваш-домен.ru`.
2. **VPS**: подключитесь по SSH, обновите систему:
   `sudo apt update && sudo apt upgrade -y`.
3. **Docker**: установите Docker Engine и compose plugin (команды выше),
   проверьте `docker compose version`.
4. **Проект**: скопируйте каталог проекта на VPS, например в `/opt/dekanat`
   (`git clone ... /opt/dekanat` или `rsync`), и перейдите в него: `cd /opt/dekanat`.
5. **Переменные**: `cd deploy && cp .env.prod.example .env.prod` (в этом китe
   `.env.prod` уже есть — тогда только отредактируйте) и заполните:
   - `DOMAIN` — реальный домен вместо `dekanat.example.ru`;
   - `ACME_EMAIL` — вашу почту для Let's Encrypt;
   - `POSTGRES_PASSWORD` — `openssl rand -hex 24` (hex, т.к. пароль попадает в `DATABASE_URL`);
   - `AUTH_SECRET` — `openssl rand -base64 32`.
   Права на файл: `chmod 600 .env.prod`.
6. **Проверка compose** (без запуска): `docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.caddy.yml config --quiet`
   (команда должна завершиться без ошибок) — или просто переходите к деплою.
7. **Фаервол** (если включён ufw):
   `sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp`.
8. **Деплой**: `sh deploy.sh` (или `chmod +x deploy.sh && ./deploy.sh`).
   Скрипт соберёт образ, поднимет `db` + `app`, дождётся healthy, затем запустит `caddy`.
9. **HTTPS**: откройте `https://dekanat.ваш-домен.ru/api/health` — должно быть
   `{"status":"ok","db":"up"}`. Сертификат выпускается 10–60 секунд
   (`sh logs.sh caddy` при проблемах).
10. **Демо-данные**: `sh seed.sh` — создаст группы, студентов, расписание и демо-аккаунты
    (пароль — `DEMO_ACCOUNT_PASSWORD` из `.env.prod`; список — `docs/ACCOUNTS.md`,
    экспорт из контейнера копируется на хост). Альтернатива сиду — готовый дамп:
    `sh restore.sh backups/dekanat-db-seed.dump`.
11. **Вход**: откройте `https://dekanat.ваш-домен.ru`, войдите демо-аккаунтом
    (учебная 2FA показывает код на экране при `DEMO_2FA_ENABLED=true`).
12. **Статус**: `sh status.sh` — контейнеры, healthcheck, сертификаты Caddy, логи.
13. **Автобэкап**: добавьте cron (`crontab -e`), путь замените на свой:
    ```
    0 3 * * * cd /opt/dekanat/deploy && sh backup.sh >> /var/log/dekanat-backup.log 2>&1
    ```
    Проверьте запуск вручную: `sh backup.sh`, дампы появятся в `deploy/backups/`.
14. **Обновление в будущем**: `sh update.sh` (бэкап → git pull → rebuild → up,
    миграции применяются автоматически при старте app).
15. **Опционально**: `for f in deploy/*.sh; do chmod +x "$f"; done` — чтобы запускать
    скрипты как `./deploy.sh`, `./backup.sh` и т.д. (через `sh` всё работает и без chmod).

## Управление

```bash
cd /opt/dekanat/deploy

sh deploy.sh            # первичный деплой / донастройка
sh seed.sh              # демо-данные + аккаунты (пересоздаёт демо-записи)
sh update.sh            # обновление и перезапуск
sh backup.sh            # бэкап БД
sh restore.sh backups/dekanat-YYYYmmdd-HHMMSS.dump   # восстановление (спросит yes)
sh status.sh            # состояние стека и сертификатов
sh logs.sh app          # логи приложения (Ctrl+C — выход)
sh logs.sh caddy        # логи Caddy/ACME
WITH_CADDY=0 sh deploy.sh   # вариант с host-nginx
```

Вручную те же команды задаются так:

```bash
docker compose --env-file .env.prod \
  -f docker-compose.prod.yml -f docker-compose.caddy.yml <команда>
```

## Секреты и доступы

- `.env.prod` содержит пароли: **не коммитится** (`git check-ignore deploy/.env.prod`),
  права `chmod 600`, не копируйте его в чаты/скриншоты.
- Смена `AUTH_SECRET` разлогинивает всех пользователей.
- Смена `POSTGRES_PASSWORD` требует также обновить пароль в БД (или пересоздать volume —
  потеря данных!), безопаснее менять через `ALTER USER ... PASSWORD`.
- Порт БД наружу не публикуется, app слушает только `127.0.0.1:3000`.
- `DEMO_2FA_ENABLED` должен оставаться `true`: это учебная 2FA, при которой код входа
  показывается на экране. При `false` Auth.js-провайдер отказывает во входе — в прототипе
  никто не сможет авторизоваться (см. `auth.ts`). Это ограничение прототипа, а не продакшена.

## Бэкапы и восстановление

- `backup.sh` делает `pg_dump -Fc` внутри контейнера `db` в `deploy/backups/`,
  хранит 14 дней (переопределяется `RETENTION_DAYS=30 sh backup.sh`).
- Перед миграциями и `update.sh` бэкап делается автоматически.
- Восстановление: `sh restore.sh backups/<дамп>` — подтверждение `yes`, контейнер app
  останавливается на время восстановления (Caddy продолжает работать) и поднимается после.
- Готовый дамп демо-базы `deploy/backups/dekanat-db-seed.dump` — альтернатива сиду:
  `sh restore.sh backups/dekanat-db-seed.dump` (схема в дампе уже с миграциями).
- Копируйте дампы за пределы VPS (`rsync`/`scp`/S3) — локальные бэкапы не спасают
  при потере сервера.

## Диагностика

| Симптом | Что проверить |
| --- | --- |
| Нет сайта / таймаут | DNS-запись (`dig +short DOMAIN`), фаервол, `sh status.sh`, `sh logs.sh caddy` |
| Caddy не выпускает сертификат | DNS ещё не распространился, закрыт 80/tcp, лимиты Let's Encrypt; `sh logs.sh caddy` |
| `app` перезапускается | `sh logs.sh app`: ошибка `DATABASE_URL`, неприменённые миграции, не хватает RAM |
| `permission denied` на `.env.prod` | `chmod 600 .env.prod`, запуск не от root |
| Порты 80/443 заняты | Остановите host-nginx (`sudo systemctl stop nginx`) или используйте вариант B |
| После смены домена старый сертификат | Удалите `caddy-data`: `docker volume rm dekanat-caddy-data`, затем `sh deploy.sh` |
| Кончилось место | `sh status.sh` (диск), `docker image prune -f`, удалите старые дампы |

Проверка конфигурации compose без запуска (не требуется демон):

```bash
cd /opt/dekanat
docker compose --env-file deploy/.env.prod \
  -f deploy/docker-compose.prod.yml -f deploy/docker-compose.caddy.yml config --quiet
```

Полная инструкция по VPS (DNS, SSH, firewall, HTTPS, обновления) —
[../docs/DEPLOY-VPS.md](../docs/DEPLOY-VPS.md).
