/* ============================================================
   Booking Scheduler — Table Page Logic (table.html)
   ============================================================ */

let allBookings = []; // full dataset fetched from Google Sheets
let currentFilter = "day"; // 'day' | 'week' | 'month' | 'all' | 'completed'
let searchTerm = ""; // current search bar text
let editingId = null; // id of the booking currently being edited, if any
let currentPage = 1; // 1-indexed page of the table currently shown

const STATUS_OPTIONS = ["Pending", "Confirmed", "Completed", "Cancelled"];
const PAGE_SIZE = 15;

document.addEventListener("DOMContentLoaded", () => {
  loadBookings();

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      renderTable(getVisibleBookings());
    });
  });

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    currentPage = 1;
    renderTable(getVisibleBookings());
  });

  document.getElementById("refresh-btn").addEventListener("click", loadBookings);
  document.getElementById("export-pdf-btn").addEventListener("click", exportToPDF);
});

/**
 * Applies the active date filter AND the search term together.
 */
function getVisibleBookings() {
  return applySearch(applyFilter(allBookings, currentFilter), searchTerm);
}

/**
 * Searches across name, date (both raw and human-readable), time,
 * remark, payment, and status.
 */
function applySearch(bookings, term) {
  if (!term) return bookings;

  return bookings.filter((b) => {
    const haystack = [
      b.name,
      b.date,
      formatDate(b.date),
      formatTime12hr(b.time),
      b.remark,
      b.payment,
      b.status,
    ]
      .map((v) => (v ?? "").toString().toLowerCase())
      .join(" ");
    return haystack.includes(term);
  });
}

async function loadBookings() {
  const tableBody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");

  editingId = null;
  currentPage = 1;
  emptyState.classList.add("hidden");
  loadingState.classList.remove("hidden");
  tableBody.innerHTML = "";

  if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.includes("PASTE_YOUR")) {
    loadingState.classList.add("hidden");
    emptyState.classList.remove("hidden");
    emptyState.querySelector("p").textContent =
      "Web App URL not configured yet. Edit config.js first.";
    return;
  }

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, { method: "GET" });
    const data = await response.json();

    allBookings = Array.isArray(data) ? data : [];
    renderTable(getVisibleBookings());
  } catch (err) {
    console.error(err);
    emptyState.classList.remove("hidden");
    emptyState.querySelector("p").textContent =
      "Could not load bookings. Check your Web App URL and deployment.";
  } finally {
    loadingState.classList.add("hidden");
  }
}

function applyFilter(bookings, filter) {
  if (filter === "all") return bookings;

  if (filter === "completed") {
    return bookings.filter(
      (b) => (b.status || "").toLowerCase() === "completed"
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return bookings.filter((b) => {
    const bookingDate = new Date(b.date);
    if (isNaN(bookingDate)) return false;
    const bd = new Date(
      bookingDate.getFullYear(),
      bookingDate.getMonth(),
      bookingDate.getDate()
    );

    if (filter === "day") {
      return bd.getTime() === startOfToday.getTime();
    }

    if (filter === "week") {
      // Week = current Sunday through Saturday
      const dayOfWeek = startOfToday.getDay();
      const weekStart = new Date(startOfToday);
      weekStart.setDate(startOfToday.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return bd >= weekStart && bd <= weekEnd;
    }

    if (filter === "month") {
      return (
        bd.getFullYear() === now.getFullYear() &&
        bd.getMonth() === now.getMonth()
      );
    }

    return true;
  });
}

function renderTable(bookings) {
  const tableBody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  const countLabel = document.getElementById("result-count");
  const pagination = document.getElementById("pagination");

  tableBody.innerHTML = "";

  if (bookings.length === 0) {
    countLabel.textContent = "0 bookings";
    emptyState.classList.remove("hidden");
    emptyState.querySelector("p").textContent =
      "No bookings found for this period.";
    pagination.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  // Sort by date, then time
  const sorted = [...bookings].sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}`);
    const db = new Date(`${b.date}T${b.time || "00:00"}`);
    return da - db;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIdx, startIdx + PAGE_SIZE);

  countLabel.textContent = `Showing ${startIdx + 1}–${
    startIdx + pageItems.length
  } of ${sorted.length} booking${sorted.length === 1 ? "" : "s"}`;

  pageItems.forEach((b) => {
    tableBody.appendChild(
      b.id != null && b.id === editingId ? buildEditRow(b) : buildViewRow(b)
    );
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("pagination");

  if (totalPages <= 1) {
    pagination.classList.add("hidden");
    pagination.innerHTML = "";
    return;
  }

  pagination.classList.remove("hidden");
  pagination.innerHTML = `
    <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
    <div class="pagination-controls">
      <button class="pagination-btn" id="page-prev" title="Previous page" ${
        currentPage === 1 ? "disabled" : ""
      }>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
      </button>
      <span class="pagination-page-label">${currentPage} / ${totalPages}</span>
      <button class="pagination-btn" id="page-next" title="Next page" ${
        currentPage === totalPages ? "disabled" : ""
      }>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>
      </button>
    </div>
  `;

  const prevBtn = document.getElementById("page-prev");
  const nextBtn = document.getElementById("page-next");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentPage -= 1;
      renderTable(getVisibleBookings());
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentPage += 1;
      renderTable(getVisibleBookings());
    });
  }
}

/* ---------------- View row ---------------- */

function buildViewRow(b) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td class="font-medium">${escapeHtml(b.name)}</td>
    <td>${formatDate(b.date)}</td>
    <td>${escapeHtml(formatTime12hr(b.time))}</td>
    <td class="max-w-xs">${escapeHtml(b.remark || "")}</td>
    <td>${escapeHtml(b.payment || "")}</td>
    <td>${statusBadge(b.status)}</td>
    <td class="no-print">
      <div class="flex items-center gap-1">
        <button class="icon-btn icon-btn-edit" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
        </button>
        <button class="icon-btn icon-btn-delete" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
        </button>
      </div>
    </td>
  `;

  row.querySelector(".icon-btn-edit").addEventListener("click", () => {
    if (b.id == null) {
      alert(
        "This booking can't be edited yet — refresh the page after your first Apps Script deployment upgrade."
      );
      return;
    }
    editingId = b.id;
    renderTable(getVisibleBookings());
  });

  row.querySelector(".icon-btn-delete").addEventListener("click", () => {
    handleDelete(b);
  });

  return row;
}

/* ---------------- Edit row ---------------- */

function buildEditRow(b) {
  const row = document.createElement("tr");
  row.className = "editing-row";

  const statusOptionsHtml = STATUS_OPTIONS.map(
    (s) =>
      `<option value="${s}" ${s === b.status ? "selected" : ""}>${s}</option>`
  ).join("");

  row.innerHTML = `
    <td><input class="row-input" data-field="name" value="${escapeAttr(b.name)}" /></td>
    <td><input class="row-input" type="date" data-field="date" value="${escapeAttr(b.date)}" /></td>
    <td><input class="row-input" type="time" data-field="time" value="${escapeAttr(to24hr_(b.time))}" /></td>
    <td><input class="row-input" data-field="remark" value="${escapeAttr(b.remark || "")}" /></td>
    <td><input class="row-input" data-field="payment" value="${escapeAttr(b.payment || "")}" /></td>
    <td>
      <select class="row-input" data-field="status">${statusOptionsHtml}</select>
    </td>
    <td class="no-print">
      <div class="flex items-center gap-1">
        <button class="icon-btn icon-btn-save" title="Save">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
        </button>
        <button class="icon-btn icon-btn-cancel" title="Cancel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
        </button>
      </div>
    </td>
  `;

  row.querySelector(".icon-btn-cancel").addEventListener("click", () => {
    editingId = null;
    renderTable(getVisibleBookings());
  });

  row.querySelector(".icon-btn-save").addEventListener("click", () => {
    const updated = {
      id: b.id,
      name: row.querySelector('[data-field="name"]').value.trim(),
      date: row.querySelector('[data-field="date"]').value,
      time: row.querySelector('[data-field="time"]').value,
      remark: row.querySelector('[data-field="remark"]').value.trim(),
      payment: row.querySelector('[data-field="payment"]').value.trim(),
      status: row.querySelector('[data-field="status"]').value,
    };

    if (!updated.name || !updated.date || !updated.time) {
      alert("Name, date, and time can't be empty.");
      return;
    }

    handleUpdate(updated);
  });

  return row;
}

/* ---------------- Save / delete against the backend ---------------- */

async function handleUpdate(updated) {
  const idx = allBookings.findIndex((x) => x.id === updated.id);
  const previous = idx !== -1 ? { ...allBookings[idx] } : null;

  // Optimistic update: apply the change and exit edit mode immediately so
  // the person isn't stuck watching a spinner. Apps Script's response can
  // lag behind the actual sheet write by a second or two — no need to make
  // the UI wait for it too. We reconcile with the real result below.
  if (idx !== -1) allBookings[idx] = { ...allBookings[idx], ...updated };
  editingId = null;
  renderTable(getVisibleBookings());
  beginSync();

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "update", ...updated }),
    });
    const result = await response.json();

    if (result.result !== "success") {
      throw new Error(result.error || "Unknown error while saving.");
    }

    showToast("Edit saved.", "success");
  } catch (err) {
    console.error(err);
    // Roll back to what the sheet actually had, since the write failed
    if (previous) {
      const rollbackIdx = allBookings.findIndex((x) => x.id === updated.id);
      if (rollbackIdx !== -1) allBookings[rollbackIdx] = previous;
      renderTable(getVisibleBookings());
    }
    showToast("Could not save changes — reverted. " + err.message, "error", 6000);
  } finally {
    endSync();
  }
}

async function handleDelete(b) {
  if (b.id == null) return;
  if (!confirm(`Delete the booking for "${b.name}"? This can't be undone.`)) {
    return;
  }

  // Optimistic delete: remove it from the screen right away and restore it
  // if the request turns out to have failed.
  const idx = allBookings.findIndex((x) => x.id === b.id);
  const removed = idx !== -1 ? allBookings[idx] : b;
  allBookings = allBookings.filter((x) => x.id !== b.id);
  renderTable(getVisibleBookings());
  beginSync();

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", id: b.id }),
    });
    const result = await response.json();

    if (result.result !== "success") {
      throw new Error(result.error || "Unknown error while deleting.");
    }

    showToast("Booking deleted.", "success");
  } catch (err) {
    console.error(err);
    allBookings.push(removed);
    renderTable(getVisibleBookings());
    showToast("Could not delete booking — restored. " + err.message, "error", 6000);
  } finally {
    endSync();
  }
}

/**
 * Small "Syncing..." indicator near the toolbar so there's still a subtle
 * signal that a background save/delete is in flight, without blocking the
 * UI the way the old spinner-in-button approach did.
 */
let pendingSyncCount = 0;

function beginSync() {
  pendingSyncCount += 1;
  updateSyncIndicator();
}

function endSync() {
  pendingSyncCount = Math.max(0, pendingSyncCount - 1);
  updateSyncIndicator();
}

function updateSyncIndicator() {
  const indicator = document.getElementById("sync-indicator");
  if (indicator) indicator.classList.toggle("hidden", pendingSyncCount === 0);
}

function showToast(message, type, duration = 3500) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${
    type === "success" ? "toast-success" : "toast-error"
  }`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

/* ---------------- Formatting helpers ---------------- */

function statusBadge(status) {
  const s = (status || "").toLowerCase();
  const map = {
    pending: "badge-pending",
    confirmed: "badge-confirmed",
    completed: "badge-completed",
    cancelled: "badge-cancelled",
  };
  const cls = map[s] || "badge-pending";
  const label = status ? escapeHtml(status) : "Pending";
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Converts a 24-hour "HH:mm" string (what the backend and <input type="time">
 * use) into a 12-hour "h:mm AM/PM" string for display in the table.
 */
function formatTime12hr(timeStr) {
  const parsed = to24hr_(timeStr);
  if (!parsed) return "";

  const [hStr, mStr] = parsed.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (isNaN(h)) return timeStr || "";

  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  return `${h}:${m} ${period}`;
}

/**
 * Normalizes whatever time value we got back from the backend into a
 * plain 24-hour "HH:mm" string. Handles both the expected "HH:mm" string
 * and, defensively, an ISO timestamp fallback.
 */
function to24hr_(timeStr) {
  if (!timeStr) return "";

  // Already "HH:mm" or "HH:mm:ss"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    const [h, m] = timeStr.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }

  // Fallback: an ISO date-time string
  const d = new Date(timeStr);
  if (!isNaN(d)) {
    const h = String(d.getUTCHours()).padStart(2, "0");
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  return "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str ?? "").toString().replace(/"/g, "&quot;");
}

/* ---------------- PDF export ---------------- */

function exportToPDF() {
  const bookings = getVisibleBookings();

  if (bookings.length === 0) {
    alert("There are no bookings to export for the current filter/search.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text("Booking Schedule", 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const filterLabels = {
    all: "All bookings",
    day: "Today",
    week: "This Week",
    month: "This Month",
    completed: "Completed",
  };
  const filterLabel = filterLabels[currentFilter] || "All bookings";
  const searchLabel = searchTerm ? `  |  Search: "${searchTerm}"` : "";
  doc.text(
    `${filterLabel}${searchLabel}  |  Generated: ${new Date().toLocaleString()}`,
    14,
    23
  );

  const rows = [...bookings]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((b) => [
      b.name || "",
      formatDate(b.date),
      formatTime12hr(b.time),
      b.remark || "",
      b.payment || "",
      b.status || "",
    ]);

  doc.autoTable({
    startY: 28,
    head: [["Name", "Date", "Time", "Remark", "Payment", "Status"]],
    body: rows,
    headStyles: { fillColor: [11, 46, 99] }, // blue-900
    alternateRowStyles: { fillColor: [239, 246, 255] }, // blue-50
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`booking-schedule-${new Date().toISOString().split("T")[0]}.pdf`);
}
