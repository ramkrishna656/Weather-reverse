import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, type Place } from "../lib/api";

interface Props {
  onPick: (p: Place) => void;
  onLocate: () => void;
  locating: boolean;
}

export const placeLabel = (p: Place) => [p.name, p.admin1, p.country].filter(Boolean).join(", ");

export function SearchBox({ onPick, onLocate, locating }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const found = await searchPlaces(term, ctrl.signal);
        setResults(found);
        setStatus(found.length ? "idle" : "empty");
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 280);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (p: Place) => {
    onPick(p);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results.length) {
      pick(results[Math.max(0, active)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div className="search" ref={wrap}>
      <div className="search-row">
        <input
          type="search"
          value={q}
          placeholder="Search for a city"
          aria-label="Search for a city"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <button type="button" className="icon-btn" onClick={onLocate} disabled={locating} title="Use my location">
          {locating ? "Locating…" : "Near me"}
        </button>
      </div>
      {showList && (
        <ul className="results" id={listId} role="listbox">
          {status === "loading" && <li className="note">Searching…</li>}
          {status === "empty" && <li className="note">No places match “{q.trim()}”. Check the spelling or try a larger city nearby.</li>}
          {status === "error" && <li className="note">Search failed. Check your connection and try again.</li>}
          {results.map((p, i) => (
            <li
              key={p.id ?? `${p.latitude},${p.longitude}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <strong>{p.name}</strong>
              <span>{[p.admin1, p.country].filter(Boolean).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
