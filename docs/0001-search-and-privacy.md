# ADR 0001: bounded geospatial search with data minimization

Status: accepted for the exercise; production validation pending.

## Context
The application must find pharmacies without requiring registration. The service should handle denial of location permission and unreliable networks. The search must not need a secret embedded in a client.

## Decision
Use Overpass `amenity=pharmacy` node/way/relation results, normalize and rank by Haversine distance against the original device position. Search around a coordinate rounded to two decimals with 3, 10 and 30 km radii. Stop when the closest result is inside the search circle after subtracting the centre offset; otherwise continue. This is a geometric coverage heuristic for mapped representative points, not a guarantee of data completeness. No persistent location history. No retry storms; bound requests and allow cancellation. Explicit fallback to city centres. No medical or opening-hours recommendations.

## Alternatives
Apple MapKit search alone is convenient but would make results inconsistent across platforms. Proprietary Places providers need credentials and contractual review. A prebuilt Finland-only dataset is robust offline but adds refresh and distribution obligations. A commercial or self-hosted EU service is preferred for production after legal, performance and data coverage assessment.

## Consequences
Simple architecture and no keys, but third-party availability and map accuracy are limitations. Rounding reduces precision shared externally but is not anonymization. Distances are estimates; users should verify opening hours and travel routes. Provider IP logging and retention have not been independently audited.

## Optional map and hours
The explicit map preview embeds OpenStreetMap with the selected pharmacy coordinates only; the map provider receives normal network metadata. The list remains available if the map fails. OSM opening_hours strings are community-maintained, displayed without an open-now inference and must be checked against the pharmacy or the Finnish Pharmacy Association directory.

## Provider resilience
The browser tries FOSSGIS Overpass first and Private.coffee once on a transient transport failure, selected 5xx responses or incomplete data. Both receive the same rounded query location only. 403/429 are not retried against another provider. No fabricated results and no background requests. Public endpoints are best-effort, not an SLA.
