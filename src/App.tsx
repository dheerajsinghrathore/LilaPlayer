import { useEffect, useMemo, useRef, useState } from 'react';
import { MapViewer } from './components/MapViewer';
import { useViewerStore } from './store';
import { loadEvents } from './lib/duckdb';
import type { GameEvent, MapId } from './types/game';
import './styles.css';

export default function App() {
  const {
    mapId,
    matchId,
    date,
    playerType,
    heatmap,
    currentTimeMs,
    playbackSpeed,
    playing,
    set,
  } = useViewerStore();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentTimeRef = useRef(currentTimeMs);

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadEvents()
      .then((rows) => {
        if (!active) return;
        setEvents(rows);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load data');
        setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const mapOptions = useMemo(() => [...new Set(events.map((event) => event.mapId))].sort(), [events]);

  const dateOptions = useMemo(() => {
    if (!mapId) return [];
    return [...new Set(events.filter((event) => event.mapId === mapId).map((event) => event.date))].sort();
  }, [events, mapId]);

  const matchOptions = useMemo(() => {
    if (!mapId || !date) return [];
    return [...new Set(events
      .filter((event) => event.mapId === mapId && event.date === date)
      .map((event) => event.matchId))].sort();
  }, [date, events, mapId]);

  useEffect(() => {
    if (mapOptions.length && !mapOptions.includes(mapId as MapId)) set('mapId', mapOptions[0]);
  }, [mapOptions, mapId, set]);

  useEffect(() => {
    if (dateOptions.length && !dateOptions.includes(date)) set('date', dateOptions[0]);
  }, [date, dateOptions, set]);

  useEffect(() => {
    if (matchOptions.length && !matchOptions.includes(matchId)) set('matchId', matchOptions[0]);
  }, [matchId, matchOptions, set]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.mapId !== mapId) return false;
      if (event.date !== date) return false;
      if (event.matchId !== matchId) return false;
      if (playerType === 'human' && event.isBot) return false;
      if (playerType === 'bot' && !event.isBot) return false;
      return true;
    });
  }, [date, events, mapId, matchId, playerType]);

  const maxTime = useMemo(() => {
    const times = filteredEvents.map((event) => event.tsMs);
    return times.length > 0 ? Math.max(...times) : 10000;
  }, [filteredEvents]);

  const summary = useMemo(() => {
    const uniquePlayers = new Set(filteredEvents.map((event) => event.userId));
    const humanPlayers = new Set(filteredEvents.filter((event) => !event.isBot).map((event) => event.userId));
    const botPlayers = new Set(filteredEvents.filter((event) => event.isBot).map((event) => event.userId));
    const kills = filteredEvents.filter((event) => event.event === 'Kill' || event.event === 'BotKill').length;
    const deaths = filteredEvents.filter((event) => event.event === 'Killed' || event.event === 'BotKilled').length;
    const loot = filteredEvents.filter((event) => event.event === 'Loot').length;
    const storm = filteredEvents.filter((event) => event.event === 'KilledByStorm').length;
    const matches = new Set(filteredEvents.map((event) => event.matchId)).size;

    return {
      players: uniquePlayers.size,
      humans: humanPlayers.size,
      bots: botPlayers.size,
      matches,
      kills,
      deaths,
      loot,
      storm,
      events: filteredEvents.length,
    };
  }, [filteredEvents]);

  useEffect(() => {
    if (currentTimeMs > maxTime) {
      set('currentTimeMs', maxTime);
    }
  }, [currentTimeMs, maxTime, set]);

  useEffect(() => {
    set('currentTimeMs', 0);
    set('playing', false);
  }, [date, mapId, matchId, set]);

  useEffect(() => {
    if (!playing) return;

    const tickMs = Math.max(32, 160 / playbackSpeed);
    const step = Math.max(180, Math.round(maxTime / 220));
    const timer = window.setInterval(() => {
      const current = currentTimeRef.current;
      const next = current >= maxTime ? 0 : Math.min(maxTime, current + step);
      currentTimeRef.current = next;
      set('currentTimeMs', next);
      if (next >= maxTime) {
        set('playing', false);
      }
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [maxTime, playbackSpeed, playing, set]);

  return (
    <main className="app">
      <header className="topbar">
        <div><div className="eyebrow">LILA BLACK</div><h1>Player Journey Explorer</h1></div>
        <div className="status status-pill">{loading ? 'Loading data…' : error ? 'Data unavailable' : 'Telemetry Explorer'}</div>
      </header>
      {loading ? (
        <div className="loading-shell" aria-live="polite">
          <div className="loading-card">
            <div className="loading-header">
              <span className="loading-label">Loading session data</span>
              <span className="loading-value">{Math.min(100, Math.max(12, Math.round((events.length / Math.max(1, 5000)) * 100)))}%</span>
            </div>
            <div className="loading-bar"><span style={{ width: `${Math.min(100, Math.max(12, Math.round((events.length / Math.max(1, 5000)) * 100)))}%` }} /></div>
          </div>
        </div>
      ) : null}
      {error ? <div className="notice" role="alert">{error}. Generate and deploy public/data/events.parquet with the Python helper first.</div> : null}
      <section className="filters">
        <label>Map<select value={mapId} disabled={!mapOptions.length} onChange={(e) => set('mapId', e.target.value)}>
          <option value="">Select a map</option>{mapOptions.map((map) => <option key={map} value={map}>{map}</option>)}
        </select></label>
        <label>Date<select value={date} disabled={!dateOptions.length} onChange={(e) => set('date', e.target.value)}>
          <option value="">Select a date</option>{dateOptions.map((dateOption) => <option key={dateOption} value={dateOption}>{dateOption}</option>)}
        </select></label>
        <label>Match<select value={matchId} onChange={(e) => set('matchId', e.target.value)}>
          <option value="">Select a match</option>{matchOptions.map((match) => <option key={match} value={match}>{match}</option>)}
        </select></label>
        <label>Players<select value={playerType} onChange={(e) => set('playerType', e.target.value as typeof playerType)}><option value="all">Humans + Bots</option><option value="human">Humans</option><option value="bot">Bots</option></select></label>
        <label>Heatmap<select value={heatmap} onChange={(e) => set('heatmap', e.target.value as typeof heatmap)}><option value="none">Off</option><option value="traffic">Traffic</option><option value="kills">Kills</option><option value="deaths">Deaths</option><option value="storm">Storm deaths</option></select></label>
      </section>
      <section className="workspace">
        <div className="map-card">
          {mapId && date && matchId
            ? <MapViewer mapId={mapId as MapId} events={filteredEvents} currentTimeMs={currentTimeMs} heatmap={heatmap} />
            : <div className="map-shell map-message">Select a map, date, and match to view a replay.</div>}
        </div>
        <aside className="sidebar">
          <h2>Match summary</h2>
          <div className="stats">
            <div><span>Matches</span><b>{summary.matches || '—'}</b></div>
            <div><span>Players</span><b>{summary.players || '—'}</b></div>
            <div><span>Humans</span><b>{summary.humans || '—'}</b></div>
            <div><span>Bots</span><b>{summary.bots || '—'}</b></div>
            <div><span>Kills</span><b>{summary.kills || '—'}</b></div>
            <div><span>Deaths</span><b>{summary.deaths || '—'}</b></div>
            <div><span>Loot</span><b>{summary.loot || '—'}</b></div>
            <div><span>Storm</span><b>{summary.storm || '—'}</b></div>
            <div className="wide-stat"><span>Events</span><b>{summary.events}</b></div>
          </div>
          <h2>Legend</h2>
          <div className="legend"><span>▲ Kill</span><span>✕ Death</span><span>◆ Loot</span><span>● Storm death</span><span>━━ Human path</span><span>╌╌ Bot path</span></div>
        </aside>
      </section>
      <section className="timeline">
        <div className="timeline-head">
          <h2>Playback</h2>
          <div className="playback-controls">
            <button type="button" onClick={() => set('playing', !playing)}>{playing ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => { set('currentTimeMs', 0); set('playing', false); }}>Reset</button>
            <button type="button" onClick={() => { set('currentTimeMs', maxTime); set('playing', false); }}>End</button>
          </div>
          <span>{formatTime(currentTimeMs)} / {formatTime(maxTime)}</span>
        </div>
        <div className="timeline-footer">
          <input type="range" min="0" max={maxTime} value={currentTimeMs} onChange={(e) => { set('currentTimeMs', Number(e.target.value)); set('playing', false); }} />
          <label className="speed-select">
            Speed
            <select value={playbackSpeed} onChange={(e) => set('playbackSpeed', Number(e.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      </section>
    </main>
  );
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
