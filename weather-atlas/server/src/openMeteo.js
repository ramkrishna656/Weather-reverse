import "./env.js";

// Thin Open-Meteo client: builds upstream URLs, fetches with a timeout,
// and reshapes responses into the compact JSON the frontend consumes.

function getForecastUrl() {
  if (process.env.OPEN_METEO_FORECAST_URL) {
    return process.env.OPEN_METEO_FORECAST_URL;
  }
  return process.env.OPEN_METEO_API_KEY
    ? "https://customer-api.open-meteo.com/v1/forecast"
    : "https://api.open-meteo.com/v1/forecast";
}

function getGeocodeUrl() {
  if (process.env.OPEN_METEO_GEOCODE_URL) {
    return process.env.OPEN_METEO_GEOCODE_URL;
  }
  return process.env.OPEN_METEO_API_KEY
    ? "https://customer-geocoding-api.open-meteo.com/v1/search"
    : "https://geocoding-api.open-meteo.com/v1/search";
}

const UPSTREAM_TIMEOUT_MS = 8000;

export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new UpstreamError(
      timedOut ? "Open-Meteo timed out" : "Could not reach Open-Meteo",
      timedOut ? 504 : 502,
    );
  }
  if (!res.ok) {
    let reason = "";
    try {
      reason = (await res.json())?.reason ?? "";
    } catch {
      /* body was not JSON */
    }
    throw new UpstreamError(`Open-Meteo responded ${res.status}${reason ? `: ${reason}` : ""}`);
  }
  return res.json();
}

export async function geocode(query, count = 6) {
  const url = new URL(getGeocodeUrl());
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  if (process.env.OPEN_METEO_API_KEY) {
    url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
  }
  const data = await getJson(url);
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1 ?? null,
    country: r.country ?? null,
    countryCode: r.country_code ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
    population: r.population ?? null,
  }));
}

const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const HOURLY_VARS = ["temperature_2m", "precipitation_probability", "weather_code"];
const DAILY_VARS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "precipitation_sum",
  "precipitation_probability_max",
  "uv_index_max",
  "wind_speed_10m_max",
];

export async function forecast({ latitude, longitude, units }) {
  const url = new URL(getForecastUrl());
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", CURRENT_VARS.join(","));
  url.searchParams.set("hourly", HOURLY_VARS.join(","));
  url.searchParams.set("daily", DAILY_VARS.join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  if (units === "imperial") {
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
  }
  if (process.env.OPEN_METEO_API_KEY) {
    url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
  }
  const raw = await getJson(url);
  return shapeForecast(raw, units);
}

// Open-Meteo returns column-oriented arrays; the UI wants row objects.
export function shapeForecast(raw, units = "metric") {
  const c = raw.current ?? {};
  const d = raw.daily ?? {};
  const h = raw.hourly ?? {};

  const daily = (d.time ?? []).map((date, i) => ({
    date,
    weatherCode: d.weather_code?.[i] ?? 0,
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
    precipitationSum: d.precipitation_sum?.[i] ?? 0,
    precipitationProbability: d.precipitation_probability_max?.[i] ?? 0,
    uvIndexMax: d.uv_index_max?.[i] ?? null,
    windSpeedMax: d.wind_speed_10m_max?.[i] ?? null,
  }));

  // Keep the next 24 hours starting from the current hour.
  const times = h.time ?? [];
  const nowIdx = Math.max(
    0,
    times.findIndex((t) => t >= (c.time ?? "").slice(0, 13)),
  );
  const hourly = times.slice(nowIdx, nowIdx + 24).map((time, i) => ({
    time,
    temperature: h.temperature_2m?.[nowIdx + i] ?? null,
    precipitationProbability: h.precipitation_probability?.[nowIdx + i] ?? 0,
    weatherCode: h.weather_code?.[nowIdx + i] ?? 0,
  }));

  return {
    location: {
      latitude: raw.latitude,
      longitude: raw.longitude,
      elevation: raw.elevation ?? null,
      timezone: raw.timezone ?? null,
      utcOffsetSeconds: raw.utc_offset_seconds ?? 0,
    },
    units: {
      system: units,
      temperature: units === "imperial" ? "°F" : "°C",
      windSpeed: units === "imperial" ? "mph" : "km/h",
      precipitation: units === "imperial" ? "in" : "mm",
      pressure: "hPa",
    },
    current: {
      time: c.time ?? null,
      temperature: c.temperature_2m ?? null,
      apparentTemperature: c.apparent_temperature ?? null,
      humidity: c.relative_humidity_2m ?? null,
      isDay: c.is_day === 1,
      precipitation: c.precipitation ?? 0,
      weatherCode: c.weather_code ?? 0,
      cloudCover: c.cloud_cover ?? 0,
      pressure: c.pressure_msl ?? null,
      windSpeed: c.wind_speed_10m ?? 0,
      windDirection: c.wind_direction_10m ?? 0,
      windGusts: c.wind_gusts_10m ?? null,
    },
    hourly,
    daily,
  };
}
