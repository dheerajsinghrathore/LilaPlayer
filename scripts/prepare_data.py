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

files = sorted(p for p in ROOT.rglob("*.nakama-0") if p.is_file())
if not files:
    raise SystemExit(f"No .nakama-0 files found under {ROOT}")

writer = None
try:
    for i, path in enumerate(files, 1):
        table = pq.read_table(path)
        event_col = table.column("event")
        decoded = [x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else x.as_py() for x in event_col]
        table = table.set_column(table.schema.get_field_index("event"), "event", pa.array(decoded, type=pa.string()))
        user_ids = table.column("user_id").to_pylist()
        table = table.append_column("is_bot", pa.array([str(u).isdigit() for u in user_ids]))
        if writer is None:
            OUT.parent.mkdir(parents=True, exist_ok=True)
            writer = pq.ParquetWriter(OUT, table.schema, compression="zstd")
        writer.write_table(table)
        if i % 100 == 0:
            print(f"Processed {i}/{len(files)} files")
finally:
    if writer:
        writer.close()
print(f"Wrote {OUT}")
