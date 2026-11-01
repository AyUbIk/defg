# Speakyz: сайт на Cloudflare Workers

Один Worker отдаёт и сайт (`public/index.html`), и AI-эндпоинт `POST /api/chat`.

## Структура
- `public/index.html`: весь сайт
- `src/worker.js`: AI-учитель, проверка speaking и writing
- `wrangler.jsonc`: настройки Cloudflare
- `.github/workflows/deploy.yml`: автодеплой при пуше в `main`

## Первый запуск
1. Создайте репозиторий на GitHub и загрузите туда все файлы.
2. В Cloudflare создайте API-токен (шаблон «Edit Cloudflare Workers») и скопируйте Account ID.
3. В GitHub: Settings, Secrets and variables, Actions. Добавьте `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
4. Один раз добавьте ключ Anthropic в Worker (с вашего компьютера): `npm install`, затем `npx wrangler secret put ANTHROPIC_API_KEY`. Либо в панели Cloudflare: Workers, speakyz, Settings, Variables and Secrets.
5. Запушьте в `main`. Сайт будет по адресу `https://speakyz.<ваш-поддомен>.workers.dev`. Свой домен: Workers, speakyz, Settings, Domains and Routes.

## Что менять
- Telegram-аккаунты: блок `SZ_TG` в `public/index.html`.
- Модель ИИ: переменная `MODEL` в `wrangler.jsonc` (по умолчанию `claude-haiku-5-5`).
- Без ключа ИИ-функции показывают сообщение об ошибке, остальной сайт работает.

## Локально
`cp .dev.vars.example .dev.vars`, вставьте ключ, `npm install`, `npm run dev`.

## SEO и домен
- Worker сам отдаёт заголовок, описание, превью для соцсетей (`public/og.png`), canonical и разметку организации для адресов `/`, `/courses`, `/ielts`, `/teachers`, `/schedule`, `/shop`, `/test`, `/university`, `/contact`. Тексты: объект `PAGES` в `src/worker.js`.
- `robots.txt` и `sitemap.xml` строятся автоматически.
- **Когда подключите домен speakyz.uz:** в Cloudflare добавьте его в Workers, speakyz, Settings, Domains and Routes, затем в `wrangler.jsonc` впишите `"SITE_URL": "https://speakyz.uz"` и запушьте. До этого оставьте пустым, адреса возьмутся от текущего.
- После запуска добавьте сайт в Google Search Console и Яндекс Вебмастер и отправьте `https://speakyz.uz/sitemap.xml`.
- Языки RU, UZ и EN переключаются на странице. Для поисковиков основной язык русский.
