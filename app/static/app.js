// ---- DOM references ----

const statusRegion = document.getElementById("status-region");

const createForm = document.getElementById("create-form");
const createSubmit = document.getElementById("create-submit");
const createUrlInput = document.getElementById("create-url");
const createUrlError = document.getElementById("create-url-error");
const createExpiresInput = document.getElementById("create-expires");
const createExpiresError = document.getElementById("create-expires-error");

const detailsCard = document.getElementById("details-card");
const statusBadge = document.getElementById("status-badge");
const qrImage = document.getElementById("qr-image");
const qrImageError = document.getElementById("qr-image-error");
const btnRetryImage = document.getElementById("btn-retry-image");
const btnDownload = document.getElementById("btn-download");
const resultShortUrl = document.getElementById("result-short-url");
const btnCopy = document.getElementById("btn-copy");
const copyFeedback = document.getElementById("copy-feedback");
const resultOriginalUrl = document.getElementById("result-original-url");
const resultExpires = document.getElementById("result-expires");
const resultToken = document.getElementById("result-token");

const btnToggleEdit = document.getElementById("btn-toggle-edit");
const btnToggleAnalytics = document.getElementById("btn-toggle-analytics");
const btnOpenDelete = document.getElementById("btn-open-delete");

const editPanel = document.getElementById("edit-panel");
const updateForm = document.getElementById("update-form");
const updateSubmit = document.getElementById("update-submit");
const updateUrlInput = document.getElementById("update-url");
const updateUrlError = document.getElementById("update-url-error");
const updateExpiresInput = document.getElementById("update-expires");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

const analyticsPanel = document.getElementById("analytics-panel");
const analyticsLoading = document.getElementById("analytics-loading");
const analyticsContent = document.getElementById("analytics-content");
const analyticsError = document.getElementById("analytics-error");
const statTotalScans = document.getElementById("stat-total-scans");
const scansChart = document.getElementById("scans-chart");
const analyticsEmpty = document.getElementById("analytics-empty");

const lookupForm = document.getElementById("lookup-form");
const lookupTokenInput = document.getElementById("lookup-token");
const lookupSubmit = document.getElementById("lookup-submit");
const lookupError = document.getElementById("lookup-error");

const deleteDialog = document.getElementById("delete-dialog");
const btnConfirmDelete = document.getElementById("btn-confirm-delete");

// ---- State ----

let currentToken = null;
let currentMapping = null;

// ---- Helpers ----

function announce(message) {
  statusRegion.textContent = message;
}

/** Backend timestamps have no UTC offset; treat offset-less strings as UTC
 * (the backend is UTC-based) before handing them to Date, otherwise the
 * browser silently reinterprets them as local time. */
function parseBackendTimestamp(value) {
  if (!value) return null;
  const hasOffset = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasOffset ? value : `${value}Z`);
}

function formatLocal(value) {
  const date = parseBackendTimestamp(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toIsoOrNull(datetimeLocalValue) {
  if (!datetimeLocalValue) return null;
  return new Date(datetimeLocalValue).toISOString();
}

function toDatetimeLocalValue(backendValue) {
  const date = parseBackendTimestamp(backendValue);
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function parseResponse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return body;
}

function setLoading(button, isLoading, loadingLabel, idleLabel) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingLabel : idleLabel;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function computeStatus(mapping) {
  if (mapping.is_deleted) return "deleted";
  if (mapping.expires_at && parseBackendTimestamp(mapping.expires_at) < new Date()) return "expired";
  return "active";
}

// ---- Rendering ----

function renderDetails(mapping) {
  currentMapping = mapping;
  currentToken = mapping.token;

  const status = computeStatus(mapping);
  statusBadge.className = `badge badge--${status === "active" ? "good" : status === "expired" ? "warning" : "danger"}`;
  statusBadge.textContent = status === "active" ? "Active" : status === "expired" ? "Expired" : "Deleted";

  const shortUrl = `${location.origin}/r/${mapping.token}`;
  resultShortUrl.value = shortUrl;
  resultOriginalUrl.textContent = mapping.original_url;
  resultExpires.textContent = mapping.expires_at ? formatLocal(mapping.expires_at) : "Never expires";
  resultToken.textContent = mapping.token;

  loadQrImage(mapping.token);
  btnDownload.href = `/api/qr/${mapping.token}/image`;
  btnDownload.setAttribute("download", `qr-${mapping.token}.png`);

  const disableManagement = status === "deleted";
  btnToggleEdit.disabled = disableManagement;
  btnToggleAnalytics.disabled = disableManagement;
  btnOpenDelete.disabled = disableManagement;

  updateUrlInput.value = mapping.original_url;
  updateExpiresInput.value = toDatetimeLocalValue(mapping.expires_at);

  editPanel.hidden = true;
  analyticsPanel.hidden = true;

  detailsCard.hidden = false;

  const params = new URLSearchParams(location.search);
  params.set("token", mapping.token);
  history.replaceState(null, "", `?${params.toString()}`);
  sessionStorage.setItem("qr_last_token", mapping.token);
}

function loadQrImage(token) {
  qrImageError.hidden = true;
  qrImage.hidden = false;
  qrImage.src = `/api/qr/${token}/image?t=${Date.now()}`;
}

qrImage.addEventListener("error", () => {
  qrImage.hidden = true;
  qrImageError.hidden = false;
});

btnRetryImage.addEventListener("click", () => {
  if (currentToken) loadQrImage(currentToken);
});

// ---- Create ----

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createUrlError.textContent = "";
  createExpiresError.textContent = "";
  createUrlInput.removeAttribute("aria-invalid");

  const url = createUrlInput.value.trim();
  if (!isHttpUrl(url)) {
    createUrlError.textContent = "Enter a full http:// or https:// URL.";
    createUrlInput.setAttribute("aria-invalid", "true");
    createUrlInput.focus();
    return;
  }

  setLoading(createSubmit, true, "Creating…", "Create QR code");
  try {
    const res = await fetch("/api/qr/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, expires_at: toIsoOrNull(createExpiresInput.value) }),
    });
    const data = await parseResponse(res);

    const info = await parseResponse(await fetch(`/api/qr/${data.token}`));
    renderDetails(info);
    announce("QR code created.");
    createForm.reset();
    detailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    createUrlError.textContent = err.message;
  } finally {
    setLoading(createSubmit, false, "Creating…", "Create QR code");
  }
});

// ---- Copy / download ----

btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultShortUrl.value);
    copyFeedback.textContent = "Copied!";
  } catch {
    resultShortUrl.select();
    copyFeedback.textContent = "Couldn't copy automatically — selected for manual copy.";
  }
  setTimeout(() => (copyFeedback.textContent = ""), 3000);
});

// ---- Edit toggle ----

btnToggleEdit.addEventListener("click", () => {
  analyticsPanel.hidden = true;
  editPanel.hidden = !editPanel.hidden;
});

btnCancelEdit.addEventListener("click", () => {
  editPanel.hidden = true;
});

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateUrlError.textContent = "";
  updateUrlInput.removeAttribute("aria-invalid");

  if (!currentToken) return;

  const payload = {};
  const url = updateUrlInput.value.trim();
  if (url) {
    if (!isHttpUrl(url)) {
      updateUrlError.textContent = "Enter a full http:// or https:// URL.";
      updateUrlInput.setAttribute("aria-invalid", "true");
      updateUrlInput.focus();
      return;
    }
    payload.url = url;
  }
  const expiresIso = toIsoOrNull(updateExpiresInput.value);
  if (expiresIso) payload.expires_at = expiresIso;

  setLoading(updateSubmit, true, "Saving…", "Save changes");
  try {
    const res = await fetch(`/api/qr/${currentToken}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseResponse(res);
    renderDetails(data);
    announce("Destination updated.");
  } catch (err) {
    updateUrlError.textContent = err.message;
  } finally {
    setLoading(updateSubmit, false, "Saving…", "Save changes");
  }
});

// ---- Analytics ----

btnToggleAnalytics.addEventListener("click", async () => {
  editPanel.hidden = true;
  const opening = analyticsPanel.hidden;
  analyticsPanel.hidden = !analyticsPanel.hidden;
  if (opening && currentToken) {
    await loadAnalytics(currentToken);
  }
});

async function loadAnalytics(token) {
  analyticsError.textContent = "";
  analyticsContent.hidden = true;
  analyticsLoading.hidden = false;

  try {
    const data = await parseResponse(await fetch(`/api/qr/${token}/analytics`));
    statTotalScans.textContent = data.total_scans.toLocaleString();

    const days = [...data.scans_by_day].sort((a, b) => (a.date < b.date ? -1 : 1));
    scansChart.innerHTML = "";
    analyticsEmpty.hidden = days.length > 0;
    scansChart.setAttribute(
      "aria-label",
      days.length ? `Scans by day: ${days.map((d) => `${d.date}, ${d.count}`).join("; ")}` : "No scans recorded"
    );

    const maxCount = Math.max(1, ...days.map((d) => d.count));
    for (const day of days) {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.title = `${day.count} scan${day.count === 1 ? "" : "s"} on ${day.date}`;

      const label = document.createElement("span");
      label.className = "bar-date";
      label.textContent = day.date;

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${Math.max(4, (day.count / maxCount) * 100)}%`;
      track.appendChild(fill);

      const value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = day.count;

      row.append(label, track, value);
      scansChart.appendChild(row);
    }

    analyticsContent.hidden = false;
  } catch (err) {
    analyticsError.textContent = err.message;
  } finally {
    analyticsLoading.hidden = true;
  }
}

// ---- Delete ----

btnOpenDelete.addEventListener("click", () => {
  deleteDialog.showModal();
});

btnConfirmDelete.addEventListener("click", async () => {
  if (!currentToken) return;
  btnConfirmDelete.disabled = true;
  try {
    await parseResponse(await fetch(`/api/qr/${currentToken}`, { method: "DELETE" }));
    const info = await parseResponse(await fetch(`/api/qr/${currentToken}`).catch(() => null));
    renderDetails(info);
    announce("QR code deleted.");
  } catch {
    // Even a 404-on-reload still means the delete succeeded; reflect the
    // deleted state locally so the UI doesn't appear to hang.
    if (currentMapping) {
      renderDetails({ ...currentMapping, is_deleted: true });
      announce("QR code deleted.");
    }
  } finally {
    btnConfirmDelete.disabled = false;
    deleteDialog.close();
  }
});

// ---- Lookup existing token ----

lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await loadToken(lookupTokenInput.value.trim(), lookupError, lookupSubmit, lookupTokenInput);
});

async function loadToken(token, errorEl, submitBtn, inputEl) {
  errorEl.textContent = "";
  if (!token) {
    errorEl.textContent = "Enter a token first.";
    inputEl?.focus();
    return;
  }

  if (submitBtn) setLoading(submitBtn, true, "Loading…", "Load");
  try {
    const info = await parseResponse(await fetch(`/api/qr/${token}`));
    renderDetails(info);
    announce("QR code loaded.");
    detailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    if (submitBtn) setLoading(submitBtn, false, "Loading…", "Load");
  }
}

// ---- Boot: restore token from URL or session ----

(function init() {
  const fromQuery = new URLSearchParams(location.search).get("token");
  const fromSession = sessionStorage.getItem("qr_last_token");
  const token = fromQuery || fromSession;
  if (token) {
    lookupTokenInput.value = token;
    loadToken(token, lookupError, null, null);
  }
})();
