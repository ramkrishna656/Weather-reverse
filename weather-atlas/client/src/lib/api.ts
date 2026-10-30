export type Units = "metric" | "imperial";

export interface Place {
  id?: number;
  name: string;
  admin1: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
}

export interface Current {
  time: string | null;
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  isDay: boolean;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  pressure: number | null;
  windSpeed: number;
  windDirection: number;
  windGusts: number | null;
}

export interface Hour {
  time: string;
  temperature: number | null;
  precipitationProbability: number;
  weatherCode: number;
}

export interface Day {
  date: string;
  weatherCode: number;
  tempMax: number | null;
  tempMin: number | null;
  sunrise: string | null;
  sunset: string | null;
  precipitationSum: number;
  precipitationProbability: number;
  uvIndexMax: number | null;
  windSpeedMax: number | null;
}

export interface WeatherData {
  location: { latitude: number; longitude: number; timezone: string | null };
  units: { system: Units; temperature: string; windSpeed: string; precipitation: string; pressure: string };
  current: Current;
  hourly: Hour[];
  daily: Day[];
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const searchPlaces = (q: string, signal?: AbortSignal) =>
  getJson<{ results: Place[] }>(`/api/geocode?q=${encodeURIComponent(q)}`, signal).then((r) => r.results);

export const fetchWeather = (p: Pick<Place, "latitude" | "longitude">, units: Units, signal?: AbortSignal) =>
  getJson<WeatherData>(`/api/weather?lat=${p.latitude}&lon=${p.longitude}&units=${units}`, signal);
