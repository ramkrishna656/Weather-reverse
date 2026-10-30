import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { TtlCache } from "./cache.js";
import { geocode, forecast, UpstreamError } from "./openMeteo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ geocodeFn = geocode, forecastFn = forecast } = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The 3D scene uses blob/data textures and inline styles from three.js/drei.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "data:", "blob:"],
          workerSrc: ["'self'", "blob:"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests, slow down." },
    }),
  );

  const forecastCache = new TtlCache({ ttlMs: 10 * 60_000 });
  const geocodeCache = new TtlCache({ ttlMs: 60 * 60_000 });

  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.get("/api/geocode", async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (q.length < 2 || q.length > 80) {
        return res.status(400).json({ error: "q must be 2-80 characters" });
      }
      const key = q.toLowerCase();
      let results = geocodeCache.get(key);
      if (!results) {
        results = await geocodeFn(q);
        geocodeCache.set(key, results);
      }
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/weather", async (req, res, next) => {
    try {
      const latitude = Number(req.query.lat);
      const longitude = Number(req.query.lon);
      const units = req.query.units === "imperial" ? "imperial" : "metric";
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({ error: "lat (-90..90) and lon (-180..180) are required" });
      }
      // Round to ~1 km so nearby requests share a cache entry.
      const lat = Math.round(latitude * 100) / 100;
      const lon = Math.round(longitude * 100) / 100;
      const key = `${lat},${lon},${units}`;
      let data = forecastCache.get(key);
      if (!data) {
        data = await forecastFn({ latitude: lat, longitude: lon, units });
        forecastCache.set(key, data);
      }
      res.set("Cache-Control", "public, max-age=300");
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Serve the built frontend when present (production / `npm start`).
  const dist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof UpstreamError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
