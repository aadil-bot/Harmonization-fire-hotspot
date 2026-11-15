"""Build compact daily-by-province calendar data from fire_cells_daily.csv.

Usage:
  python tools/build_province_daily.py <fire_cells_daily.csv>

The generated file is used for genuine province/territory month and week
drill-downs. It stores daily sums as [harmonized, MODIS-only, VIIRS-only].
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BOUNDARY_DIR = ROOT / "data" / "canada" / "provinces"
CALIBRATION_FILE = ROOT / "data" / "calibration_factors.csv"
OUTPUT_FILE = ROOT / "data" / "canada" / "province_daily.js"
BUCKET_SIZE = 0.5

REGIONS = {
    "48": "alberta", "59": "british-columbia", "46": "manitoba",
    "13": "new-brunswick", "10": "newfoundland-and-labrador",
    "61": "northwest-territories", "12": "nova-scotia", "62": "nunavut",
    "35": "ontario", "11": "prince-edward-island", "24": "quebec",
    "47": "saskatchewan", "60": "yukon",
}


def load_feature(path: Path) -> dict:
    source = path.read_text(encoding="utf-8")
    match = re.search(r'=\s*(\{"type":"Feature".*\});?\s*$', source)
    if not match:
        raise ValueError(f"Could not parse province boundary: {path}")
    return json.loads(match.group(1))


def normalize_ring(ring: list) -> list:
    """Flatten the occasional extra array layer in generalized island rings."""
    points = []
    for item in ring:
        if isinstance(item, list) and len(item) >= 2 and isinstance(item[0], (int, float)) and isinstance(item[1], (int, float)):
            points.append(item[:2])
        elif isinstance(item, list):
            points.extend(normalize_ring(item))
    return points


def build_spatial_index():
    buckets = defaultdict(list)
    for code, region in REGIONS.items():
        feature = load_feature(BOUNDARY_DIR / f"{region}.js")
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for rings in polygons:
            rings = [normalize_ring(ring) for ring in rings]
            outer = rings[0]
            if not outer:
                continue
            xs = [point[0] for point in outer]
            ys = [point[1] for point in outer]
            bounds = (min(xs), min(ys), max(xs), max(ys))
            polygon = (region, bounds, rings)
            for x in range(int(bounds[0] // BUCKET_SIZE), int(bounds[2] // BUCKET_SIZE) + 1):
                for y in range(int(bounds[1] // BUCKET_SIZE), int(bounds[3] // BUCKET_SIZE) + 1):
                    buckets[(x, y)].append(polygon)
    return buckets


def point_in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def containing_region(index, lon: float, lat: float):
    candidates = index.get((int(lon // BUCKET_SIZE), int(lat // BUCKET_SIZE)), ())
    for region, bounds, rings in candidates:
        min_lon, min_lat, max_lon, max_lat = bounds
        if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
            continue
        if point_in_ring(lon, lat, rings[0]) and not any(point_in_ring(lon, lat, hole) for hole in rings[1:]):
            return region
    return None


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Pass the path to fire_cells_daily.csv")
    input_file = Path(sys.argv[1])
    index = build_spatial_index()
    factors = {}
    with CALIBRATION_FILE.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            factors[int(row["month"])] = float(row["k_shrunk"])

    point_regions = {}
    daily = defaultdict(lambda: [0.0, 0.0, 0.0])
    assigned = 0
    unmatched = 0
    first_date = None
    last_date = None
    with input_file.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            date = row["date"]
            first_date = min(first_date, date) if first_date else date
            last_date = max(last_date, date) if last_date else date
            lat, lon = float(row["lat"]), float(row["lon"])
            point = (lon, lat)
            if point not in point_regions:
                point_regions[point] = containing_region(index, lon, lat)
            region = point_regions[point]
            if region is None:
                unmatched += 1
                continue
            assigned += 1
            weight = float(row["weight"] or 0)
            source = row["source"].upper()
            values = daily[(region, date)]
            values[0] += weight
            if "MODIS" in source:
                values[1] += weight / factors[int(date[5:7])]
            elif "VIIRS" in source:
                values[2] += weight

    result = {region: {} for region in REGIONS.values()}
    for (region, date), values in sorted(daily.items()):
        result[region][date] = [round(value, 4) for value in values]
    metadata = {"start": first_date, "end": last_date}
    OUTPUT_FILE.write_text(
        "window.MOSAIC_PROVINCE_DAILY_META=" + json.dumps(metadata, separators=(",", ":")) + ";\n"
        + "window.MOSAIC_PROVINCE_DAILY=" + json.dumps(result, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size:,} bytes)")
    print(f"Assigned rows: {assigned:,}; outside province/territory boundaries: {unmatched:,}")
    print(f"Unique fire-cell locations indexed: {len(point_regions):,}")


if __name__ == "__main__":
    main()
