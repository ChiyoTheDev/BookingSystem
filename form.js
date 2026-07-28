/* ============================================================
   Booking Scheduler — Entry Form Logic (index.html)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("booking-form");

  const hourSelect = document.getElementById("time-hour");
  const minuteSelect = document.getElementById("time-minute");
  const periodSelect = document.getElementById("time-period");

  // Default date field to today for convenience
  const dateField = document.getElementById("date");
  if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().split("T")[0];
  }

  populateTimeSelects();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.includes("PASTE_YOUR")) {
      showToast(
        "Web App URL not configured yet. Edit config.js first.",
        "error"
      );
      return;
    }

    const time24 = buildTime24hr();

    const payload = {
      action: "create",
      name: document.getElementById("name").value.trim(),
      date: document.getElementById("date").value,
      time: time24,
      remark: document.getElementById("remark").value.trim(),
      payment: document.getElementById("payment").value,
      status: document.getElementById("status").value,
    };

    if (!payload.name || !payload.date || !time24) {
      showToast("Please fill in name, date, and time.", "error");
      return;
    }

    // Optimistic submit: confirm and reset the form immediately instead of
    // waiting on Apps Script's response, which can lag a second or two
    // behind the moment the row is actually written to the sheet. If the
    // request turns out to have failed, we surface a clear, longer-lived
    // error so it isn't missed after the person has moved on.
    form.reset();
    dateField.value = new Date().toISOString().split("T")[0];
    resetTimeSelects();
    showToast("Booking saved.", "success");

    try {
      // Sent as text/plain to avoid a CORS preflight request, which
      // Google Apps Script web apps do not handle. The Apps Script
      // side still parses this as JSON.
      const response = await fetch(CONFIG.WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.result !== "success") {
        throw new Error(result.error || "Unknown error while saving.");
      }
    } catch (err) {
      console.error(err);
      showToast(
        `Could not save the booking for "${payload.name}" — please re-enter it. (${err.message})`,
        "error",
        7000
      );
    }
  });

  /**
   * Fills the hour (1-12) and minute (00-59) dropdowns. Kept in JS so the
   * HTML stays clean and the option lists are easy to change in one place.
   */
  function populateTimeSelects() {
    for (let h = 1; h <= 12; h++) {
      const opt = document.createElement("option");
      opt.value = String(h).padStart(2, "0");
      opt.textContent = String(h);
      hourSelect.appendChild(opt);
    }

    for (let m = 0; m < 60; m++) {
      const opt = document.createElement("option");
      opt.value = String(m).padStart(2, "0");
      opt.textContent = String(m).padStart(2, "0");
      minuteSelect.appendChild(opt);
    }
  }

  function resetTimeSelects() {
    hourSelect.selectedIndex = 0;
    minuteSelect.selectedIndex = 0;
    periodSelect.selectedIndex = 0;
  }

  /**
   * Converts the 12-hour hour/minute/AM-PM selects into the 24-hour
   * "HH:mm" string the backend and table page expect. Returns "" if
   * any part hasn't been selected yet.
   */
  function buildTime24hr() {
    const hour12 = hourSelect.value;
    const minute = minuteSelect.value;
    const period = periodSelect.value;

    if (!hour12 || !minute || !period) return "";

    let hour24 = parseInt(hour12, 10);
    if (period === "AM") {
      hour24 = hour24 === 12 ? 0 : hour24;
    } else {
      hour24 = hour24 === 12 ? 12 : hour24 + 12;
    }

    return `${String(hour24).padStart(2, "0")}:${minute}`;
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
});
