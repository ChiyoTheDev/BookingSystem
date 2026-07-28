# Booking Scheduler — Setup Guide

A 2-page booking system (entry form + table view) backed by Google Sheets.

## Files

| File          | Purpose                                              |
|---------------|-------------------------------------------------------|
| `index.html`  | Page 1 — booking entry form                           |
| `table.html`  | Page 2 — table of all bookings, with filters + PDF export |
| `styles.css`  | All custom CSS (white & blue theme)                    |
| `config.js`   | Single place to paste your Google Apps Script URL       |
| `form.js`     | Logic for the entry form (index.html)                  |
| `table.js`    | Logic for the table page (table.html)                  |
| `code.gs`     | Google Apps Script backend — connects to Google Sheets  |

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it whatever you like, e.g. "Booking Scheduler Data".
3. You don't need to create any columns manually — the script creates a
   `Bookings` sheet with headers automatically the first time it runs.

## Step 2 — Add the Apps Script backend

1. In your Sheet, go to **Extensions > Apps Script**.
2. Delete any starter code in the editor.
3. Copy the entire contents of `code.gs` (provided in this project) and paste it in.
4. Click the **Save** icon (or `Ctrl+S` / `Cmd+S`).

## Step 3 — Deploy as a Web App

1. In the Apps Script editor, click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** Booking Scheduler API (or anything)
   - **Execute as:** Me
   - **Who has access:** Anyone
     *(This is required so the web page can call it. It does not expose your
     spreadsheet's contents beyond the fields this script deliberately returns.)*
4. Click **Deploy**.
5. Authorize the script when prompted (click through the "Google hasn't verified this app" warning — this is expected for personal scripts — Advanced > Go to [project name]).
6. Copy the **Web app URL** shown (it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`).

> Whenever you edit `code.gs` later, you must create a **new deployment**
> (or use "Manage deployments > Edit > New version") for changes to take effect.

## Step 4 — Connect the front end

1. Open `config.js`.
2. Replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with the Web app
   URL you copied in Step 3:

   ```js
   const CONFIG = {
     WEB_APP_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   };
   ```

3. Save the file.

## Step 5 — Use it

- Open `index.html` in a browser to add a new booking. It will be appended
  as a new row in the `Bookings` sheet. Time is entered via three dropdowns
  (hour / minute / AM-PM) so it's always unambiguous, regardless of the
  browser or system locale.
- Open `table.html` to see all bookings pulled live from the sheet, with:
  - **Filter tabs**: All / Today / This Week / This Month
  - **Search bar**: matches against name, date, remark, payment, and status
  - **Pagination**: 15 bookings per page, with Prev/Next controls to flip
    through the rest — keeps the table from growing unbounded as entries pile up
  - **Inline editing**: click the pencil icon on any row to edit it in place,
    then save (checkmark) or cancel (X). A spinner shows while saving, and a
    toast confirms once the change is written back to the sheet
  - **Delete**: click the trash icon on any row (asks for confirmation first)
  - **Refresh** button to re-fetch the latest data
  - **Export PDF** button, which exports every filtered/searched result
    (not just the current page)
  - **Time column**: always shown in 12-hour AM/PM format, regardless of how
    it's stored in the sheet

### Upgrading an existing sheet

If you had a version of this app running **before** editing/deleting was
added, your `Bookings` sheet won't have the new `ID` column that the edit
and delete features rely on. To upgrade:

1. In your Sheet, insert a new **column A** (right-click column A > *Insert
   1 column left*).
2. Label the new `A1` cell `ID`.
3. Fill in a unique value for each existing row (any unique text works —
   e.g. `1`, `2`, `3`...).
4. Replace your Apps Script code with the latest `code.gs` and redeploy
   (see the note in Step 3 about creating a new deployment version).

New bookings created going forward will get an ID automatically — this is
only needed to backfill rows that already existed.

## Making it feel faster

If loading and saving feel sluggish, two different things are going on, and
this update addresses both:

**1. Apps Script itself has some inherent latency.** Every request to a Web
App spins up a fresh script execution, and Google's infrastructure adds
roughly 1–3 seconds of overhead on top of the actual read/write — this is
normal and can't be fully eliminated. `code.gs` now caches the result of
`doGet` for `CACHE_TTL_SECONDS` (20 seconds by default) using
`CacheService`, and clears that cache automatically the moment any booking
is created, updated, or deleted. So repeated table loads/refreshes within
that window come back almost instantly instead of re-reading and
re-serializing the whole sheet every time.

> **You must redeploy after updating `code.gs`.** Paste the latest version
> into the Apps Script editor, then **Deploy > Manage deployments > Edit
> (pencil icon) > New version > Deploy**. Editing the script alone does not
> update the live Web App.

**2. The exact symptom you noticed** — the sheet updates but the app is
still showing a spinner — happens because the sheet write finishes before
the HTTP response makes its way back to the browser. Rather than wait on
that response, `table.js` and `form.js` now update the screen immediately
when you hit Save, Delete, or submit the form, and reconcile with the
server in the background:

- **New booking**: the form clears and shows "Booking saved" right away.
- **Edit**: the row updates and exits edit mode right away.
- **Delete**: the row disappears right away.

A small "Syncing..." label appears near the toolbar on the table page while
a save/delete is confirming in the background. If a request does fail
(e.g. you're offline, or the Web App URL is wrong), the change is
automatically rolled back and a longer-lived red error toast tells you what
happened, so nothing silently gets lost.

### Hosting it for real use

Right now these are local files. To let someone use this from anywhere
(not just your computer), host the folder somewhere simple and free, e.g.:

- **GitHub Pages** — push the folder to a GitHub repo and enable Pages.
- **Google Sites / Firebase Hosting / Netlify / Vercel** — drag-and-drop the folder.

No server-side code is needed on your end — Google Apps Script already acts
as the backend.

## Notes & customization

- **Status options**: edit the `<select id="status">` options in `index.html`
  if you want different statuses (their badge colors are defined in
  `styles.css` under `.badge-*`).
- **Payment field**: currently a free-text field (accepts numbers or text like
  "Paid"/"Unpaid" or an amount). Change it to `type="number"` in `index.html`
  if you want to enforce numeric-only entry.
- **Color theme**: all colors are defined as CSS variables at the top of
  `styles.css` (`--color-blue-700`, etc.) — change them there to re-theme
  the whole app.
- **Week definition**: "This Week" filter in `table.js` uses Sunday–Saturday.
  Adjust the `applyFilter()` function there if you prefer Monday–Sunday.
- **Bookings per page**: controlled by the `PAGE_SIZE` constant near the top
  of `table.js` (currently `15`).
- **Layout width**: both pages share one `.app-container` class (defined in
  `styles.css`) for their header and main content, so the two pages stay
  visually aligned. Change its `max-width` there to resize both at once.
