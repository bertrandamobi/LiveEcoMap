const API_BASE = window.LIVEECOMAP_API_BASE || "http://localhost:8000";
const map = L.map("map").setView([39.5, -98.35], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const DEMO_CITIES = [
  ["New York", 40.7128, -74.006],
  ["Los Angeles", 34.0522, -118.2437],
  ["Chicago", 41.8781, -87.6298],
  ["Houston", 29.7604, -95.3698],
  ["Phoenix", 33.4484, -112.074],
  ["Seattle", 47.6062, -122.3321],
];

let layerGroup = L.layerGroup().addTo(map);
let latestGeoJSON = null;
let demoInterval = null;

function selectedTypes() {
  return [...document.querySelectorAll("input[type=checkbox]:checked")].map((x) => x.value);
}

function formatPopup(p) {
  return `<b>${p.city}</b><br/>Time: ${p.timestamp}<br/>🌡️ Temp: ${p.temperature_c ?? "N/A"} °C<br/>🌧️ Rain: ${p.rainfall_mm ?? "N/A"} mm<br/>🫁 PM2.5: ${p.pm25 ?? "N/A"} µg/m³<br/>AQ: ${p.aqi_hint ?? "N/A"}`;
}

function colorFromTemp(temp) {
  if (temp == null) return "#7f8c8d";
  if (temp < 0) return "#5dade2";
  if (temp < 15) return "#48c9b0";
  if (temp < 30) return "#f4d03f";
  return "#e74c3c";
}

function generateDemoData(dateISO) {
  const date = new Date(dateISO);
  const hour = date.getUTCHours();
  return {
    type: "FeatureCollection",
    features: DEMO_CITIES.map(([city, lat, lon], i) => {
      const temperature = Math.round((10 + 18 * Math.sin((hour + i) / 24 * Math.PI * 2)) * 10) / 10;
      const rainfall = Math.max(0, Math.round((4 * Math.cos((hour + i * 2) / 24 * Math.PI * 2)) * 10) / 10);
      const pm25 = Math.max(2, Math.round(15 + 20 * Math.sin((hour + i * 3) / 24 * Math.PI * 2)));
      const hint = pm25 <= 12 ? "Good" : pm25 <= 35 ? "Moderate" : "Unhealthy";
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { city, timestamp: date.toISOString(), temperature_c: temperature, rainfall_mm: rainfall, pm25, aqi_hint: hint },
      };
    }),
    metadata: { source: "demo" },
  };
}

async function fetchData(customDate) {
  const dateEl = document.getElementById("dateInput");
  const date = customDate || (dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString());
  const types = selectedTypes();
  const params = new URLSearchParams();
  types.forEach((t) => params.append("data_types", t));
  params.set("date", date);

  try {
    const response = await fetch(`${API_BASE}/api/environment?${params.toString()}`, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error("API unavailable");
    latestGeoJSON = await response.json();
    document.getElementById("demoBtn").title = "Live API mode";
  } catch {
    latestGeoJSON = generateDemoData(date);
    document.getElementById("demoBtn").title = "Demo fallback mode (API not reachable from GitHub Pages)";
  }
  renderLayer();
}

function renderLayer() {
  layerGroup.clearLayers();
  latestGeoJSON.features.forEach((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties;
    L.circleMarker([lat, lon], {
      radius: 9 + (p.rainfall_mm || 0),
      color: colorFromTemp(p.temperature_c),
      fillOpacity: 0.75,
    }).bindPopup(formatPopup(p)).addTo(layerGroup);
  });
}

function exportCSV() {
  if (!latestGeoJSON) return;
  const headers = ["city", "timestamp", "temperature_c", "rainfall_mm", "pm25", "aqi_hint", "lat", "lon"];
  const rows = latestGeoJSON.features.map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return [p.city, p.timestamp, p.temperature_c, p.rainfall_mm, p.pm25, p.aqi_hint, lat, lon].join(",");
  });
  downloadFile("liveecomap-data.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
}

function exportGeoJSON() {
  if (!latestGeoJSON) return;
  downloadFile("liveecomap-data.geojson", JSON.stringify(latestGeoJSON, null, 2), "application/geo+json");
}

function downloadFile(name, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function startDemo() {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
    document.getElementById("demoBtn").textContent = "Start Animated Demo";
    return;
  }
  document.getElementById("demoBtn").textContent = "Stop Animated Demo";
  let offset = 0;
  demoInterval = setInterval(() => fetchData(new Date(Date.now() - offset++ * 3600_000).toISOString()), 1500);
}

document.getElementById("refreshBtn").addEventListener("click", () => fetchData());
document.getElementById("csvBtn").addEventListener("click", exportCSV);
document.getElementById("geojsonBtn").addEventListener("click", exportGeoJSON);
document.getElementById("demoBtn").addEventListener("click", startDemo);

fetchData();
