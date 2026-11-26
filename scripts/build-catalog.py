"""Convert a filtered Geofabrik OSM GeoJSON export to a small, attributed catalog."""
import datetime as dt
import json
import math
import pathlib
import sys

def positions(value):
    if isinstance(value, list):
        if len(value) >= 2 and isinstance(value[0], (int, float)) and isinstance(value[1], (int, float)):
            yield value[0], value[1]
        else:
            for child in value:
                yield from positions(child)

def convert(features):
    entries = {}
    for feature in features:
        tags = feature.get("properties") or {}
        if tags.get("amenity") != "pharmacy":
            continue
        kind, ident = tags.get("@type"), tags.get("@id")
        if kind not in ("node", "way", "relation") or not isinstance(ident, int):
            continue
        points = [(x, y) for x, y in positions((feature.get("geometry") or {}).get("coordinates")) if math.isfinite(x) and math.isfinite(y)]
        if not points:
            continue
        lon = (min(x for x, _ in points) + max(x for x, _ in points)) / 2
        lat = (min(y for _, y in points) + max(y for _, y in points)) / 2
        if not 59 <= lat <= 71 or not 19 <= lon <= 33:
            continue
        keep = {k: v for k, v in tags.items() if k in ("amenity", "name", "addr:street", "addr:housenumber", "addr:city", "opening_hours") and isinstance(v, str)}
        entries[(kind, ident)] = {"type": kind, "id": ident, "lat": round(lat, 6), "lon": round(lon, 6), "tags": keep}
    return [entries[k] for k in sorted(entries)]

def main():
    input_path, output_path, source_date = sys.argv[1:]
    dt.datetime.fromisoformat(source_date.replace("Z", "+00:00"))
    features = json.loads(pathlib.Path(input_path).read_text())["features"]
    entries = convert(features)
    # Reject obviously truncated nationwide imports; this is not proof of completeness.
    if not 300 <= len(entries) <= 3000:
        raise ValueError(f"Unexpected Finland catalog size: {len(entries)}")
    for city, lat, lon in [("Turku", 60.4518, 22.2666), ("Helsinki", 60.1699, 24.9384), ("Tampere", 61.4978, 23.761), ("Oulu", 65.0121, 25.4651), ("Vaasa", 63.0951, 21.6165)]:
        nearby = [e for e in entries if abs(e["lat"]-lat) < .08 and abs(e["lon"]-lon) < .15]
        if not nearby:
            raise ValueError(f"No entries near {city}")
        print(f"{city}: {len(nearby)} nearby mapped objects")
    catalog = {"schema": 1, "region": "FI", "source": "OpenStreetMap contributors / Geofabrik", "license": "ODbL-1.0", "sourceDate": source_date, "elements": entries}
    out = pathlib.Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Catalog: {len(entries)} entries, {out.stat().st_size} bytes, source {source_date}")

if __name__ == "__main__":
    main()
