# LilaPlayer

LilaPlayer is a browser-based match replay and journey explorer for LILA game events. It visualizes player movement, event markers, filters, and heatmap overlays on a minimap so you can inspect how a match unfolds over time.

Live demo: add your Vercel URL here after deployment.

## Features

- Player path replay for individual matches and selected time ranges
- Map-aware minimap rendering with world-to-pixel coordinate projection
- Event markers for kills, deaths, loot, storm zones, and more
- Filters for map, date, match, and player class
- Heatmap overlays for high-traffic and danger zones
- Playback controls with adjustable speed and timeline scrubber
- In-browser querying using DuckDB-WASM over compressed parquet data

## Tech stack

- React + TypeScript + Vite
- Zustand for UI state
- DuckDB-WASM for parquet-based data access
- Canvas rendering for performance-critical map visuals
- Vercel-ready static hosting

## Project structure

```text
src/
  App.tsx
  components/MapViewer.tsx
  data/maps.ts
  lib/duckdb.ts
  store.ts
  types/game.ts
public/
  data/
  maps/
scripts/
  prepare_data.py
```

## Quick start

```bash
npm install
npm run dev
```

The app runs locally on the Vite dev server at the default port.

## Data preparation

The project expects a prepared parquet dataset at `public/data/events.parquet`.

If you have the raw LILA `.nakama-0` files, generate the normalized dataset with:

```bash
pip install pyarrow
python scripts/prepare_data.py /path/to/player_data
```

This script merges the source parquet files into the app-ready dataset used by the viewer.

## Playback and map rendering

The viewer follows the supplied coordinate mapping contract for map projection:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

The `y` field is elevation and is intentionally ignored in the 2D minimap render.

## Deployment

This app is configured for static hosting on Vercel.

1. Push this repo to GitHub.
2. Import the repository into Vercel.
3. Use the default Vite settings.
4. Deploy and copy the generated public URL into this README.

See [README-deploy.md](README-deploy.md) for Vercel-specific instructions.

## Notes

This project is intended as a polished viewer demo and can run with either real parquet data or a synthetic fallback dataset when an upstream source is not present.
