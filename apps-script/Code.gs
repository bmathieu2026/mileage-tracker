// Mileage Tracker — Google Apps Script web app
// Setup:
// 1. Create a Google Sheet. Add a sheet/tab named "Mileage".
// 2. Add header row: Date | Purpose | Start Name | Start Address | End Address | Miles | Start Lat,Lon | End Lat,Lon
// 3. Extensions → Apps Script. Paste this file. Save.
// 4. Deploy → New deployment → Type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the /exec URL into the PWA's Settings screen.

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mileage');
  const t = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(t.date || Date.now()),
    t.purpose || '',
    t.startName || '',
    t.startAddress || '',
    t.endAddress || '',
    t.miles || 0,
    (t.startLat != null && t.startLon != null) ? t.startLat + ',' + t.startLon : '',
    (t.endLat != null && t.endLon != null) ? t.endLat + ',' + t.endLon : '',
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Mileage tracker endpoint OK');
}
