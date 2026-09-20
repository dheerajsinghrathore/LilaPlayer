"""Merge the supplied .nakama-0 Parquet files into one browser-friendly Parquet file.

Run from the project root after installing pyarrow:
  pip install pyarrow
  python scripts/prepare_data.py /path/to/player_data

The source README says each .nakama-0 file is valid Apache Parquet and the event
column is bytes. This script normalizes that column and adds is_bot.
"""
from pathlib import Path
import sys
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "./player_data")
OUT = Path("./public/data/events.parquet")
REQUIRED_COLUMNS = {"user_id", "match_id", "map_id", "x", "y", "z", "ts", "event"}
VALID_MAPS = {"AmbroseValley", "GrandRift", "Lockdown"}
VALID_EVENTS = {
    "Position", "BotPosition", "Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"
}


def source_date(path: Path) -> str:
    """Read the assignment's date partition (for example, February_10)."""
    try:
        relative_parts = path.relative_to(ROOT).parts
    except ValueError as error:
        raise ValueError(f"{path} is outside source root {ROOT}") from error
    if len(relative_parts) < 2 or not relative_parts[0].startswith("February_"):
        raise ValueError(f"{path}: expected a February_<day>/ filename layout")
    return relative_parts[0]


def decode_event(value):
    value = value.as_py() if hasattr(value, "as_py") else value
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8")
    return str(value).strip()


def validate_table(table: pa.Table, path: Path) -> None:
    missing = REQUIRED_COLUMNS - set(table.column_names)
    if missing:
        raise ValueError(f"{path}: missing required columns: {', '.join(sorted(missing))}")
    maps = set(table.column("map_id").to_pylist())
    unknown_maps = maps - VALID_MAPS
    if unknown_maps:
        raise ValueError(f"{path}: unsupported map IDs: {', '.join(map(str, sorted(unknown_maps)))}")
    events = {decode_event(value) for value in table.column("event")}
    unknown_events = events - VALID_EVENTS
    if unknown_events:
        raise ValueError(f"{path}: unsupported event types: {', '.join(sorted(unknown_events))}")

files = sorted(p for p in ROOT.rglob("*.nakama-0") if p.is_file())
if not files:
    raise SystemExit(f"No .nakama-0 files found under {ROOT}")

writer = None
row_count = 0
files_by_date = {}
events_by_type = {}
try:
    for i, path in enumerate(files, 1):
        table = pq.read_table(path)
        validate_table(table, path)
        date = source_date(path)
        event_col = table.column("event")
        decoded = [decode_event(value) for value in event_col]
        table = table.set_column(table.schema.get_field_index("event"), "event", pa.array(decoded, type=pa.string()))
        user_ids = table.column("user_id").to_pylist()
        table = table.append_column("is_bot", pa.array([str(u).isdigit() for u in user_ids]))
        table = table.append_column("date", pa.array([date] * len(table), type=pa.string()))
        if writer is None:
            OUT.parent.mkdir(parents=True, exist_ok=True)
            writer = pq.ParquetWriter(OUT, table.schema, compression="zstd")
        writer.write_table(table)
        row_count += len(table)
        files_by_date[date] = files_by_date.get(date, 0) + 1
        for event in decoded:
            events_by_type[event] = events_by_type.get(event, 0) + 1
        if i % 100 == 0:
            print(f"Processed {i}/{len(files)} files")
finally:
    if writer:
        writer.close()
print(f"Wrote {OUT}: {row_count} rows from {len(files)} files")
print("Files by date:", ", ".join(f"{date}={count}" for date, count in sorted(files_by_date.items())))
print("Events by type:", ", ".join(f"{event}={count}" for event, count in sorted(events_by_type.items())))
