import type { EventType, GameEvent, MapId } from '../types/game';

const EVENT_TYPES = new Set<EventType>([
  'Position', 'BotPosition', 'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'
]);

const MAP_IDS = new Set<MapId>(['AmbroseValley', 'GrandRift', 'Lockdown']);

export function parseEventType(value: unknown): EventType {
  const event = String(value ?? '').trim();
  if (!EVENT_TYPES.has(event as EventType)) {
    throw new Error(`Unsupported event type: ${event || '(empty)'}`);
  }
  return event as EventType;
}

export function parseMapId(value: unknown): MapId {
  const mapId = String(value ?? '').trim();
  if (!MAP_IDS.has(mapId as MapId)) {
    throw new Error(`Unsupported map ID: ${mapId || '(empty)'}`);
  }
  return mapId as MapId;
}

export function parseTimestampMs(value: unknown): number {
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number.isFinite(Number(value)) ? Number(value) : Date.parse(value)
          : Number.NaN;

  if (!Number.isFinite(timestamp)) throw new Error('Invalid event timestamp');
  return timestamp;
}

/** Convert the source timestamp representation into elapsed time for each match. */
export function normalizeMatchTimes(events: GameEvent[]): GameEvent[] {
  const starts = new Map<string, number>();
  for (const event of events) {
    const start = starts.get(event.matchId);
    if (start === undefined || event.tsMs < start) starts.set(event.matchId, event.tsMs);
  }
  return events.map((event) => ({ ...event, tsMs: event.tsMs - (starts.get(event.matchId) ?? event.tsMs) }));
}
