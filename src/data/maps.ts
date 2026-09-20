import type { MapConfig } from '../types/game';

export const MAPS: Record<string, MapConfig> = {
  AmbroseValley: {
    scale: 900,
    originX: -370,
    originZ: -473,
    image: '/maps/AmbroseValley_Minimap.png'
  },
  GrandRift: {
    scale: 581,
    originX: -290,
    originZ: -290,
    image: '/maps/GrandRift_Minimap.png'
  },
  Lockdown: {
    scale: 1000,
    originX: -500,
    originZ: -500,
    image: '/maps/Lockdown_Minimap.jpg'
  }
};

export function worldToPixel(x: number, z: number, mapId: string) {
  const map = MAPS[mapId];
  if (!map) return { x: 512, y: 512 };
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  return { x: u * 1024, y: (1 - v) * 1024 };
}
