export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot';

export type HeatmapMode = 'traffic' | 'kills' | 'deaths' | 'storm';

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export interface GameEvent {
  userId: string;
  matchId: string;
  mapId: MapId;
  date: string;
  x: number;
  y: number;
  z: number;
  tsMs: number;
  event: EventType;
  isBot: boolean;
}

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
}
