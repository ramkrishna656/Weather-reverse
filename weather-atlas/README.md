# Weather Atlas

Weather as a small floating island you can orbit. The sky, light, clouds, wind and precipitation on the island are driven by live Open-Meteo data. Seven pillars on a ring around it are the 7-day forecast: height is the day's high, colour is the weather. Click one to restage the whole scene for that day.

- **Frontend:** React 18, Vite, TypeScript, react-three-fiber and drei (client/)
- **Backend:** Express proxy for Open-Meteo with validation, caching and rate limiting (server/)

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # API on :4000, Vite on :5173 (proxies /api)
```

Open http://localhost:5173.

For a single-process production run:

```bash
npm run build      # type-checks, then builds client/dist
npm start          # Express serves the API and the built client on :4000
```

## API

| Route | Purpose |
| --- | --- |
| `GET /api/geocode?q=<name>` | Place search (2-80 chars), cached 1 hour |
| `GET /api/weather?lat=&lon=&units=metric\|imperial` | Current, next 24 hours, 7 days. Coordinates are rounded to 0.01° and cached 10 minutes |
| `GET /api/health` | Liveness check |

Environment variables: copy `.env.example` to `.env` to configure `PORT` (4000), `OPEN_METEO_API_KEY` (optional commercial key), `CORS_ORIGIN` (comma-separated list, default any), `OPEN_METEO_FORECAST_URL` and `OPEN_METEO_GEOCODE_URL` (override upstream endpoints).

Open-Meteo's free tier is for non-commercial use; see https://open-meteo.com/en/terms before deploying commercially.

## Tests

```bash
npm test           # shaping, validation, caching and error mapping for the API
npm run typecheck
```

## Using REA with this project

[REA](https://github.com/morluto/rea) is a reverse-engineering toolkit: it inspects existing apps, websites and binaries and reports evidence about how they work. It contains no weather or UI code, so nothing here depends on it. Use it when you want to study a reference app you like (for example, how another weather site builds its 3D view) before changing this one:

```bash
npx -y rea-agents@latest setup                                   # register REA with your agent
npx -y rea-agents@latest analyze-javascript-application /path/to/extracted/app --json
```

Then ask your agent to investigate the feature with REA and apply what it finds to `client/src/components/scene/`. Only analyze software you are permitted to inspect.
