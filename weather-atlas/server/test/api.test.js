import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { shapeForecast, UpstreamError } from "../src/openMeteo.js";

const rawFixture = {
  latitude: 22.57,
  longitude: 88.36,
  elevation: 9,
  timezone: "Asia/Kolkata",
  utc_offset_seconds: 19800,
  current: {
    time: "2026-10-31T02:00",
    temperature_2m: 26.4,
    relative_humidity_2m: 71,
    apparent_temperature: 28.9,
    is_day: 0,
    precipitation: 0,
    weather_code: 3,
    cloud_cover: 88,
    pressure_msl: 1011.2,
    wind_speed_10m: 9.4,
    wind_direction_10m: 45,
    wind_gusts_10m: 18.2,
  },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => `2026-10-${i < 24 ? "31" : "01"}T${String(i % 24).padStart(2, "0")}:00`),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 20 + i / 10),
    precipitation_probability: Array.from({ length: 48 }, () => 10),
    weather_code: Array.from({ length: 48 }, () => 3),
  },
  daily: {
    time: ["2026-10-31", "2026-11-01"],
    weather_code: [3, 61],
    temperature_2m_max: [31, 29],
    temperature_2m_min: [22, 21],
    sunrise: ["2026-10-31T05:48", "2026-11-01T05:49"],
    sunset: ["2026-10-31T16:58", "2026-11-01T16:57"],
    precipitation_sum: [0, 4.2],
    precipitation_probability_max: [10, 70],
    uv_index_max: [7, 6],
    wind_speed_10m_max: [14, 19],
  },
};

async function withServer(opts, fn) {
  const server = createApp(opts).listen(0);
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("shapeForecast converts columns to rows and slices 24 hours from now", () => {
  const out = shapeForecast(rawFixture, "metric");
  assert.equal(out.current.temperature, 26.4);
  assert.equal(out.current.isDay, false);
  assert.equal(out.daily.length, 2);
  assert.equal(out.daily[1].weatherCode, 61);
  assert.equal(out.hourly.length, 24);
  assert.equal(out.hourly[0].time, "2026-10-31T02:00");
  assert.equal(out.units.temperature, "°C");
  assert.equal(shapeForecast(rawFixture, "imperial").units.temperature, "°F");
});

test("GET /api/weather validates coordinates", async () => {
  await withServer({}, async (base) => {
    for (const q of ["", "lat=abc&lon=1", "lat=91&lon=0", "lat=0&lon=181"]) {
      const res = await fetch(`${base}/api/weather?${q}`);
      assert.equal(res.status, 400, q);
    }
  });
});

test("GET /api/weather caches by rounded coordinates and units", async () => {
  let calls = 0;
  const forecastFn = async ({ latitude, longitude, units }) => {
    calls++;
    return shapeForecast({ ...rawFixture, latitude, longitude }, units);
  };
  await withServer({ forecastFn }, async (base) => {
    const a = await fetch(`${base}/api/weather?lat=22.571&lon=88.364`);
    const b = await fetch(`${base}/api/weather?lat=22.574&lon=88.361`);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(calls, 1, "nearby coordinates share a cache entry");
    await fetch(`${base}/api/weather?lat=22.57&lon=88.36&units=imperial`);
    assert.equal(calls, 2, "units are part of the cache key");
  });
});

test("GET /api/geocode validates and returns results", async () => {
  const geocodeFn = async (q) => [{ id: 1, name: q, latitude: 1, longitude: 2 }];
  await withServer({ geocodeFn }, async (base) => {
    assert.equal((await fetch(`${base}/api/geocode?q=a`)).status, 400);
    const res = await fetch(`${base}/api/geocode?q=Kolkata`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).results[0].name, "Kolkata");
  });
});

test("upstream failures map to their status code", async () => {
  const forecastFn = async () => {
    throw new UpstreamError("Open-Meteo timed out", 504);
  };
  await withServer({ forecastFn }, async (base) => {
    const res = await fetch(`${base}/api/weather?lat=1&lon=1`);
    assert.equal(res.status, 504);
    assert.match((await res.json()).error, /timed out/);
  });
});
