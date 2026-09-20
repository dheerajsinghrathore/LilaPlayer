import type { MapConfig, MapId } from '../types/game';

export const MAPS: Record<MapId, MapConfig> = {
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

export function worldToPixel(x: number, z: number, mapId: MapId) {
  const map = MAPS[mapId];
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  return { x: u * 1024, y: (1 - v) * 1024 };
}

export function isPixelOnMap({ x, y }: { x: number; y: number }) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1024 && y >= 0 && y <= 1024;
}
