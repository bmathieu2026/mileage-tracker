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

## Redeploying updates

There are **two independent pieces** that may need redeploying when you make changes. Pick the one(s) that match what you edited.

### A. Frontend changes (`index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`)

If you edited any file the browser loads, you need to push the new files to your host **and** force the phone to fetch them past the service worker cache.

#### A1. Push the new files

**GitHub Pages (web upload):**
1. Open your `mileage-tracker` repo on github.com.
2. Click into the file you changed → click the **pencil ✏ icon** → paste the new contents → scroll down → **Commit changes**.
3. For multiple files, use **Add file → Upload files** and drag the changed files in (GitHub will overwrite existing ones with the same name) → **Commit changes**.
4. Wait ~30–60 seconds for GitHub Pages to rebuild. You can watch progress under the repo's **Actions** tab — a green checkmark means the new version is live.

**GitHub Pages (terminal):** from inside the repo folder:
```
git add .
git commit -m "Update mileage tracker"
git push
```

**Netlify Drop:** re-drag the entire `mileage-tracker` folder onto https://app.netlify.com/drop. Note: Netlify Drop gives you a *new* URL each time unless you have an account and claim the site.

#### A2. Bust the service worker cache (IMPORTANT)

The PWA caches the app shell so it works offline. After deploying, your phone may keep showing the old version until the service worker updates.

**Bump the cache version** *before* you push:
1. Open [sw.js](sw.js).
2. Change `const CACHE = 'mileage-v1';` to `'mileage-v2'` (then `v3`, `v4`, etc. on each release).
3. Save and push along with your other changes. The new service worker will detect the version change, throw away the old cache, and serve the fresh files on next launch.

**On the phone, force a refresh:**
- iOS Safari: close all tabs of the app, then reopen the home-screen icon. If still stale: Settings → Safari → Advanced → Website Data → search "github.io" or your domain → swipe to delete → reopen.
- Android Chrome: long-press the home-screen icon → App info → Storage → **Clear storage**, then reopen.
- Quickest universal fix: delete the home-screen icon and re-add it from the browser.

### B. Apps Script changes (`apps-script/Code.gs`)

⚠️ **Saving in the Apps Script editor is NOT enough.** A deployed web app keeps serving the *previously deployed version* until you explicitly publish a new one.

1. Open your Mileage Sheet → **Extensions → Apps Script**.
2. Paste the new `Code.gs` contents over the old code → click **Save** (💾).
3. Click **Deploy → Manage deployments** (top right).
4. Find your existing deployment in the list and click the **pencil ✏ icon** on its row.
5. In the **Version** dropdown, choose **New version**.
6. Optionally add a description like `Fix sheet name lookup`.
7. Click **Deploy**.
8. **The `/exec` URL stays the same** — you do NOT need to update the URL in your phone's Settings. (If you instead use **New deployment**, you get a brand-new URL and would have to re-paste it on every device.)
9. If your changes use a new Google API or scope, you may be re-prompted to **Authorize access** — click through the same way as the first deploy.

#### Verify the redeploy worked
- Visit the `/exec` URL in a browser — `doGet` should still return `Mileage tracker endpoint OK` (or whatever you changed it to).
- Record a test trip and check that the new behavior shows up in the sheet.
- If something looks wrong, open the Apps Script project → **Executions** (clock icon in left sidebar) and inspect the most recent `doPost` for errors.

### C. Sheet structure changes (adding/renaming/reordering columns)

If you change the column layout in the Mileage tab:
1. Update the header row in the sheet.
2. Update the `appendRow([...])` order in [apps-script/Code.gs](apps-script/Code.gs) to match.
3. Redeploy the Apps Script (Section B above).
4. If the frontend sends new fields, also update [app.js](app.js) and redeploy the frontend (Section A).

## Notes & limitations

- **OSRM demo server** (`router.project-osrm.org`) is best-effort and rate-limited. Fine for personal use; for heavier use, self-host OSRM or swap to OpenRouteService / Mapbox.
- **Nominatim** geocoding has a 1 req/sec policy. Preset coordinates are cached after first use.
- **Apps Script POST** is sent with `mode: 'no-cors'`, so the app cannot read the response. Success is assumed when the network call doesn't error. Check the sheet to confirm.
- **Icons**: add `icons/icon-192.png` and `icons/icon-512.png` for full PWA installability. Any square PNGs work.
