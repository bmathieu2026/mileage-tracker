// Mileage Tracker PWA
// Storage keys
const LS_PRESETS = 'mileage.presets';
const LS_TRIPS = 'mileage.trips';
const LS_URL = 'mileage.scriptUrl';

// ---------- utilities ----------
const $ = (sel) => document.querySelector(sel);
const metersToMiles = (m) => m * 0.000621371;
const uid = () => Math.random().toString(36).slice(2, 10);

const loadPresets = () => JSON.parse(localStorage.getItem(LS_PRESETS) || '[]');
const savePresets = (p) => localStorage.setItem(LS_PRESETS, JSON.stringify(p));
const loadTrips = () => JSON.parse(localStorage.getItem(LS_TRIPS) || '[]');
const saveTrips = (t) => localStorage.setItem(LS_TRIPS, JSON.stringify(t.slice(0, 25)));
const getScriptUrl = () => localStorage.getItem(LS_URL) || '';
const setScriptUrl = (u) => localStorage.setItem(LS_URL, u);

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg || '';
  el.classList.toggle('error', !!isError);
}

// ---------- geolocation ----------
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ---------- geocoding (Nominatim) ----------
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  if (!data.length) throw new Error('Address not found');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return '';
    const data = await res.json();
    return data.display_name || '';
  } catch { return ''; }
}

// ---------- routing (OSRM) ----------
async function drivingDistanceMeters(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing failed');
  const data = await res.json();
  if (!data.routes || !data.routes.length) throw new Error('No route found');
  return data.routes[0].distance;
}

// ---------- Apps Script POST ----------
async function postTripToSheet(trip) {
  const url = getScriptUrl();
  if (!url) throw new Error('Set Google Apps Script URL in Settings first');
  // no-cors: opaque response, no error => assumed success
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(trip),
  });
}

// ---------- views ----------
function showView(name) {
  $('#view-main').classList.toggle('hidden', name !== 'main');
  $('#view-settings').classList.toggle('hidden', name !== 'settings');
  if (name === 'settings') renderSettings();
  if (name === 'main') renderRecent();
}

function renderRecent() {
  const list = $('#recent-list');
  const trips = loadTrips();
  list.innerHTML = '';
  if (!trips.length) {
    list.innerHTML = '<li class="meta">No trips yet.</li>';
    return;
  }
  for (const t of trips) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="miles">${t.miles.toFixed(1)} mi · ${t.purpose || '(no purpose)'}</div>
      <div class="meta">${new Date(t.date).toLocaleString()} — from ${t.startName || t.startAddress || '?'}</div>`;
    list.appendChild(li);
  }
}

function renderSettings() {
  $('#script-url').value = getScriptUrl();
  const ul = $('#preset-list');
  ul.innerHTML = '';
  const presets = loadPresets();
  if (!presets.length) {
    ul.innerHTML = '<li class="meta">No saved locations yet.</li>';
    return;
  }
  for (const p of presets) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="preset-meta">
        <strong>${escapeHtml(p.name)}</strong>
        <small>${escapeHtml(p.address)}</small>
      </div>
      <button data-id="${p.id}" aria-label="Delete">×</button>`;
    li.querySelector('button').addEventListener('click', () => {
      savePresets(loadPresets().filter((x) => x.id !== p.id));
      renderSettings();
    });
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- record flow ----------
async function recordMileage() {
  try {
    setStatus('Getting current location…');
    const end = await getCurrentPosition();
    setStatus(`Got location (±${Math.round(end.accuracy)} m)`);

    const start = await pickStart();
    if (!start) { setStatus(''); return; }

    const purpose = await askPurpose();
    if (purpose === null) { setStatus(''); return; }

    setStatus('Calculating route…');
    const meters = await drivingDistanceMeters(start, end);
    const miles = metersToMiles(meters);
    const endAddress = await reverseGeocode(end.lat, end.lon);

    const trip = {
      date: new Date().toISOString(),
      purpose,
      startName: start.name || '',
      startAddress: start.address || start.display || '',
      endAddress,
      miles: +miles.toFixed(2),
      startLat: start.lat, startLon: start.lon,
      endLat: end.lat, endLon: end.lon,
    };

    const ok = await showSummary(trip);
    if (!ok) { setStatus('Cancelled'); return; }

    setStatus('Saving to Google Sheet…');
    await postTripToSheet(trip);
    saveTrips([trip, ...loadTrips()]);
    renderRecent();
    setStatus(`Saved: ${trip.miles.toFixed(1)} mi`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Something went wrong', true);
  }
}

function pickStart() {
  return new Promise((resolve) => {
    const dlg = $('#dlg-start');
    const ul = $('#start-presets');
    const addressInput = $('#start-address');
    addressInput.value = '';
    ul.innerHTML = '';
    let chosenPreset = null;

    const presets = loadPresets();
    if (!presets.length) {
      ul.innerHTML = '<li class="meta">No presets — type an address below or add one in Settings.</li>';
    }
    for (const p of presets) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="preset-meta"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.address)}</small></div>`;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        chosenPreset = p;
        [...ul.children].forEach((c) => (c.style.outline = ''));
        li.style.outline = '2px solid var(--primary)';
      });
      ul.appendChild(li);
    }

    const onClose = async () => {
      dlg.removeEventListener('close', onClose);
      if (dlg.returnValue !== 'confirm') return resolve(null);
      try {
        if (chosenPreset) {
          // ensure coords (cache after first geocode)
          if (chosenPreset.lat == null || chosenPreset.lon == null) {
            setStatus('Looking up preset address…');
            const g = await geocodeAddress(chosenPreset.address);
            chosenPreset.lat = g.lat; chosenPreset.lon = g.lon;
            const all = loadPresets().map((x) => x.id === chosenPreset.id ? chosenPreset : x);
            savePresets(all);
          }
          return resolve({ name: chosenPreset.name, address: chosenPreset.address, lat: chosenPreset.lat, lon: chosenPreset.lon });
        }
        const addr = addressInput.value.trim();
        if (!addr) return resolve(null);
        setStatus('Looking up address…');
        const g = await geocodeAddress(addr);
        resolve({ name: '', address: addr, display: g.display, lat: g.lat, lon: g.lon });
      } catch (e) {
        setStatus(e.message, true);
        resolve(null);
      }
    };
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

function askPurpose() {
  return new Promise((resolve) => {
    const dlg = $('#dlg-purpose');
    const input = $('#purpose-input');
    input.value = '';
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'confirm' ? input.value.trim() : null);
    };
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

function showSummary(trip) {
  return new Promise((resolve) => {
    const dlg = $('#dlg-summary');
    const dl = $('#summary-dl');
    dl.innerHTML = `
      <dt>Miles</dt><dd>${trip.miles.toFixed(2)}</dd>
      <dt>Purpose</dt><dd>${escapeHtml(trip.purpose || '(none)')}</dd>
      <dt>From</dt><dd>${escapeHtml(trip.startName || trip.startAddress || '?')}</dd>
      <dt>To</dt><dd>${escapeHtml(trip.endAddress || `${trip.endLat.toFixed(5)}, ${trip.endLon.toFixed(5)}`)}</dd>
      <dt>Date</dt><dd>${new Date(trip.date).toLocaleString()}</dd>`;
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'save');
    };
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

// ---------- wire up ----------
document.addEventListener('DOMContentLoaded', () => {
  $('#record-btn').addEventListener('click', recordMileage);
  $('#nav-settings').addEventListener('click', () => showView('settings'));
  $('#nav-back').addEventListener('click', () => showView('main'));

  $('#save-url').addEventListener('click', () => {
    setScriptUrl($('#script-url').value.trim());
    setStatus('Saved Apps Script URL');
  });

  $('#preset-add').addEventListener('click', async () => {
    const name = $('#preset-name').value.trim();
    const address = $('#preset-address').value.trim();
    if (!name || !address) return;
    const preset = { id: uid(), name, address, lat: null, lon: null };
    try {
      const g = await geocodeAddress(address);
      preset.lat = g.lat; preset.lon = g.lon;
    } catch (e) {
      // save without coords; will be looked up on first use
    }
    savePresets([...loadPresets(), preset]);
    $('#preset-name').value = '';
    $('#preset-address').value = '';
    renderSettings();
  });

  renderRecent();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
