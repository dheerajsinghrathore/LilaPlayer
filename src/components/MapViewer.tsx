import { useEffect, useRef } from 'react';
import type { GameEvent, HeatmapMode } from '../types/game';
import { MAPS, worldToPixel } from '../data/maps';
import { getHeatmapColor } from '../lib/duckdb';

interface Props {
  mapId: string;
  events: GameEvent[];
  currentTimeMs: number;
  heatmap: HeatmapMode | 'none';
}

export function MapViewer({ mapId, events, currentTimeMs, heatmap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const effectiveMapId = mapId === 'all' ? (events[0]?.mapId ?? 'AmbroseValley') : mapId;

  useEffect(() => {
    const imagePath = MAPS[effectiveMapId]?.image ?? MAPS.AmbroseValley.image;
    const img = new Image();
    img.src = imagePath;
    img.onload = () => {
      imageRef.current = img;
      draw();
    };

    function draw() {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 1024;
      canvas.height = 1024;
      ctx.drawImage(image, 0, 0, 1024, 1024);

      const visible = events.filter((e) => e.tsMs <= currentTimeMs);
      if (heatmap !== 'none') {
        const heatmapSource = visible.filter((event) => {
          if (heatmap === 'traffic') return event.event === 'Position' || event.event === 'BotPosition';
          if (heatmap === 'kills') return event.event === 'Kill' || event.event === 'BotKill';
          if (heatmap === 'deaths') return event.event === 'Killed' || event.event === 'BotKilled';
          if (heatmap === 'storm') return event.event === 'KilledByStorm';
          return false;
        });

        const density = new Map<string, number>();
        for (const event of heatmapSource) {
          const pixel = worldToPixel(event.x, event.z, effectiveMapId);
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

      const byPlayer = new Map<string, GameEvent[]>();
      for (const event of visible) {
        if (event.event !== 'Position' && event.event !== 'BotPosition') continue;
        const list = byPlayer.get(event.userId) ?? [];
        list.push(event);
        byPlayer.set(event.userId, list);
      }

      for (const [, path] of byPlayer) {
        ctx.beginPath();
        path.sort((a, b) => a.tsMs - b.tsMs);
        path.forEach((point, index) => {
          const p = worldToPixel(point.x, point.z, effectiveMapId);
          if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        const bot = path[0]?.isBot;
        ctx.strokeStyle = bot ? 'rgba(250, 204, 21, .65)' : 'rgba(56, 189, 248, .7)';
        ctx.lineWidth = bot ? 1 : 1.5;
        if (bot) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const marker = (e: GameEvent, color: string) => {
        const p = worldToPixel(e.x, e.z, effectiveMapId);
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      };
      for (const e of visible) {
        if (e.event === 'Kill' || e.event === 'BotKill') marker(e, '#ef4444');
        if (e.event === 'Killed' || e.event === 'BotKilled') marker(e, '#f8fafc');
        if (e.event === 'Loot') marker(e, '#f59e0b');
        if (e.event === 'KilledByStorm') marker(e, '#a855f7');
      }
    }

    draw();
  }, [effectiveMapId, events, heatmap, currentTimeMs]);

  return <div className="map-shell"><canvas ref={canvasRef} /></div>;
}
