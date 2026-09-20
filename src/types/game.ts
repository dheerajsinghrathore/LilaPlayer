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

export interface GameEvent {
  userId: string;
  matchId: string;
  mapId: string;
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
