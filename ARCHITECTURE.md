# Architecture

## Stack

React + TypeScript + Vite provides a fast browser application; DuckDB-WASM is used to query Parquet directly in the browser; Canvas is used for dense movement paths and event markers; Zustand keeps filters and playback state small and explicit.

## Data flow

```text
Provided .nakama-0 Parquet files
        -> prepare_data.py
        -> one normalized events.parquet
        -> DuckDB-WASM
        -> filtered query
        -> domain events
        -> coordinate transform
        -> Canvas + controls
```

## Coordinate mapping

The supplied README defines a 1024x1024 minimap for each map. For a world `(x,z)` coordinate:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

`y` is elevation and is intentionally excluded from the 2D projection.

## Bot detection

The supplied README defines UUID user IDs as humans and short numeric IDs as bots. The preparation step materializes this as `is_bot`.

## Trade-offs

| Choice | Alternative | Reason |
|---|---|---|
| DuckDB-WASM | Custom API | Avoids a backend for a read-only assignment |
| Canvas | SVG | Better for many journey points |
| One prepared Parquet | 1,243 browser files | Avoids excessive network requests and parsing overhead |
| Zustand | Global Redux store | Smaller state surface for this tool |
