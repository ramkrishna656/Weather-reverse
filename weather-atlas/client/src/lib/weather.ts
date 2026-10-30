import type { Day, WeatherData } from "./api";

export type Kind = "clear" | "cloud" | "fog" | "rain" | "snow" | "storm";

export interface Condition {
  label: string;
  kind: Kind;
  /** 0..1 precipitation strength, used for particle density */
  intensity: number;
  /** typical cloud cover when only a weather code is known (future days) */
  cloudCover: number;
}

// WMO weather interpretation codes used by Open-Meteo.
export function describeCode(code: number): Condition {
  if (code === 0) return { label: "Clear sky", kind: "clear", intensity: 0, cloudCover: 5 };
  if (code === 1) return { label: "Mostly clear", kind: "clear", intensity: 0, cloudCover: 20 };
  if (code === 2) return { label: "Partly cloudy", kind: "cloud", intensity: 0, cloudCover: 50 };
  if (code === 3) return { label: "Overcast", kind: "cloud", intensity: 0, cloudCover: 95 };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog", intensity: 0, cloudCover: 85 };
  if (code >= 51 && code <= 55) return { label: "Drizzle", kind: "rain", intensity: 0.3 + (code - 51) * 0.1, cloudCover: 85 };
  if (code === 56 || code === 57) return { label: "Freezing drizzle", kind: "rain", intensity: 0.45, cloudCover: 90 };
  if (code === 61) return { label: "Light rain", kind: "rain", intensity: 0.4, cloudCover: 90 };
  if (code === 63) return { label: "Rain", kind: "rain", intensity: 0.7, cloudCover: 95 };
  if (code === 65) return { label: "Heavy rain", kind: "rain", intensity: 1, cloudCover: 100 };
  if (code === 66 || code === 67) return { label: "Freezing rain", kind: "rain", intensity: 0.8, cloudCover: 100 };
  if (code === 71) return { label: "Light snow", kind: "snow", intensity: 0.4, cloudCover: 90 };
  if (code === 73) return { label: "Snow", kind: "snow", intensity: 0.7, cloudCover: 95 };
  if (code === 75) return { label: "Heavy snow", kind: "snow", intensity: 1, cloudCover: 100 };
  if (code === 77) return { label: "Snow grains", kind: "snow", intensity: 0.5, cloudCover: 90 };
  if (code === 80) return { label: "Light showers", kind: "rain", intensity: 0.45, cloudCover: 80 };
  if (code === 81) return { label: "Showers", kind: "rain", intensity: 0.75, cloudCover: 90 };
  if (code === 82) return { label: "Violent showers", kind: "rain", intensity: 1, cloudCover: 100 };
  if (code === 85) return { label: "Snow showers", kind: "snow", intensity: 0.55, cloudCover: 90 };
  if (code === 86) return { label: "Heavy snow showers", kind: "snow", intensity: 0.9, cloudCover: 100 };
  if (code === 95) return { label: "Thunderstorm", kind: "storm", intensity: 0.8, cloudCover: 100 };
  if (code === 96 || code === 99) return { label: "Thunderstorm with hail", kind: "storm", intensity: 1, cloudCover: 100 };
  return { label: "Unknown", kind: "cloud", intensity: 0, cloudCover: 50 };
}

/** Everything the 3D scene needs to stage one moment. */
export interface SceneState {
  kind: Kind;
  intensity: number;
  cloudCover: number;
  isDay: boolean;
  /** 0..1 along the sun's (or moon's) arc */
  arc: number;
  /** wind in km/h-ish units, normalised for animation */
  wind: number;
  /** degrees the wind blows from */
  windDirection: number;
}

const minutesOf = (iso: string | null) => (iso ? Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) : null);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function arcProgress(isDay: boolean, now: string | null, today: Day | undefined): number {
  const rise = minutesOf(today?.sunrise ?? null);
  const set = minutesOf(today?.sunset ?? null);
  const nowM = minutesOf(now);
  if (rise == null || set == null || nowM == null) return 0.5;
  if (isDay) return clamp01((nowM - rise) / Math.max(1, set - rise));
  const nightLength = 1440 - (set - rise);
  return clamp01(((nowM - set + 1440) % 1440) / Math.max(1, nightLength));
}

export function deriveSceneState(data: WeatherData, dayIndex: number): SceneState {
  if (dayIndex === 0) {
    const c = data.current;
    const cond = describeCode(c.weatherCode);
    const intensity = cond.intensity > 0 ? cond.intensity : clamp01(c.precipitation / 6);
    return {
      kind: cond.kind,
      intensity,
      cloudCover: c.cloudCover,
      isDay: c.isDay,
      arc: arcProgress(c.isDay, c.time, data.daily[0]),
      wind: c.windSpeed,
      windDirection: c.windDirection,
    };
  }
  const d = data.daily[dayIndex];
  const cond = describeCode(d.weatherCode);
  return {
    kind: cond.kind,
    intensity: cond.intensity,
    cloudCover: cond.cloudCover,
    isDay: true,
    arc: 0.5,
    wind: d.windSpeedMax ?? 8,
    windDirection: data.current.windDirection,
  };
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

export const weekday = (date: string, long = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: long ? "long" : "short" });

export const clock = (iso: string | null) => (iso ? iso.slice(11, 16) : "—");

export const round = (n: number | null, digits = 0) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
