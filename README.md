# Mileage Tracker

A simple phone-friendly PWA that records driving mileage. Tap **Record Mileage**, pick a starting location (preset or address), enter a purpose, and the app uses your phone's GPS + OSRM to compute driving distance and append a row to a Google Sheet.

## Setup

### 1. Google Sheet + Apps Script

1. Create a new Google Sheet. Rename the first tab to **Mileage**.
2. Add this header row:
   `Date | Purpose | Start Name | Start Address | End Address | Miles | Start Lat,Lon | End Lat,Lon`
3. **Extensions → Apps Script**. Paste the contents of [apps-script/Code.gs](apps-script/Code.gs). Save.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL (ends in `/exec`).

### 2. Host the PWA

The site must be served over **HTTPS** (or `http://localhost`) for geolocation to work.

Quick options:
- **GitHub Pages**: push the `mileage-tracker/` folder to a repo and enable Pages.
- **Netlify Drop**: drag the folder onto https://app.netlify.com/drop.
- **Local test**: `cd mileage-tracker && python3 -m http.server 8000` then open `http://localhost:8000`.

### 3. Configure the app on your phone

1. Open the hosted URL in mobile Safari/Chrome.
2. Tap the ⚙︎ icon → paste the Apps Script `/exec` URL → **Save URL**.
3. Add saved starting locations (Home, Office, etc.).
4. Add to Home Screen (Share → Add to Home Screen on iOS; install prompt on Android).

## Usage

1. Tap **Record Mileage**.
2. Allow location access. The app captures your current GPS as the destination.
3. Pick a saved starting location, or type an address.
4. Enter a trip purpose.
5. Review the summary → **Save**. The row appears in your Google Sheet.

## Notes & limitations

- **OSRM demo server** (`router.project-osrm.org`) is best-effort and rate-limited. Fine for personal use; for heavier use, self-host OSRM or swap to OpenRouteService / Mapbox.
- **Nominatim** geocoding has a 1 req/sec policy. Preset coordinates are cached after first use.
- **Apps Script POST** is sent with `mode: 'no-cors'`, so the app cannot read the response. Success is assumed when the network call doesn't error. Check the sheet to confirm.
- **Icons**: add `icons/icon-192.png` and `icons/icon-512.png` for full PWA installability. Any square PNGs work.
