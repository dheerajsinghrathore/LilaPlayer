# LILA Player Journey Visualization

Starter implementation for the LILA Product Engineer written test.

## Stack

- React + TypeScript + Vite
- DuckDB-WASM for Parquet querying in the browser
- Canvas for high-volume journey rendering
- Zustand for viewer state
- Vercel for deployment

## Data preparation

The supplied assignment data contains 1,243 Parquet files with a `.nakama-0` extension. Keep the raw dataset outside the Git repository if desired, then run:

```bash
pip install pyarrow
python scripts/prepare_data.py /path/to/player_data
```

This creates `public/data/events.parquet`.

## Run

```bash
npm install
npm run dev
```

## Current implementation

The starter includes the map configuration, coordinate transformation, Canvas journey renderer, event markers, filters, and playback timeline shell. The next step is wiring the DuckDB query layer to `events.parquet`, then adding heatmap aggregation and match-level insights.

## Coordinate mapping

The mapping follows the supplied README exactly:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

The data's `y` coordinate is elevation and is not used for the 2D minimap.
