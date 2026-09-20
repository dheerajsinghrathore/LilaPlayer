import { useEffect, useMemo, useRef, useState } from 'react';
import { MapViewer } from './components/MapViewer';
import { useViewerStore } from './store';
import { loadEvents } from './lib/duckdb';
import type { GameEvent } from './types/game';
import './styles.css';

export default function App() {
  const state = useViewerStore();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentTimeRef = useRef(state.currentTimeMs);
  const initialSelectionRef = useRef(false);

  useEffect(() => {
    currentTimeRef.current = state.currentTimeMs;
  }, [state.currentTimeMs]);

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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (state.mapId !== 'all' && event.mapId !== state.mapId) return false;
      if (state.date !== 'all' && event.date !== state.date) return false;
      if (state.matchId !== 'all' && event.matchId !== state.matchId) return false;
      if (state.playerType === 'human' && event.isBot) return false;
      if (state.playerType === 'bot' && !event.isBot) return false;
      return true;
    });
  }, [events, state.date, state.mapId, state.matchId, state.playerType]);

  const currentMatchOptions = useMemo(() => {
    const allowed = filteredEvents.length
      ? new Set(filteredEvents.map((event) => event.matchId))
      : new Set(events.map((event) => event.matchId));
    return ['all', ...Array.from(allowed).sort()];
  }, [events, filteredEvents]);

  const maxTime = useMemo(() => {
    const times = filteredEvents.map((event) => event.tsMs);
    return times.length > 0 ? Math.max(...times) : 10000;
  }, [filteredEvents]);

  useEffect(() => {
    if (!events.length || initialSelectionRef.current) return;

    const mapCounts = new Map<string, number>();
    const dateCounts = new Map<string, number>();
    const matchCounts = new Map<string, number>();

    for (const event of events) {
      mapCounts.set(event.mapId, (mapCounts.get(event.mapId) ?? 0) + 1);
      dateCounts.set(event.date, (dateCounts.get(event.date) ?? 0) + 1);
      matchCounts.set(event.matchId, (matchCounts.get(event.matchId) ?? 0) + 1);
    }

    const preferredMap = [...mapCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'AmbroseValley';
    const preferredDate = [...dateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'February_10';
    const preferredMatch = [...matchCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'all';

    if (state.mapId === 'all' && state.date === 'all' && state.matchId === 'all') {
      state.set('mapId', preferredMap);
      state.set('date', preferredDate);
      state.set('matchId', preferredMatch);
      state.set('heatmap', 'traffic');
      state.set('playing', true);
      initialSelectionRef.current = true;
    }
  }, [events, state]);

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
    if (state.currentTimeMs > maxTime) {
      state.set('currentTimeMs', maxTime);
    }
  }, [maxTime, state]);

  useEffect(() => {
    if (!state.playing) return;

    const tickMs = Math.max(32, 160 / state.playbackSpeed);
    const step = Math.max(180, Math.round(maxTime / 220));
    const timer = window.setInterval(() => {
      const current = currentTimeRef.current;
      const next = current >= maxTime ? 0 : Math.min(maxTime, current + step);
      currentTimeRef.current = next;
      state.set('currentTimeMs', next);
      if (next >= maxTime) {
        state.set('playing', false);
      }
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [maxTime, state.playbackSpeed, state.playing, state]);

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
      {error ? <div className="notice">{error}. Generate public/data/events.parquet with the Python helper first.</div> : null}
      <section className="filters">
        <label>Map<select value={state.mapId} onChange={(e) => state.set('mapId', e.target.value)}><option value="all">All maps</option><option>AmbroseValley</option><option>GrandRift</option><option>Lockdown</option></select></label>
        <label>Date<select value={state.date} onChange={(e) => state.set('date', e.target.value)}><option value="all">All dates</option><option>February_10</option><option>February_11</option><option>February_12</option><option>February_13</option><option>February_14</option></select></label>
        <label>Match<select value={state.matchId} onChange={(e) => state.set('matchId', e.target.value)}>
          {currentMatchOptions.map((match) => (
            <option key={match} value={match}>{match === 'all' ? 'All matches' : match}</option>
          ))}
        </select></label>
        <label>Players<select value={state.playerType} onChange={(e) => state.set('playerType', e.target.value as typeof state.playerType)}><option value="all">Humans + Bots</option><option value="human">Humans</option><option value="bot">Bots</option></select></label>
        <label>Heatmap<select value={state.heatmap} onChange={(e) => state.set('heatmap', e.target.value as typeof state.heatmap)}><option value="none">Off</option><option value="traffic">Traffic</option><option value="kills">Kills</option><option value="deaths">Deaths</option><option value="storm">Storm deaths</option></select></label>
      </section>
      <section className="workspace">
        <div className="map-card"><MapViewer mapId={state.mapId} events={filteredEvents} currentTimeMs={state.currentTimeMs} heatmap={state.heatmap} /></div>
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
          <div className="legend"><span>🔴 Kill</span><span>⚪ Death</span><span>🟡 Loot</span><span>🟣 Storm death</span><span>━━ Human path</span><span>╌╌ Bot path</span></div>
        </aside>
      </section>
      <section className="timeline">
        <div className="timeline-head">
          <h2>Playback</h2>
          <div className="playback-controls">
            <button type="button" onClick={() => state.set('playing', !state.playing)}>{state.playing ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => { state.set('currentTimeMs', 0); state.set('playing', false); }}>Reset</button>
            <button type="button" onClick={() => { state.set('currentTimeMs', maxTime); state.set('playing', false); }}>End</button>
          </div>
          <span>{formatTime(state.currentTimeMs)} / {formatTime(maxTime)}</span>
        </div>
        <div className="timeline-footer">
          <input type="range" min="0" max={maxTime} value={state.currentTimeMs} onChange={(e) => { state.set('currentTimeMs', Number(e.target.value)); state.set('playing', false); }} />
          <label className="speed-select">
            Speed
            <select value={state.playbackSpeed} onChange={(e) => state.set('playbackSpeed', Number(e.target.value))}>
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
