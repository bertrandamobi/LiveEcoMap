# LiveEcoMap

LiveEcoMap is a web-based GIS application for visualizing environmental conditions in near real time. It combines weather and air quality signals, returns standardized GeoJSON from the backend, and renders interactive map layers in a modern Leaflet frontend suitable for both local development and GitHub Pages demos.

<a href="https://bertrandamobi.github.io/LiveEcoMap/">
  <img src="/images/app-image.png" width="100%" />
</a>

---

🔗 **[Live Demo](https://bertrandamobi.github.io/LiveEcoMap/)**

---

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [How Data Flows Through the System](#how-data-flows-through-the-system)
- [Backend API Reference](#backend-api-reference)
  - [`GET /health`](#get-health)
  - [`GET /api/environment`](#get-apienvironment)
- [Frontend Features and UX](#frontend-features-and-ux)
- [Exports](#exports)
- [GitHub Pages Deployment Notes](#github-pages-deployment-notes)
- [Local Development](#local-development)
  - [1) Python environment](#1-python-environment)
  - [2) Run backend](#2-run-backend)
  - [3) Run frontend](#3-run-frontend)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Roadmap / Suggested Next Improvements](#roadmap--suggested-next-improvements)
- [License](#license)

---

## Overview

LiveEcoMap helps users explore environmental patterns through an interactive map interface:

- **Air quality** (PM2.5 when available).
- **Temperature** (°C).
- **Rainfall / precipitation** (mm).

Users can zoom and pan, filter by selected parameters and datetime, click a location for details, animate temporal playback, and export current data for external analysis.

---

## Core Capabilities

1. **Near real-time environmental fetch** from public APIs.
2. **GeoJSON FeatureCollection output** from backend, ready for GIS pipelines.
3. **Interactive map visualization** with styled markers and detail popups.
4. **Multi-parameter analysis** via checkbox selection.
5. **Time-aware filtering** using a datetime selector.
6. **Animated demo mode** cycling recent time windows.
7. **Export support** for both CSV and GeoJSON.
8. **Graceful fallback mode** on frontend if backend is unavailable (ideal for static hosting demos).

---

## Architecture

LiveEcoMap is intentionally lightweight and split into two layers:

- **Backend (`FastAPI`)**
  - Aggregates data from Open-Meteo and OpenAQ.
  - Normalizes response as GeoJSON.
  - Supports parameter filtering and datetime input.

- **Frontend (`Leaflet + Vanilla JS`)**
  - Requests backend data.
  - Renders map markers and popups.
  - Provides UI controls for filtering, animation, and export.
  - Falls back to synthetic demo data when API is unreachable.

---

## Technology Stack

### Backend
- Python 3.x
- FastAPI
- Uvicorn
- HTTPX

### Frontend
- Leaflet.js
- Vanilla JavaScript
- HTML/CSS

### Data Interchange
- GeoJSON (FeatureCollection)
- CSV export for tabular workflows

---

## Project Structure

```text
LiveEcoMap/
├── .gitignore
├── .gitkeep
├── LICENSE
├── README.md
├── app.js
├── backend/
│   └── main.py
├── docs/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── images/
│   └── app-image.png
├── index.html
├── requirements.txt
└── styles.css
```

---

## How Data Flows Through the System

1. User opens UI and selects data parameters/date.
2. Frontend requests `GET /api/environment` with query params.
3. Backend fetches weather and AQ data for configured city coordinates.
4. Backend transforms external payloads into a single GeoJSON `FeatureCollection`.
5. Frontend renders map markers and detail popups.
6. User optionally exports current in-memory dataset as CSV or GeoJSON.

---

## Backend API Reference

### `GET /health`
Simple readiness endpoint.

**Response**
```json
{ "status": "ok" }
```

---

### `GET /api/environment`
Returns environmental observations as a GeoJSON FeatureCollection.

#### Query Parameters

- `data_types` (repeatable list)
  - Allowed values: `temperature`, `rainfall`, `air_quality`
  - Example: `?data_types=temperature&data_types=air_quality`
- `date` (optional ISO timestamp)
  - Example: `2026-05-11T08:00:00Z`

If `date` is omitted, backend uses current UTC time.

#### Example Request

```bash
curl "http://localhost:8000/api/environment?data_types=temperature&data_types=rainfall&date=2026-05-11T08:00:00Z"
```

#### Example Response (abbreviated)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-74.006, 40.7128] },
      "properties": {
        "city": "New York",
        "timestamp": "2026-05-11T08:00:00Z",
        "temperature_c": 17.1,
        "rainfall_mm": 0.2,
        "pm25": 11.0,
        "aqi_hint": "Good"
      }
    }
  ],
  "metadata": {
    "requested_data_types": ["temperature", "rainfall"],
    "requested_date": "2026-05-11T08:00:00Z",
    "generated_at": "2026-05-11T08:00:02Z"
  }
}
```

---

## Frontend Features and UX

- **Interactive map navigation** (zoom/pan).
- **Parameter toggles** for temperature, rainfall, and AQ.
- **Datetime selector** for retrieving data at a target time.
- **Detailed popups** on location markers.
- **Animated demo mode** for rapid temporal playback.
- **Fallback simulation mode** when API calls fail (useful on GitHub Pages without hosted backend).

---

## Exports

The frontend exports whatever dataset is currently rendered:

- **CSV**: convenient for spreadsheets and quick analytics.
- **GeoJSON**: convenient for GIS tools, notebooks, or downstream map pipelines.

---

## GitHub Pages Deployment Notes

Because GitHub Pages hosts static assets only:

- The frontend will load and render from root (`index.html`) or `/docs` (if configured that way).
- Live backend calls require a separately hosted API URL.
- If API is unreachable, the app automatically falls back to demo synthetic data for a working visual experience.

To point to a hosted API, set a global variable before loading `app.js`, for example:

```html
<script>
  window.LIVEECOMAP_API_BASE = "https://your-api-host.example.com";
</script>
<script src="app.js"></script>
```

---

## Local Development

### 1) Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Run backend

```bash
uvicorn backend.main:app --reload --port 8000
```

API docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 3) Run frontend

Option A: open `index.html` directly.

Option B (recommended): run a static server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

---

## Configuration

### Environment Variables

- `OPENAQ_API_KEY` (optional)
  - Used by backend when available for more reliable OpenAQ access.

---

## Troubleshooting

### Map loads but no live API data

- Ensure backend is running at `http://localhost:8000`.
- Check browser devtools for CORS/network errors.
- Verify firewall/proxy settings.
- Confirm OpenAQ/Open-Meteo endpoints are reachable from your network.

### GitHub Pages shows demo data only

This is expected if you did not deploy a backend. Configure `window.LIVEECOMAP_API_BASE` to your hosted API.

### Export buttons do nothing

Exports require a loaded dataset. Click **Refresh** or run **Animated Demo** first.

---

## Roadmap

- Add user-drawn AOI polygon queries.
- Add choropleth layers (e.g., county/state aggregation).
- Add historical caching in backend for time-range playback.
- Add websocket streaming for true push-based updates.
- Add test suite (backend unit tests + frontend smoke tests).
- Add Docker compose and one-command deployment.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
