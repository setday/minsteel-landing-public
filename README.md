# МинСтил — сайт minsteel.info

Статический сайт на Astro 7: https://minsteel.info

## Команды

```bash
npm ci                 # зависимости строго по lockfile
npm run dev            # dev-сервер (Astro 7 запускает его в фоне; адрес печатается в консоли)
npx astro dev stop     # остановить dev-сервер
npm run build          # сборка в dist/
npx astro check        # проверка типов
node tools/shot.mjs <url> <out.png> [w] [h] [scrollY|y1,y2,...]  # скриншоты через headless Chrome
```

Телеметрия Astro отключается переменной `ASTRO_TELEMETRY_DISABLED=1`.

## Где что менять

| Что | Файл |
|---|---|
| Телефоны, почта, мессенджеры, адрес, реквизиты | `src/data/site.ts` |
| Продукция (название и строка описания) | `src/data/catalog.ts` |
| Фото продукции | `src/assets/products/<slug>.jpg` (генерация: `tools/codex/gen_products.md`) |
| Логотипы клиентов | `src/assets/clients/` + список в `src/data/site.ts` → `clients` |
| Логотип МинСтил | `src/components/LogoMark.astro`, `Logo.astro`, `public/logo-mark.svg`, `public/favicon.svg` |
| Статичный кадр 3D (телефоны, LCP) | `src/assets/hero-poster.png` ← `node tools/poster.mjs http://127.0.0.1:4322/ src/assets/hero-poster.png` |
| Фото выставок | `src/data/exhibitions.ts` + файлы в `public/expo/` |
| Цвета, шрифты, отступы | `src/styles/global.css` (токены в `:root`) |
| 3D-разрез футеровки на первом экране | `src/scripts/lining3d.ts`, `src/components/Hero.astro` |
| Форма запроса (mailto / мессенджеры) | `src/scripts/request.ts`, `src/components/RequestBuilder.astro` |
| Яндекс.Метрика | переменная `PUBLIC_YM_ID` в `.env` (см. `.env.example`) |

## Принципы

- Сайт не собирает персональные данные: нет форм с отправкой на сервер. Конструктор запроса открывает почту или мессенджер посетителя.
- Все файлы (шрифты, three.js, модели) — свои, без внешних CDN. Внешний скрипт только один: Метрика.
- Одностраничный лендинг: первый экран → продукция → о компании → клиенты → контакты и запрос.
- Фото продукции сгенерированы (иллюстративные, на сайте есть пометка). Реальные фото — положить `<slug>.jpg` в `src/assets/products/`.

## Публикация на GitHub Pages

Сборку и выкладку делает `.github/workflows/deploy.yml` при пуше в `master`.

1. Создать репозиторий на GitHub и запушить проект в ветку `master`.
2. **Settings → Pages → Source: GitHub Actions.**
3. Пока домена нет — ничего не задавать: сайт будет на `https://<user>.github.io/<repo>/`. Пути учитывают подпапку (`BASE_PATH`, `src/lib/url.ts`).
4. Когда `minsteel.info` будет куплен:
   - Settings → Secrets and variables → Actions → Variables: `CUSTOM_DOMAIN = minsteel.info`;
   - у регистратора: записи `A` на `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (и `AAAA` по документации GitHub), для `www` — `CNAME` на `<user>.github.io`;
   - Settings → Pages: указать домен и включить «Enforce HTTPS».
5. Метрика: переменная `PUBLIC_YM_ID` там же.

Локальная проверка сборки «как на GitHub без домена»:

```bash
SITE_URL=https://<user>.github.io BASE_PATH=/<repo> npm run build && npx astro preview
```
