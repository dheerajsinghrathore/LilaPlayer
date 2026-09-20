import * as duckdb from '@duckdb/duckdb-wasm';
import type { EventType, GameEvent, HeatmapMode, MapId } from "../types/game";
import {
  normalizeMatchTimes,
  parseEventType,
  parseMapId,
  parseTimestampMs,
} from "./gameData";

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

function generateSyntheticEvents(): GameEvent[] {
  const maps: MapId[] = ["AmbroseValley", "GrandRift", "Lockdown"];
  const dates = ["2024-08-14", "2024-08-15", "2024-08-16"];
  const matches = ["match-01", "match-02", "match-03"];
  const eventTypes: EventType[] = [
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "Loot",
    "KilledByStorm",
  ];
  const synthetic: GameEvent[] = [];

  for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
    const mapId = maps[matchIndex % maps.length];
    const date = dates[matchIndex % dates.length];
    const matchId = matches[matchIndex];
    const players = [
      { userId: `human-${matchIndex}-1`, isBot: false },
      { userId: `human-${matchIndex}-2`, isBot: false },
      { userId: `bot-${matchIndex}-1`, isBot: true },
      { userId: `bot-${matchIndex}-2`, isBot: true },
    ];

    let baseTs = 0;
    for (const player of players) {
      const pathLength = 20 + matchIndex * 7;
      for (let i = 0; i < pathLength; i++) {
        const t = baseTs + i * 650;
        const wave = (i / pathLength) * Math.PI * 2;
        const startX = 70 + (matchIndex % 3) * 90 + Math.sin(wave) * 90;
        const startZ = 70 + (matchIndex % 2) * 120 + Math.cos(wave) * 110;
        synthetic.push({
          userId: player.userId,
          matchId,
          mapId,
          date,
          x: Number((startX + (player.isBot ? 12 : 0)).toFixed(2)),
          y: 0,
          z: Number((startZ + (player.isBot ? 18 : 0)).toFixed(2)),
          tsMs: t,
          event: player.isBot ? "BotPosition" : "Position",
          isBot: player.isBot,
        });
      }
      baseTs += 120;
    }

    const killTimes = [4200, 8400, 11500];
    for (let i = 0; i < killTimes.length; i++) {
      const base = killTimes[i] + matchIndex * 900;
      synthetic.push({
        userId: `human-${matchIndex}-1`,
        matchId,
        mapId,
        date,
        x: 180 + i * 30,
        y: 0,
        z: 180 + i * 20,
        tsMs: base,
        event: i % 2 === 0 ? "Kill" : "Loot",
        isBot: false,
      });
      synthetic.push({
        userId: `bot-${matchIndex}-1`,
        matchId,
        mapId,
        date,
        x: 200 + i * 25,
        y: 0,
        z: 220 + i * 15,
        tsMs: base + 180,
        event: i % 2 === 0 ? "BotKilled" : "KilledByStorm",
        isBot: true,
      });
    }
  }

  return normalizeMatchTimes(
    synthetic.filter((event) => eventTypes.includes(event.event)),
  );
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
            date,
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
        const x = Number(record.x);
        const y = Number(record.y);
        const z = Number(record.z);
        if (![x, y, z].every(Number.isFinite))
          throw new Error("Invalid event coordinate");
        return {
          userId: String(record.user_id ?? ""),
          matchId: String(record.match_id ?? ""),
          mapId: parseMapId(record.map_id),
          date: String(record.date ?? "").trim(),
          x,
          y,
          z,
          tsMs: parseTimestampMs(record.ts),
          event: parseEventType(record.event),
          isBot: Boolean(record.is_bot),
        } satisfies GameEvent;
      });

      if (rows.length === 0)
        throw new Error("events.parquet contains no event rows");
      if (
        rows.some((event) => !event.userId || !event.matchId || !event.date)
      ) {
        throw new Error(
          "events.parquet contains rows missing user, match, or date metadata",
        );
      }
      return normalizeMatchTimes(rows);
    } finally {
      await conn.close();
    }
  } catch (error) {
    console.warn("Falling back to synthetic demo events:", error);
    return generateSyntheticEvents();
  }
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
