import * as duckdb from '@duckdb/duckdb-wasm';
import type { EventType, GameEvent, HeatmapMode } from '../types/game';

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export function getDatabase() {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

async function initDatabase() {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker || !bundle.mainModule) {
    throw new Error('DuckDB WASM bundle could not be resolved');
  }

  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}

export async function registerEventsParquet() {
  const db = await getDatabase();
  const response = await fetch('/data/events.parquet');
  if (!response.ok) throw new Error('Unable to load events.parquet');
  const buffer = new Uint8Array(await response.arrayBuffer());
  await db.registerFileBuffer('events.parquet', buffer);
  return db;
}

function normalizeEvent(value: string): EventType {
  const mapped = value.trim();
  if (mapped === 'BotPosition') return 'BotPosition';
  if (mapped === 'Kill') return 'Kill';
  if (mapped === 'Killed') return 'Killed';
  if (mapped === 'BotKill') return 'BotKill';
  if (mapped === 'BotKilled') return 'BotKilled';
  if (mapped === 'KilledByStorm') return 'KilledByStorm';
  if (mapped === 'Loot') return 'Loot';
  return 'Position';
}

function normalizeTs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function generateSyntheticEvents(): GameEvent[] {
  const maps = ['AmbroseValley', 'GrandRift', 'Lockdown'] as const;
  const dateOptions = ['February_10', 'February_11', 'February_12'];
  const events: GameEvent[] = [];

  for (let matchIdx = 0; matchIdx < 2; matchIdx++) {
    const mapId = maps[matchIdx % maps.length];
    const matchId = `synthetic_match_${matchIdx + 1}`;
    const date = dateOptions[matchIdx % dateOptions.length];

    const humanIds = ['7d2d3f7b-7e7c-4f05-bc78-01a2a6d8e911', 'd4c5f8de-c13a-4dc2-a943-d6c14f94a1f5'];
    const botIds = ['1440', '382'];

    for (const [playerIndex, userId] of humanIds.entries()) {
      const startX = -260 + playerIndex * 60;
      const startZ = -330 + playerIndex * 55;
      for (let step = 0; step < 28; step++) {
        const ts = step * 1000;
        const driftX = Math.sin(step / 3) * 20;
        const driftZ = Math.cos(step / 4) * 16;
        events.push({
          userId,
          matchId,
          mapId,
          date,
          x: startX + driftX,
          y: 120,
          z: startZ + driftZ,
          tsMs: ts,
          event: 'Position',
          isBot: false,
        });

        if (step % 7 === 0) {
          events.push({ userId, matchId, mapId, date, x: startX + 12, y: 122, z: startZ + 14, tsMs: ts + 50, event: 'Loot', isBot: false });
        }
      }
    }

    for (const userId of botIds) {
      for (let step = 0; step < 22; step++) {
        const ts = step * 1100;
        const x = -220 + step * 5 + (userId === '1440' ? 20 : -10);
        const z = -420 + step * 3 + (userId === '1440' ? -5 : 12);
        events.push({ userId, matchId, mapId, date, x, y: 118, z, tsMs: ts, event: 'BotPosition', isBot: true });
      }
    }

    for (let idx = 0; idx < 4; idx++) {
      const ts = 1000 + idx * 3000;
      const killX = -310 + idx * 40;
      const killZ = -360 + idx * 25;
      events.push({ userId: humanIds[idx % humanIds.length], matchId, mapId, date, x: killX, y: 122, z: killZ, tsMs: ts, event: idx % 2 === 0 ? 'Kill' : 'Killed', isBot: false });
      events.push({ userId: botIds[idx % botIds.length], matchId, mapId, date, x: killX + 10, y: 120, z: killZ + 12, tsMs: ts + 100, event: idx % 2 === 0 ? 'BotKilled' : 'BotKill', isBot: true });
      if (idx % 2 === 0) {
        events.push({ userId: humanIds[1], matchId, mapId, date, x: killX + 8, y: 118, z: killZ + 18, tsMs: ts + 200, event: 'KilledByStorm', isBot: false });
      }
    }
  }

  return events;
}

export async function loadEvents(): Promise<GameEvent[]> {
  try {
    const db = await registerEventsParquet();
    const conn = await db.connect();

    try {
      const table = await conn.query(`
        SELECT
          user_id AS user_id,
          match_id AS match_id,
          map_id AS map_id,
          COALESCE(date, 'unknown') AS date,
          x,
          y,
          z,
          ts,
          event,
          CAST(is_bot AS BOOLEAN) AS is_bot
        FROM read_parquet('events.parquet')
        ORDER BY ts ASC
      `);

      const rows = table.toArray().map((row) => {
        const record = row as Record<string, unknown>;
        return {
          userId: String(record.user_id ?? ''),
          matchId: String(record.match_id ?? ''),
          mapId: String(record.map_id ?? ''),
          date: String(record.date ?? 'unknown'),
          x: Number(record.x ?? 0),
          y: Number(record.y ?? 0),
          z: Number(record.z ?? 0),
          tsMs: normalizeTs(record.ts),
          event: normalizeEvent(String(record.event ?? 'Position')),
          isBot: Boolean(record.is_bot ?? false),
        } satisfies GameEvent;
      });

      if (rows.length > 0) return rows;
    } finally {
      await conn.close();
    }
  } catch {
    // Fall back to a generated demo dataset when the merged parquet isn't present yet.
  }

  return generateSyntheticEvents();
}

export function getHeatmapColor(mode: HeatmapMode) {
  switch (mode) {
    case 'traffic': return 'rgba(96, 165, 250, 0.38)';
    case 'kills': return 'rgba(239, 68, 68, 0.38)';
    case 'deaths': return 'rgba(248, 250, 252, 0.38)';
    case 'storm': return 'rgba(168, 85, 247, 0.38)';
    default: return 'rgba(96, 165, 250, 0.2)';
  }
}
