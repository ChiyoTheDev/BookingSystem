/* ============================================================
   Booking Scheduler — Google Apps Script Backend
   ------------------------------------------------------------
   Paste this entire file into the Apps Script editor attached
   to your Google Sheet (Extensions > Apps Script). See README.md
   for full setup instructions.

   This script:
   - doGet(e)   -> returns all bookings as JSON (table.html)
   - doPost(e)  -> creates, updates, or deletes a booking, based
                   on the "action" field in the request body
                   (index.html for create, table.html for edit/delete)

   IMPORTANT: If you deployed an earlier version of this script
   without an ID column, see the "Upgrading an existing sheet"
   note in README.md before using the edit/delete features.

   PERFORMANCE: doGet responses are cached for CACHE_TTL_SECONDS
   using CacheService, and the cache is cleared automatically on
   every create/update/delete. This avoids re-reading and
   re-serializing the whole sheet on every table load/refresh.
   ============================================================ */

const SHEET_NAME = "Bookings";
const HEADERS = ["ID", "Timestamp", "Name", "Date", "Time", "Remark", "Payment", "Status"];
const CACHE_KEY = "bookings_json_v1";
const CACHE_TTL_SECONDS = 20; // how long a GET response is served from cache

/**
 * Returns the target sheet, creating it with headers if it doesn't exist yet.
 */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Handles create / update / delete requests.
 * Expects a JSON body (sent as text/plain to avoid CORS preflight):
 *   Create: { action: "create", name, date, time, remark, payment, status }
 *   Update: { action: "update", id, name, date, time, remark, payment, status }
 *   Delete: { action: "delete", id }
 */
function doPost(e) {
  try {
    const sheet = getSheet_();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "create";

    if (action === "update") {
      return updateBooking_(sheet, data);
    }

    if (action === "delete") {
      return deleteBooking_(sheet, data);
    }

    return createBooking_(sheet, data);
  } catch (err) {
    return jsonResponse_({ result: "error", error: err.message });
  }
}

function createBooking_(sheet, data) {
  const id = Utilities.getUuid();

  sheet.appendRow([
    id,
    new Date(),
    data.name || "",
    data.date || "",
    data.time || "",
    data.remark || "",
    data.payment || "",
    data.status || "Pending",
  ]);

  invalidateCache_();
  return jsonResponse_({ result: "success", id: id });
}

function updateBooking_(sheet, data) {
  const rowIndex = findRowById_(sheet, data.id);

  if (rowIndex === -1) {
    return jsonResponse_({ result: "error", error: "Booking not found." });
  }

  // Columns: ID(1) Timestamp(2) Name(3) Date(4) Time(5) Remark(6) Payment(7) Status(8)
  sheet.getRange(rowIndex, 3, 1, 6).setValues([[
    data.name || "",
    data.date || "",
    data.time || "",
    data.remark || "",
    data.payment || "",
    data.status || "Pending",
  ]]);

  invalidateCache_();
  return jsonResponse_({ result: "success" });
}

function deleteBooking_(sheet, data) {
  const rowIndex = findRowById_(sheet, data.id);

  if (rowIndex === -1) {
    return jsonResponse_({ result: "error", error: "Booking not found." });
  }

  sheet.deleteRow(rowIndex);
  invalidateCache_();
  return jsonResponse_({ result: "success" });
}

function invalidateCache_() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

/**
 * Finds the 1-indexed sheet row number matching the given booking ID.
 * Returns -1 if not found.
 */
function findRowById_(sheet, id) {
  if (!id) return -1;

  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      return i + 2; // +1 for header row, +1 for 0-index -> 1-index
    }
  }

  return -1;
}

/**
 * Returns all bookings as a JSON array for the table page.
 * Each object: { id, name, date, time, remark, payment, status }
 */
function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(
        ContentService.MimeType.JSON
      );
    }

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();

    // Remove header row
    const rows = values.slice(1);

    const bookings = rows
      .filter((row) => row.some((cell) => cell !== "")) // skip blank rows
      .map((row) => {
        const [id, timestamp, name, date, time, remark, payment, status] = row;
        return {
          id: id,
          name: name,
          date: formatDateForJson_(date),
          time: formatTimeForJson_(time),
          remark: remark,
          payment: payment,
          status: status,
        };
      });

    const json = JSON.stringify(bookings);
    cache.put(CACHE_KEY, json, CACHE_TTL_SECONDS);

    return ContentService.createTextOutput(json).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    return jsonResponse_({ result: "error", error: err.message });
  }
}

function formatDateForJson_(date) {
  if (Object.prototype.toString.call(date) === "[object Date]") {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return date;
}

/**
 * Google Sheets stores values typed into a "time" field as a Date object
 * (with a placeholder date of Dec 30, 1899). This normalizes that into a
 * plain 24-hour "HH:mm" string, matching the HTML <input type="time">
 * format. The table page converts this to 12-hour AM/PM for display.
 */
function formatTimeForJson_(time) {
  if (Object.prototype.toString.call(time) === "[object Date]") {
    return Utilities.formatDate(time, Session.getScriptTimeZone(), "HH:mm");
  }
  return time;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
