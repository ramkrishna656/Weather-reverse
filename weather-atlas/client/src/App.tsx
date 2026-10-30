import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWeather, type Place, type Units, type WeatherData } from "./lib/api";
import { deriveSceneState } from "./lib/weather";
import { SearchBox, placeLabel } from "./components/SearchBox";
import { DayPanel, HourlyStrip, NowPanel } from "./components/Panels";
import { hasWebGL } from "./lib/webgl";

const Scene = lazy(() => import("./components/scene/Scene"));

const STORE = "weather-atlas:v1";
const FALLBACK: Place = { name: "Kolkata", admin1: "West Bengal", country: "India", latitude: 22.5697, longitude: 88.3697 };

function loadSaved(): { place: Place; units: Units } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (raw?.place?.latitude != null) return { place: raw.place, units: raw.units === "imperial" ? "imperial" : "metric" };
  } catch {
    /* ignore corrupt storage */
  }
  return { place: FALLBACK, units: "metric" };
}

export default function App() {
  const saved = useMemo(loadSaved, []);
  const [place, setPlace] = useState<Place>(saved.place);
  const [units, setUnits] = useState<Units>(saved.units);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [locating, setLocating] = useState(false);
  const [webgl] = useState(hasWebGL);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchWeather(place, units, ctrl.signal)
      .then((d) => {
        setData(d);
        setDay(0);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    try {
      localStorage.setItem(STORE, JSON.stringify({ place, units }));
    } catch {
      /* storage unavailable */
    }
    return () => ctrl.abort();
  }, [place, units]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("This browser can't share your location. Search for a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace({
          name: "Your location",
          admin1: null,
          country: null,
          latitude: Math.round(pos.coords.latitude * 1000) / 1000,
          longitude: Math.round(pos.coords.longitude * 1000) / 1000,
        });
      },
      () => {
        setLocating(false);
        setError("Location access was blocked. Allow it in your browser settings or search for a city.");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  const sceneState = useMemo(() => (data ? deriveSceneState(data, day) : null), [data, day]);
  const tone = sceneState && !sceneState.isDay ? "night" : "day";

  return (
    <div className="app" data-tone={tone}>
      <div className="stage" aria-hidden={!webgl}>
        {webgl && sceneState && data ? (
          <Suspense fallback={null}>
            <Scene state={sceneState} days={data.daily} unit={data.units.temperature} selectedDay={day} onSelectDay={setDay} />
          </Suspense>
        ) : null}
        {!webgl && <p className="no-webgl">3D view needs WebGL, which this browser has turned off. The forecast below still works.</p>}
      </div>

      <header className="hud-top">
        <SearchBox onPick={setPlace} onLocate={locate} locating={locating} />
        <div className="units" role="group" aria-label="Units">
          {(["metric", "imperial"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={units === u} onClick={() => setUnits(u)}>
              {u === "metric" ? "°C" : "°F"}
            </button>
          ))}
        </div>
      </header>

      <main className="hud-main">
        <h1 className="place">{placeLabel(place)}</h1>
        {error && (
          <div className="alert" role="alert">
            <p>{error}</p>
            <button type="button" className="link-btn" onClick={() => setPlace({ ...place })}>
              Try again
            </button>
          </div>
        )}
        {loading && !data && <p className="loading">Fetching the forecast…</p>}
        {data && (
          <div className={loading ? "is-refreshing" : undefined}>
            {day === 0 ? <NowPanel data={data} /> : <DayPanel day={data.daily[day]} data={data} onBack={() => setDay(0)} />}
          </div>
        )}
      </main>

      {data && day === 0 && (
        <footer className="hud-bottom">
          <HourlyStrip data={data} />
        </footer>
      )}

      <p className="hint">Drag to orbit. Click a pillar to see that day.</p>
      <a className="credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Weather data by Open-Meteo
      </a>
    </div>
  );
}
