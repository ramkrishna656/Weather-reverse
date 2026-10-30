import type { Day, WeatherData } from "../lib/api";
import { clock, compass, describeCode, round, weekday } from "../lib/weather";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function NowPanel({ data }: { data: WeatherData }) {
  const { current: c, units: u } = data;
  const cond = describeCode(c.weatherCode);
  return (
    <section className="readout" aria-label="Current conditions">
      <p className="temp">
        {round(c.temperature)}
        <span className="deg">{u.temperature}</span>
      </p>
      <p className="cond">{cond.label}</p>
      <p className="feels">Feels like {round(c.apparentTemperature)}{u.temperature}</p>
      <dl className="stats">
        <Stat label="Wind" value={`${round(c.windSpeed)} ${u.windSpeed} from ${compass(c.windDirection)}`} />
        <Stat label="Gusts" value={c.windGusts == null ? "—" : `${round(c.windGusts)} ${u.windSpeed}`} />
        <Stat label="Humidity" value={`${round(c.humidity)}%`} />
        <Stat label="Cloud cover" value={`${round(c.cloudCover)}%`} />
        <Stat label="Pressure" value={`${round(c.pressure)} ${u.pressure}`} />
        <Stat label="Precipitation" value={`${round(c.precipitation, 1)} ${u.precipitation}`} />
      </dl>
    </section>
  );
}

export function DayPanel({ day, data, onBack }: { day: Day; data: WeatherData; onBack: () => void }) {
  const u = data.units;
  const cond = describeCode(day.weatherCode);
  return (
    <section className="readout" aria-label={`Forecast for ${weekday(day.date, true)}`}>
      <button type="button" className="link-btn" onClick={onBack}>
        Back to now
      </button>
      <p className="day-name">{weekday(day.date, true)}</p>
      <p className="temp">
        {round(day.tempMax)}
        <span className="deg">{u.temperature}</span>
      </p>
      <p className="cond">
        {cond.label}, low {round(day.tempMin)}
        {u.temperature}
      </p>
      <dl className="stats">
        <Stat label="Chance of rain" value={`${round(day.precipitationProbability)}%`} />
        <Stat label="Precipitation" value={`${round(day.precipitationSum, 1)} ${u.precipitation}`} />
        <Stat label="Top wind" value={`${round(day.windSpeedMax)} ${u.windSpeed}`} />
        <Stat label="UV index" value={round(day.uvIndexMax, 1)} />
        <Stat label="Sunrise" value={clock(day.sunrise)} />
        <Stat label="Sunset" value={clock(day.sunset)} />
      </dl>
    </section>
  );
}

/** Next 24 hours: temperature line over rain-chance bars. */
export function HourlyStrip({ data }: { data: WeatherData }) {
  const hours = data.hourly;
  if (hours.length < 2) return null;
  const temps = hours.map((h) => h.temperature ?? 0);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(1, hi - lo);
  const W = 480;
  const H = 90;
  const x = (i: number) => (i / (hours.length - 1)) * W;
  const y = (t: number) => H - 12 - ((t - lo) / span) * (H - 30);
  const line = temps.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t).toFixed(1)}`).join(" ");
  const ticks = [0, 6, 12, 18, 23].filter((i) => i < hours.length);

  return (
    <section className="hourly" aria-label="Next 24 hours">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Temperature from ${round(lo)} to ${round(hi)} ${data.units.temperature} over the next 24 hours`}>
        {hours.map((h, i) => (
          <rect
            key={h.time}
            x={x(i) - 4}
            width={8}
            y={H - (h.precipitationProbability / 100) * 34}
            height={(h.precipitationProbability / 100) * 34}
            className="rain-bar"
          />
        ))}
        <path d={line} className="temp-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="hourly-axis">
        {ticks.map((i) => (
          <span key={i}>{i === 0 ? "Now" : clock(hours[i].time)}</span>
        ))}
      </div>
      <p className="hourly-key">
        Line: temperature, {round(lo)}–{round(hi)}
        {data.units.temperature}. Bars: chance of rain.
      </p>
    </section>
  );
}
