from datetime import datetime, timedelta, timezone
from typing import Any
import os

import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LiveEcoMap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CITIES = [
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437},
    {"name": "Chicago", "lat": 41.8781, "lon": -87.6298},
    {"name": "Houston", "lat": 29.7604, "lon": -95.3698},
    {"name": "Phoenix", "lat": 33.4484, "lon": -112.0740},
    {"name": "Seattle", "lat": 47.6062, "lon": -122.3321},
]


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


async def fetch_weather(client: httpx.AsyncClient, lat: float, lon: float, date: datetime) -> dict[str, Any]:
    start = date.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation",
        "start_date": start.date().isoformat(),
        "end_date": end.date().isoformat(),
        "timezone": "UTC",
    }
    resp = await client.get(url, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json().get("hourly", {})

    times = data.get("time", [])
    temps = data.get("temperature_2m", [])
    rains = data.get("precipitation", [])

    target_hour = start.strftime("%Y-%m-%dT%H:00")
    idx = times.index(target_hour) if target_hour in times else (0 if times else -1)

    return {
        "temperature_c": temps[idx] if idx >= 0 and idx < len(temps) else None,
        "rainfall_mm": rains[idx] if idx >= 0 and idx < len(rains) else None,
    }


async def fetch_air_quality(client: httpx.AsyncClient, lat: float, lon: float, date: datetime) -> dict[str, Any]:
    # OpenAQ v3 latest endpoint around coordinates.
    url = "https://api.openaq.org/v3/locations"
    headers = {}
    if os.getenv("OPENAQ_API_KEY"):
        headers["X-API-Key"] = os.getenv("OPENAQ_API_KEY")
    params = {
        "coordinates": f"{lat},{lon}",
        "radius": 25000,
        "limit": 1,
        "sort": "desc",
        "order_by": "datetimeLast",
    }

    try:
        resp = await client.get(url, params=params, headers=headers, timeout=20)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return {"pm25": None, "aqi_hint": "No nearby AQ station"}

        sensors = results[0].get("sensors", [])
        pm25 = None
        for s in sensors:
            if s.get("parameter", {}).get("name", "").lower() in {"pm25", "pm2.5"}:
                pm25 = s.get("latest", {}).get("value")
                break

        if pm25 is None:
            return {"pm25": None, "aqi_hint": "PM2.5 unavailable"}

        if pm25 <= 12:
            hint = "Good"
        elif pm25 <= 35.4:
            hint = "Moderate"
        elif pm25 <= 55.4:
            hint = "Unhealthy for Sensitive Groups"
        elif pm25 <= 150.4:
            hint = "Unhealthy"
        else:
            hint = "Very Unhealthy"

        return {"pm25": pm25, "aqi_hint": hint}
    except Exception:
        return {"pm25": None, "aqi_hint": "AQ data unavailable"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/environment")
async def environment(
    data_types: list[str] = Query(default=["temperature", "rainfall", "air_quality"]),
    date: str | None = None,
):
    if date:
        target = datetime.fromisoformat(date.replace("Z", "+00:00"))
    else:
        target = datetime.now(timezone.utc)

    features = []
    async with httpx.AsyncClient() as client:
        for city in CITIES:
            weather = await fetch_weather(client, city["lat"], city["lon"], target)
            aq = await fetch_air_quality(client, city["lat"], city["lon"], target)

            props = {
                "city": city["name"],
                "timestamp": to_iso(target),
                "temperature_c": weather["temperature_c"] if "temperature" in data_types else None,
                "rainfall_mm": weather["rainfall_mm"] if "rainfall" in data_types else None,
                "pm25": aq["pm25"] if "air_quality" in data_types else None,
                "aqi_hint": aq["aqi_hint"] if "air_quality" in data_types else None,
            }

            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [city["lon"], city["lat"]]},
                    "properties": props,
                }
            )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "requested_data_types": data_types,
            "requested_date": to_iso(target),
            "generated_at": to_iso(datetime.now(timezone.utc)),
        },
    }
