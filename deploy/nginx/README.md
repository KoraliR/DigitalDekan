# Вариант с host-nginx и certbot (без Caddy)

Альтернатива основному варианту с Caddy. Здесь TLS терминирует nginx, установленный
на хосте VPS, а Docker поднимает только БД и приложение:

```
db (внутренняя сеть compose) <- app (127.0.0.1:3000) <- nginx хоста (80/443) <- интернет
```

В этом режиме запускается **только** `deploy/docker-compose.prod.yml`
(`docker-compose.caddy.yml` не подключается). Порт приложения опубликован как
`127.0.0.1:3000`, то есть извне недоступен.

Дальше `dekanat.example.ru` — плейсхолдер: замените его на свой домен (тот же, что
`DOMAIN` в `deploy/.env.prod`).

## 1. Установка nginx и certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2. Запуск контейнеров (без Caddy)

```bash
cd /opt/dekanat/deploy      # путь к вашему каталогу проекта
WITH_CADDY=0 sh deploy.sh   # либо вручную:
# docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Проверьте, что приложение отвечает локально:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

## 3. Конфиг nginx

```bash
# Замените dekanat.example.ru на свой домен во всём файле
sudo cp deploy/nginx/dekanat.conf /etc/nginx/sites-available/dekanat.conf
sudo sed -i 's/dekanat.example.ru/ваш.домен.ru/g' /etc/nginx/sites-available/dekanat.conf

sudo ln -sf /etc/nginx/sites-available/dekanat.conf /etc/nginx/sites-enabled/dekanat.conf
# На свежем nginx уберите дефолтный сайт, чтобы он не перехватывал запросы:
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

## 4. Сертификат Let's Encrypt (certbot)

```bash
sudo certbot --nginx -d ваш.домен.ru \
  --email admin@example.ru --agree-tos --redirect --non-interactive
```

`--nginx` сам добавит пути к сертификатам в конфиг и настроит редирект HTTP→HTTPS.
Проверка: `sudo certbot certificates` и `curl -I https://ваш.домен.ru`.

## 5. Автопродление

Certbot в Ubuntu ставит systemd-таймер `certbot.timer` — продление автоматическое:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run      # проверка без реального продления
sudo systemctl status certbot.timer
```

Если таймера нет, добавьте cron:

```
0 3 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

## 6. Фаервол

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80/tcp + 443/tcp
sudo ufw enable
```

Порт 3000 наружу НЕ открывайте — он слушает только loopback.

## Диагностика

```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
cd deploy && sh logs.sh app
sh status.sh
```

## Переход между вариантами

- Caddy → nginx: остановить Caddy (`docker compose ... stop caddy` / `down`), запустить
  `WITH_CADDY=0`, настроить nginx.
- nginx → Caddy: остановить nginx (`sudo systemctl stop nginx`, `sudo systemctl disable nginx`),
  запустить обычный `sh deploy.sh`.
- Одновременно nginx и Caddy на портах 80/443 работать не смогут.
