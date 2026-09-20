import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent, HeatmapMode, MapId } from '../types/game';
import { MAPS, isPixelOnMap, worldToPixel } from '../data/maps';
import { getHeatmapColor } from '../lib/duckdb';

interface Props {
  mapId: MapId;
  events: GameEvent[];
  currentTimeMs: number;
  heatmap: HeatmapMode | 'none';
}

export function MapViewer({ mapId, events, currentTimeMs, heatmap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const paths = useMemo(() => {
    const byPlayer = new Map<string, GameEvent[]>();
    for (const event of events) {
      if (event.event !== 'Position' && event.event !== 'BotPosition') continue;
      const list = byPlayer.get(event.userId) ?? [];
      list.push(event);
      byPlayer.set(event.userId, list);
    }
    return [...byPlayer.values()].map((path) => [...path].sort((a, b) => a.tsMs - b.tsMs));
  }, [events]);

  useEffect(() => {
    const img = new Image();
    let cancelled = false;
    setImage(null);
    setImageError(false);
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImageError(true);
    };
    img.src = MAPS[mapId].image;
    return () => { cancelled = true; };
  }, [mapId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 1024;
    canvas.height = 1024;
    ctx.drawImage(image, 0, 0, 1024, 1024);

    const visible = events.filter((event) => event.tsMs <= currentTimeMs);
    if (heatmap !== 'none') {
      const heatmapSource = visible.filter((event) => {
        if (heatmap === 'traffic') return event.event === 'Position' || event.event === 'BotPosition';
        if (heatmap === 'kills') return event.event === 'Kill' || event.event === 'BotKill';
        if (heatmap === 'deaths') return event.event === 'Killed' || event.event === 'BotKilled';
        return event.event === 'KilledByStorm';
      });

      const density = new Map<string, number>();
      for (const event of heatmapSource) {
        const pixel = worldToPixel(event.x, event.z, mapId);
        if (!isPixelOnMap(pixel)) continue;
        const cellX = Math.floor(pixel.x / 24);
        const cellY = Math.floor(pixel.y / 24);
        const key = `${cellX}:${cellY}`;
        density.set(key, (density.get(key) ?? 0) + 1);
      }

      for (const [key, weight] of density.entries()) {
        const [cellX, cellY] = key.split(':').map(Number);
        const pixelX = cellX * 24 + 12;
        const pixelY = cellY * 24 + 12;
        const radius = 8 + Math.min(24, weight * 6);
        const gradient = ctx.createRadialGradient(pixelX, pixelY, 4, pixelX, pixelY, radius);
        gradient.addColorStop(0, getHeatmapColor(heatmap));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const path of paths) {
      ctx.beginPath();
      let points = 0;
      for (const point of path) {
        if (point.tsMs > currentTimeMs) break;
        const pixel = worldToPixel(point.x, point.z, mapId);
        if (!isPixelOnMap(pixel)) continue;
        if (points++ === 0) ctx.moveTo(pixel.x, pixel.y); else ctx.lineTo(pixel.x, pixel.y);
      }
      const bot = path[0]?.isBot;
      ctx.strokeStyle = bot ? 'rgba(250, 204, 21, .65)' : 'rgba(56, 189, 248, .7)';
      ctx.lineWidth = bot ? 1 : 1.5;
      ctx.setLineDash(bot ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const event of visible) {
      const pixel = worldToPixel(event.x, event.z, mapId);
      if (!isPixelOnMap(pixel)) continue;
      drawMarker(ctx, event, pixel);
    }
  }, [currentTimeMs, events, heatmap, image, mapId, paths]);

  if (imageError) return <div className="map-shell map-message">Unable to load the selected minimap.</div>;

  return <div className="map-shell"><canvas ref={canvasRef} /></div>;
}

function drawMarker(ctx: CanvasRenderingContext2D, event: GameEvent, point: { x: number; y: number }) {
  ctx.fillStyle = event.event === 'Loot' ? '#f59e0b' : event.event === 'KilledByStorm' ? '#a855f7' : '#ef4444';
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (event.event === 'Kill' || event.event === 'BotKill') {
    ctx.moveTo(point.x, point.y - 6); ctx.lineTo(point.x + 6, point.y + 5); ctx.lineTo(point.x - 6, point.y + 5);
    ctx.closePath(); ctx.fill();
  } else if (event.event === 'Killed' || event.event === 'BotKilled') {
    ctx.strokeStyle = '#f8fafc'; ctx.moveTo(point.x - 5, point.y - 5); ctx.lineTo(point.x + 5, point.y + 5);
    ctx.moveTo(point.x + 5, point.y - 5); ctx.lineTo(point.x - 5, point.y + 5); ctx.stroke();
  } else if (event.event === 'Loot') {
    ctx.moveTo(point.x, point.y - 6); ctx.lineTo(point.x + 6, point.y); ctx.lineTo(point.x, point.y + 6); ctx.lineTo(point.x - 6, point.y);
    ctx.closePath(); ctx.fill();
  } else if (event.event === 'KilledByStorm') {
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
  }
}
