# Развёртывание «Цифрового деканата» на VPS с доменом и HTTPS

Инструкция для чистого VPS (Ubuntu 22.04/24.04) с доменным именем и автоматическим
TLS-сертификатом Let's Encrypt. Всё, что нужно, уже лежит в репозитории:

| Что | Где |
| --- | --- |
| Продакшен-сборка приложения | `Dockerfile` |
| Оркестрация: PostgreSQL + приложение | `deploy/docker-compose.prod.yml` |
| Reverse-proxy с авто-HTTPS (Caddy) | `deploy/docker-compose.caddy.yml`, `deploy/Caddyfile` |
| Переменные окружения (шаблон / готовый файл) | `deploy/.env.prod.example`, `deploy/.env.prod` |
| Скрипты деплоя, сида, бэкапов | `deploy/*.sh` |
| Альтернатива: host-nginx + certbot | `deploy/nginx/` |
| Учётные записи | `docs/ACCOUNTS.md`, `docs/accounts.csv`, `docs/accounts.xlsx` |
| Готовый дамп наполненной БД | `deploy/backups/dekanat-db-seed.dump` (см. раздел 9) |

Время на первое развёртывание — 20–40 минут (из них 5–10 минут — сборка образа и выпуск сертификата).

---

## 0. Архитектура

```
Интернет ── :80/:443 ──► Caddy (авто-HTTPS, Let's Encrypt)
                               │  reverse_proxy
                               ▼
                        app (Next.js, :3000, только внутри Docker-сети)
                               │
                               ▼
                        db (PostgreSQL 18, порт наружу НЕ публикуется)
```

- Caddy сам получает и продлевает сертификат Let's Encrypt (HTTP-01 challenge через порт 80).
- Наружу открыты только 22 (SSH), 80 и 443. Порт приложения 3000 и порт БД 5432 недоступны из интернета.
- Секреты хранятся только в `deploy/.env.prod` (в git не попадает).
- Данные — в named volume `dekanat-db`; сертификаты — в `caddy-data`.

---

## 1. Что понадобится

- VPS: **2 vCPU, 2–4 ГБ RAM, 20+ ГБ SSD**, Ubuntu 22.04/24.04 LTS. При 2 ГБ RAM создайте swap (раздел 4).
- Домен (любой регистратор) и доступ к его DNS-записям.
- SSH-доступ к серверу (root или пользователь с sudo) и ключ.
- ~30 минут времени.

Домены в примерах: `dekanat.example.ru` — замените на свой. Дальше используется и IP-заглушка `203.0.113.10`.

---

## 2. Домен и DNS (до развёртывания!)

1. Выберите имя, например `dekanat.вашдомен.ру` (чем короче — тем удобнее для QR-кодов).
2. В панели DNS регистратора создайте записи:

| Тип | Имя (Host) | Значение | TTL |
| --- | --- | --- | --- |
| A | `dekanat` | `203.0.113.10` (IP вашего VPS) | 300–3600 |
| AAAA | `dekanat` | IPv6 VPS — только если он реально настроен на сервере | 300 |
| CNAME | `www` | `dekanat.вашдомен.ру` | 3600 |

3. Проверьте, что домен уже указывает на VPS (с любого компьютера):

```bash
nslookup dekanat.example.ru
# или: dig +short A dekanat.example.ru
# ожидаем: 203.0.113.10
```

> **Cloudflare/прокси:** на время первого выпуска сертификата включите режим **DNS only**
> (серая тучка). После успешного выпуска можно включить оранжевую тучку при режиме SSL
> «Full (strict)». Если оставить прокси сразу, HTTP-01 challenge может не пройти.
>
> **Нет домена под рукой?** Для теста можно взять `dekanat.203-0-113-10.nip.io` — этот
> публичный DNS сам резолвит имя в IP. Потом замените домен в `.env.prod` и перезапустите Caddy.

---

## 3. Создание VPS и первый вход

1. Создайте сервер Ubuntu 24.04 в панели провайдера (Timeweb, Beget, Selectel, Hetzner, Aeza и т. п.).
2. Добавьте SSH-ключ (или получите пароль root по почте).
3. Подключитесь:

```bash
ssh root@203.0.113.10
# если пользователь не root:
ssh your-user@203.0.113.10
```

Проверьте, что IP совпадает с тем, что прописан в DNS.

---

## 4. Базовая настройка сервера

```bash
# Обновление системы
apt update && apt upgrade -y

# Часовой пояс (приложение считает даты по Москве)
timedatectl set-timezone Europe/Moscow

# Swap 2 ГБ — страховка при сборке на VPS с 2 ГБ RAM (пропустите, если RAM >= 4 ГБ)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Фаервол: SSH + HTTP + HTTPS
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Проверьте firewall в панели провайдера: порты 80 и 443 должны быть открыты и там
(у некоторых хостеров есть отдельный «облачный фаервол»/security group).

Опционально: `apt install -y fail2ban unattended-upgrades && systemctl enable --now fail2ban`.

---

## 5. Установка Docker и Compose

Официальный репозиторий Docker (рекомендуется, Ubuntu 22.04/24.04):

```bash
apt update && apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Быстрый альтернативный способ: `curl -fsSL https://get.docker.com | sh`.

Проверка:

```bash
docker --version           # Docker version 27+ / 29+
docker compose version     # Docker Compose version v2.x / v5.x
```

---

## 6. Доставка проекта на сервер

Проект — обычный каталог с `Dockerfile` в корне. Три варианта, выберите один.

### Вариант A. Готовый архив (самый простой)

В комплекте уже собран архив `outputs/dekanat-vps-2026-11-21.zip` (исходники + `deploy/`
с готовым `.env.prod` + наполненный дамп БД). На своём компьютере (Windows PowerShell):

```powershell
scp .\outputs\dekanat-vps-2026-11-21.zip root@203.0.113.10:/opt/
ssh root@203.0.113.10 "cd /opt && apt install -y unzip && unzip dekanat-vps-2026-11-21.zip -d dekanat"
ssh root@203.0.113.10 "chmod +x /opt/dekanat/deploy/*.sh"   # zip теряет права на запуск
```

> Если собираете архив заново: `zip`/`7z` не сохраняют unix-права, поэтому после
> распаковки на сервере выполните `chmod +x deploy/*.sh` (или запускайте скрипты
> через `sh deploy.sh` — так работает всегда).

### Вариант B. Git (если репозиторий запушен в GitHub)

```bash
mkdir -p /opt && cd /opt
apt install -y git
git clone https://github.com/KoraliR/DigitalDekan.git dekanat
cd dekanat
```

Секреты (`deploy/.env.prod`) намеренно не хранятся в git: скопируйте файл отдельно
через `scp` или создайте из шаблона (раздел 7).

### Вариант C. rsync

```bash
# на локальной машине из корня проекта
rsync -az --exclude node_modules --exclude .next --exclude .git --exclude work \
  ./outputs/dekanat/ root@203.0.113.10:/opt/dekanat/
```

Итоговый каталог на сервере: `/opt/dekanat` (внутри — `Dockerfile`, `deploy/`, `prisma/`, `scripts/`, ...).

---

## 7. Настройка `deploy/.env.prod`

```bash
cd /opt/dekanat/deploy
cp .env.prod.example .env.prod   # если .env.prod ещё нет
nano .env.prod
chmod 600 .env.prod
```

Файл содержит (готовый `.env.prod` в комплекте уже заполнен сгенерированными секретами):

| Переменная | Что это | Пример / как получить |
| --- | --- | --- |
| `DOMAIN` | Публичный домен без `https://` | `dekanat.example.ru` |
| `ACME_EMAIL` | Почта для Let's Encrypt (уведомления об истечении) | `admin@example.ru` |
| `POSTGRES_USER` | Пользователь БД | `dekanat` |
| `POSTGRES_PASSWORD` | Пароль БД | `openssl rand -hex 24` |
| `POSTGRES_DB` | Имя БД | `dekanat` |
| `AUTH_SECRET` | Секрет сессий Auth.js (≥32 байта) | `openssl rand -base64 32` |
| `DEMO_2FA_ENABLED` | Включить вход (учебный второй шаг с кодом на экране) | `true` |
| `DEMO_ACCOUNT_PASSWORD` | Пароль демо-аккаунтов при сиде | `dekanat-2026` |
| `TZ` | Часовой пояс контейнеров | `Europe/Moscow` |

Важно:

- `DOMAIN` и `ACME_EMAIL` **обязательно** замените на свои — с `example.ru` сертификат не выпустится.
- `DEMO_2FA_ENABLED=true` обязателен для входа: после пароля приложение показывает
  шестизначный код на экране (учебная демонстрация 2FA). Выключать эту переменную нельзя —
  вход с паролем перестанет работать.
- Пароли/секреты из готового `deploy/.env.prod` можно и нужно заменить на свои —
  после замены `POSTGRES_PASSWORD` уже развёрнутая БД не изменит пароль; меняйте его
  **до** первого запуска либо через `ALTER ROLE` (см. раздел 12).
- `AUTH_URL` и `PUBLIC_ATTENDANCE_URL` вручную не задаются: Compose сам собирает их из `DOMAIN`.

---

## 8. Первый запуск

```bash
cd /opt/dekanat/deploy
chmod +x *.sh     # если архив распаковывался не через git/scp с правами
./deploy.sh
```

> Если `./deploy.sh` отвечает `permission denied` — используйте `sh deploy.sh`:
> все скрипты написаны на POSIX sh и не требуют бита исполнения.

Скрипт проверит `.env.prod`, соберёт образ приложения, поднимет PostgreSQL,
приложение и Caddy, дождётся health-статуса и напечатает адрес. Первая сборка — 3–8 минут
(на VPS с 2 ГБ RAM может занять дольше; нужен swap).

Что происходит внутри:

1. `docker compose ... build` — многоступенчатая сборка Next.js (`npm ci`, `prisma generate`, `next build`).
2. `db` стартует и проходит healthcheck `pg_isready`.
3. `app` применяет миграции (`npx prisma migrate deploy`) и запускает `next start` на 3000.
4. `caddy` запрашивает сертификат Let's Encrypt для `DOMAIN` (нужны открытые 80/443 и DNS).
5. Healthcheck контейнера `app` опрашивает `http://127.0.0.1:3000/api/health`.

Проверка состояния:

```bash
cd /opt/dekanat/deploy
./status.sh
# или напрямую:
docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.caddy.yml ps
```

---

## 9. Наполнение базы данных

Есть два равнозначных способа. Выберите **один** (не обязательно оба).

### 9.1. Сид (рекомендуется)

```bash
cd /opt/dekanat/deploy
./seed.sh
```

Скрипт запускает в контейнере `npm run db:seed` — идемпотентный сид, который создаёт
10+ групп, 80+ студентов, 6+ сотрудников, расписание на ±6 недель, оценки, дедлайны,
заявки, новости, аудит, кампусные сервисы. Затем экспортирует учётные записи
(`npm run db:accounts`) и копирует `docs/ACCOUNTS.md`, `docs/accounts.csv` из контейнера
в каталог `docs/` на сервере (через `docker compose cp`).

Готовые файлы с аккаунтами (`docs/ACCOUNTS.md`, `docs/accounts.csv`, `docs/accounts.xlsx`)
уже лежат в архиве — они соответствуют данным сида и паролю из `DEMO_ACCOUNT_PASSWORD`.

Даты в сиде считаются от текущего дня по Москве, поэтому повторный запуск всегда
делает данные актуальными. Внимание: сид **пересоздаёт демо-данные** (пользователи
с логинами из сида перезаписываются; созданные вами через CLI аккаунты не удаляются).

### 9.2. Готовый дамп БД

В комплекте — дамп уже наполненной базы (`deploy/backups/dekanat-db-seed.dump`,
формат `pg_dump -Fc`, создан на PostgreSQL 18 с актуальной схемой):

```bash
cd /opt/dekanat/deploy
./restore.sh backups/dekanat-db-seed.dump
```

Скрипт остановит приложение, восстановит дамп в PostgreSQL (`pg_restore --clean --if-exists`)
и поднимет сервисы обратно. Важно: дамп и код должны использовать одинаковую схему —
если после даты сборки архива появились новые миграции, приложение применит их
автоматически при старте (`prisma migrate deploy`), но для сильно устаревшего дампа
надёжнее запустить `./seed.sh`.

После любого способа проверьте вход и учётные записи:

- `docs/ACCOUNTS.md` — все логины, группы, закрепления сотрудников;
- `docs/accounts.csv` — то же в CSV для Excel;
- `docs/accounts.xlsx` — готовая таблица.

---

## 10. Проверка после развёртывания

```bash
# 1) Health-эндпоинт (должен вернуть 200 и {"status":"ok","db":"up"})
curl -sS https://dekanat.example.ru/api/health

# 2) HTTPS и редирект с HTTP
curl -I http://dekanat.example.ru
curl -vI https://dekanat.example.ru 2>&1 | grep -E 'SSL|subject|issuer|HTTP/'

# 3) Сертификат: expiry, SAN
echo | openssl s_client -connect dekanat.example.ru:443 -servername dekanat.example.ru 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

В браузере:

1. Откройте `https://dekanat.example.ru` — должен быть редирект на страницу входа.
2. Студент: `https://dekanat.example.ru/login`, логин `student`, пароль `dekanat-2026`,
   затем шестизначный код, показанный на экране. Проверьте «Сегодня», «Успеваемость»,
   «Сервисы», «Календарь», «Сервисы кампуса».
3. Сотрудник: `https://dekanat.example.ru/staff-login`, логин `office`, тот же пароль и код.
   Проверьте «Обзор», «Заявки», «Посещение», «Оценки», «Аудиторию/посещаемость».
4. QR-отметка посещаемости: в кабинете сотрудника откройте «Посещение», выберите пару,
   сгенерируйте QR; откройте ссылку/QR на телефоне (та же сеть интернет) — камера
   работает только по HTTPS, поэтому проверяйте именно домен, а не IP.
5. Проверьте мобильную вёрстку (телефон) и вход с «Запомнить меня».

---

## 11. Обновление приложения

```bash
cd /opt/dekanat
git pull            # или загрузите новые файлы через scp
cd deploy
./update.sh
```

`update.sh` сам делает бэкап перед обновлением, затем `git pull` (если это git-репозиторий),
пересобирает образ, перезапускает стек (миграции применяются автоматически при старте app)
и чистит старые образы.

---

## 12. Резервное копирование и восстановление

### Бэкап

```bash
cd /opt/dekanat/deploy
./backup.sh
# → backups/dekanat-YYYYmmdd-HHMMSS.dump (custom format pg_dump)
```

Ежедневный бэкап в 03:00 (crontab):

```bash
crontab -e
# добавить строку:
0 3 * * * cd /opt/dekanat/deploy && ./backup.sh >> backups/backup.log 2>&1
```

Скрипт хранит 14 последних дампов. **Скопируйте бэкапы за пределы VPS** — при потере
сервера локальные дампы тоже пропадут:

```powershell
# локально (Windows), раз в неделю:
scp root@203.0.113.10:/opt/dekanat/deploy/backups/*.dump .\backups\
```

Дополнительно можно бэкапить `.env.prod` (секреты) — отдельно и в защищённом месте.

### Восстановление

```bash
cd /opt/dekanat/deploy
./restore.sh backups/dekanat-20251121-030000.dump
# скрипт спросит подтверждение; app/caddy будут остановлены на время восстановления
```

После восстановления проверьте `/api/health` и вход. Если меняли `POSTGRES_PASSWORD`
для уже существующего volume, пароль в самой БД нужно обновить:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec db \
  psql -U dekanat -d dekanat -c "ALTER ROLE dekanat WITH PASSWORD 'новый_пароль';"
```

(имя пользователя/БД — из `POSTGRES_USER`/`POSTGRES_DB`).

---

## 13. Логи, мониторинг, диск

```bash
cd /opt/dekanat/deploy
./logs.sh                 # последние 200 строк всех сервисов
./status.sh               # статус контейнеров, health, срок сертификата
docker compose ... logs -f caddy   # отдельный сервис: caddy | app | db
df -h                     # свободное место
docker system df          # размер образов/volume
```

Полезно:

- `/api/health` можно опрашивать внешним мониторингом (UptimeRobot и т. п.).
- Логи Docker ограничены 10 МБ × 3 файла на сервис (см. `docker-compose.prod.yml`).
- Сертификат продлевается Caddy автоматически; данные сертификатов — в volume `caddy-data`.
  Не удаляйте этот volume без необходимости (иначе сертификат будет выпущен заново, с лимитами Let's Encrypt).

---

## 14. HTTPS: как это устроено и что делать, если сертификат не выпускается

- Caddy (`deploy/Caddyfile`) сам запрашивает сертификат у Let's Encrypt по HTTP-01
  (порт 80) и по TLS-ALPN-01 (порт 443) как резервному каналу.
- Продление автоматическое, за ~30 дней до истечения; ручные действия не нужны.
- Домен должен резолвиться на VPS **до** первого запуска Caddy, порты 80/443 — открыты.

Диагностика:

```bash
cd /opt/dekanat/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.caddy.yml logs caddy
```

Типичные причины:

| Симптом в логах Caddy | Причина / решение |
| --- | --- |
| `DNS problem: NXDOMAIN` | Домен ещё не резолвится / ошибка в DNS-записи. Проверьте `dig +short A домен`. |
| `connection refused` / timeout на challenge | Закрыты 80/443 (ufw или фаервол провайдера), либо сервер за NAT. |
| `too many failed authorizations` | Исчерпан лимит Let's Encrypt (5 ошибок/час). Подождите или тестируйте на staging-CA (закомментированный блок в `Caddyfile`). |
| `no such host` для `example.ru` | В `.env.prod` остался плейсхолдер `DOMAIN` — замените на реальный домен и `docker compose ... up -d caddy`. |
| Сертификат выпущен, но браузер ругается | Открыт IP/старый домен, либо включён Cloudflare-прокси с режимом SSL «Flexible». Включите «Full (strict)». |
| Порт 80/443 занят | На сервере уже работает nginx/apache. Остановите его **или** используйте вариант с host-nginx (раздел 15). |

Тест без реального домена: в `Caddyfile` можно временно включить `tls internal`
(самоподписанный сертификат) или staging-CA — блоки закомментированы в файле.

**Смена домена после первого запуска.** Отредактируйте `DOMAIN` в `.env.prod`, при
необходимости удалите старый ACME-контент и перезапустите Caddy:

```bash
cd /opt/dekanat/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.caddy.yml down
docker volume rm dekanat-caddy-data   # старые сертификаты больше не нужны
./deploy.sh
```

Учтите: после смены `DOMAIN` меняется `AUTH_URL` — все активные сессии станут
недействительными (пользователям нужно войти заново).

---

## 15. Альтернатива: host-nginx + certbot (если на VPS уже есть nginx)

Caddy при этом не запускается. Приложение слушает `127.0.0.1:3000` (это уже настроено
в `docker-compose.prod.yml`).

1. Запуск без Caddy:

```bash
cd /opt/dekanat/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

2. Установка nginx и certbot:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

3. Скопируйте `deploy/nginx/dekanat.conf` в `/etc/nginx/sites-available/dekanat.conf`,
   замените `dekanat.example.ru` на свой домен:

```bash
cp /opt/dekanat/deploy/nginx/dekanat.conf /etc/nginx/sites-available/dekanat.conf
ln -s /etc/nginx/sites-available/dekanat.conf /etc/nginx/sites-enabled/dekanat.conf
nginx -t && systemctl reload nginx
```

4. Выпуск сертификата и настройка HTTPS (certbot сам добавит 443 и редирект):

```bash
certbot --nginx -d dekanat.example.ru --agree-tos -m admin@example.ru --redirect
systemctl list-timers | grep certbot     # автопродление (systemd timer)
```

5. Проверьте `curl -sS https://dekanat.example.ru/api/health`.

Подробности и содержимое конфига — `deploy/nginx/README.md`.

---

## 16. Проверка перед публичным доступом (чек-лист)

- [ ] `DOMAIN` и `ACME_EMAIL` в `deploy/.env.prod` — реальные, не `example.ru`.
- [ ] `AUTH_SECRET` и `POSTGRES_PASSWORD` — сгенерированы заново (не дефолтные).
- [ ] `https://домен/api/health` возвращает `{"status":"ok","db":"up"}`.
- [ ] HTTP редиректит на HTTPS; сертификат валиден (`openssl s_client`).
- [ ] Вход студента (`/login`) и сотрудника (`/staff-login`) работает, код 2FA отображается.
- [ ] БД наполнена: ≥10 групп, ≥80 студентов, расписание есть на ±месяц.
- [ ] Ежедневный бэкап настроен в cron и **проверен** восстановлением на тестовой БД.
- [ ] Порты 3000 и 5432 недоступны из интернета (`nmap`/онлайн-сканер портов).
- [ ] `.env.prod` имеет права 600, не попадает в git и передаётся только доверенным лицам
      (в архиве для развёртывания он есть — это нормально, но не публикуйте архив открыто).
- [ ] SSH: ключи вместо пароля, root-логин по паролю выключен (по желанию — fail2ban).
- [ ] Пароль демо-аккаунтов изменён, если сервис публичный (см. раздел 17).

---

## 17. Безопасность и ограничения прототипа

Перед публичным запуском учтите:

- **Демо-данные.** Сид создаёт 80+ учебных аккаунтов с общим паролем
  `DEMO_ACCOUNT_PASSWORD` (по умолчанию `dekanat-2026`) и подсказкой на странице входа.
  Для реальной эксплуатации: смените пароли ключевых аккаунтов (студент может сменить
  пароль в профиле; сотрудникам — из терминала: `docker compose ... exec -it app
  npm run db:password -- office`), либо удалите/пересоздайте учебные аккаунты.
- **Пароли невосстановимы.** В БД только bcrypt-хеши; забытый пароль нельзя «посмотреть»,
  его можно только переустановить (`npm run db:password -- <login>` или через профиль студента).
  Файлы `docs/ACCOUNTS.*` содержат демо-пароль — не выкладывайте их в открытый доступ.
- **2FA учебная.** Код показывается на экране после ввода пароля — это демонстрация,
  а не реальный второй фактор. Не используйте сервис для настоящих персональных данных
  без доработки (TOTP/SMS/почта, сброс пароля, аудит сессий).
- **Смена пароля сотрудников** — только через CLI (`npm run db:password -- <login>`),
  у сотрудников нет страницы профиля.
- **Один процесс.** Ограничение попыток входа хранится в памяти процесса — при
  нескольких инстансах приложения лимит будет отдельным на каждый.
- **Бэкапы и обновления.** Регулярно обновляйте базовые образы
  (`docker compose pull db caddy` в непиковые часы) и приложение.
- **Если нужен ограниченный доступ** (например, показать комиссии): закройте сайт
  basic-auth на Caddy или nginx, либо ограничьте по IP на фаерволе.

---

## 18. Короткий чек-лист деплоя (копия для сервера)

```bash
# 1. DNS: A-запись домена → IP VPS (проверить: dig +short A домен)

# 2. Сервер
apt update && apt upgrade -y && timedatectl set-timezone Europe/Moscow
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# 3. Docker
curl -fsSL https://get.docker.com | sh
docker compose version

# 4. Проект
mkdir -p /opt && cd /opt
# ... scp archive + unzip, или git clone ...
# scp ../dekanat-vps-2026-11-21.zip root@IP:/opt/
# unzip dekanat-vps-2026-11-21.zip -d dekanat
chmod +x /opt/dekanat/deploy/*.sh

# 5. Секреты (готовый deploy/.env.prod уже содержит сгенерированные секреты)
cd /opt/dekanat/deploy
nano .env.prod            # заменить DOMAIN и ACME_EMAIL на реальные
chmod 600 .env.prod
# если файла почему-то нет: cp .env.prod.example .env.prod && nano .env.prod

# 6. Запуск
./deploy.sh

# 7. База (выбрать одно)
./seed.sh                          # сид: данные + аккаунты
# ./restore.sh backups/dekanat-db-seed.dump   # либо готовый дамп

# 8. Проверка
curl -sS https://ДОМЕН/api/health
# вход: https://ДОМЕН/login (student / dekanat-2026) и /staff-login (office / dekanat-2026)
# полный список аккаунтов: docs/ACCOUNTS.md
```

---

## 19. Что уже проверено в этом комплекте

Проверки выполнены локально на реальном Docker 29 / PostgreSQL 18 / Node 22:

- production-образ собирается по `Dockerfile` и запускается не от root (uid 1001);
- `docker compose config` для обоих файлов (Caddy и nginx-вариант) — без ошибок;
  порты: наружу только 80/443 у Caddy, app — `127.0.0.1:3000`, БД не публикуется;
- `caddy validate` — «Valid configuration»; `nginx -t` — syntax is ok;
- чистый том БД: `prisma migrate deploy` применяет все 12 миграций автоматически;
- `db:seed` — 91 аккаунт / 10 групп / 2 184 личных + 652 групповых занятия,
  окно расписания ±40 дней от даты запуска, повторный запуск идемпотентен;
- `db:accounts` внутри контейнера пишет `docs/` и файлы копируются на хост;
- восстановление дампа `pg_restore --clean --if-exists` — счётчики совпадают,
  приложение после восстановления healthy;
- браузерный смоук (Edge/Playwright): вход студента, старосты и двух сотрудников,
  все разделы кабинета, `.ics`-экспорт, журнал старосты, ограничение видимости
  групп у сотрудника, `/api/health` — **28/28 проверок** без ошибок страниц.

Не проверено локально (только на сервере): фактический выпуск сертификата Let's Encrypt
(нужен реальный домен), доступность с внешнего интернета и автопродление сертификата.
