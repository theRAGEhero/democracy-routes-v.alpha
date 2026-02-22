const activeRoomsListEl = document.getElementById("activeRoomsList");
const ingestListEl = document.getElementById("ingestList");
const recordingsListEl = document.getElementById("recordingsList");
const mergedSessionsListEl = document.getElementById("mergedSessionsList");
const transcriptViewerEl = document.getElementById("transcriptViewer");

const refreshAdminBtn = document.getElementById("refreshAdmin");
const refreshRecordingsBtn = document.getElementById("refreshRecordings");
const selectAllRecordingsBtn = document.getElementById("selectAllRecordings");
const deleteSelectedRecordingsBtn = document.getElementById("deleteSelectedRecordings");
const clearTranscriptViewerBtn = document.getElementById("clearTranscriptViewer");

let recordingsItems = [];
let adminRooms = [];
let adminIngest = [];
const selectedRecordingKeys = new Set();

function recordingKey(item) {
  return `${item.roomId}::${item.sessionId}`;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const precision = idx === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[idx]}`;
}

function renderAdminStatus() {
  activeRoomsListEl.innerHTML = "";
  ingestListEl.innerHTML = "";

  if (!adminRooms.length) {
    const li = document.createElement("li");
    li.textContent = "No active rooms";
    activeRoomsListEl.appendChild(li);
  } else {
    adminRooms.forEach((room) => {
      const li = document.createElement("li");
      const peers = Array.isArray(room.peers) ? room.peers : [];
      const peerNames = peers.map((p) => `${p.name || p.peerId} (${p.peerId})`).join(", ");
      li.textContent = `${room.roomId} | peers:${room.peerCount} | rec:${
        room.recordingEnabled ? `on (${room.recordingOwnerPeerId || "unknown"})` : "off"
      }${peerNames ? ` | ${peerNames}` : ""}`;
      activeRoomsListEl.appendChild(li);
    });
  }

  if (!adminIngest.length) {
    const li = document.createElement("li");
    li.textContent = "No ingest sessions";
    ingestListEl.appendChild(li);
  } else {
    adminIngest.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.active ? "ACTIVE" : "idle"} | room:${s.roomId} | client:${s.peerId} | session:${s.sessionId} | chunks:${s.chunks} | bytes:${formatBytes(
        s.bytes
      )}`;
      ingestListEl.appendChild(li);
    });
  }
}

async function loadAdminStatus() {
  const response = await fetch(withBasePath("/api/admin/status"));
  const data = await response.json();
  adminRooms = Array.isArray(data.rooms) ? data.rooms : [];
  adminIngest = Array.isArray(data.ingest) ? data.ingest : [];
  renderAdminStatus();
}

function renderRecordings() {
  recordingsListEl.innerHTML = "";

  if (!recordingsItems.length) {
    const li = document.createElement("li");
    li.textContent = "No recordings yet";
    recordingsListEl.appendChild(li);
    renderMergedSessions();
    deleteSelectedRecordingsBtn.disabled = true;
    selectAllRecordingsBtn.disabled = true;
    return;
  }

  for (const item of recordingsItems) {
    const key = recordingKey(item);
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedRecordingKeys.has(key);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedRecordingKeys.add(key);
      else selectedRecordingKeys.delete(key);
      deleteSelectedRecordingsBtn.disabled = selectedRecordingKeys.size === 0;
    });

    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("strong");
    title.textContent = `${item.roomId} / ${item.sessionId}`;
    const subtitle = document.createElement("span");
    subtitle.textContent = `${formatBytes(item.bytes)} | ${new Date(item.updatedAt).toLocaleString()}`;
    meta.appendChild(title);
    meta.appendChild(subtitle);

    const open = document.createElement("a");
    open.target = "_blank";
    open.rel = "noreferrer";
    open.href = withBasePath(`/api/recordings/file?roomId=${encodeURIComponent(item.roomId)}&sessionId=${encodeURIComponent(item.sessionId)}`);
    open.textContent = "Open";

    const openTranscript = document.createElement("button");
    openTranscript.textContent = "Transcript";
    openTranscript.disabled = !item.transcriptExists;
    openTranscript.addEventListener("click", async () => {
      await loadTranscript(item.roomId, item.sessionId);
    });

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await deleteItems([{ roomId: item.roomId, sessionId: item.sessionId }]);
    });

    li.appendChild(checkbox);
    li.appendChild(meta);
    li.appendChild(open);
    li.appendChild(openTranscript);
    li.appendChild(del);
    recordingsListEl.appendChild(li);
  }

  deleteSelectedRecordingsBtn.disabled = selectedRecordingKeys.size === 0;
  selectAllRecordingsBtn.disabled = false;
  renderMergedSessions();
}

function renderMergedSessions() {
  mergedSessionsListEl.innerHTML = "";
  const mergedItems = recordingsItems
    .filter((item) => Array.isArray(item.mergedFromSessionIds) && item.mergedFromSessionIds.length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (!mergedItems.length) {
    const li = document.createElement("li");
    li.textContent = "No merged sessions found";
    mergedSessionsListEl.appendChild(li);
    return;
  }

  for (const item of mergedItems) {
    const li = document.createElement("li");
    const sourceList = item.mergedFromSessionIds.join(", ");
    li.textContent = `${item.roomId} / ${item.sessionId} | sources:${item.mergedFromSessionIds.length} | ${sourceList}`;
    mergedSessionsListEl.appendChild(li);
  }
}

async function loadTranscript(roomId, sessionId) {
  transcriptViewerEl.textContent = "Loading transcript...";
  try {
    const response = await fetch(withBasePath(`/api/recordings/transcript?roomId=${encodeURIComponent(roomId)}&sessionId=${encodeURIComponent(sessionId)}`));
    const text = await response.text();
    if (!response.ok) {
      transcriptViewerEl.textContent = `Transcript not available (${response.status}): ${text}`;
      return;
    }
    transcriptViewerEl.textContent = text;
  } catch (error) {
    transcriptViewerEl.textContent = `Transcript load failed: ${String(error)}`;
  }
}

async function loadRecordings() {
  const response = await fetch(withBasePath("/api/recordings"));
  const data = await response.json();
  recordingsItems = Array.isArray(data.items) ? data.items : [];

  const validKeys = new Set(recordingsItems.map((item) => recordingKey(item)));
  for (const key of [...selectedRecordingKeys]) {
    if (!validKeys.has(key)) selectedRecordingKeys.delete(key);
  }
  renderRecordings();
}

async function deleteItems(items) {
  await fetch(withBasePath("/api/recordings"), {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items })
  });
  selectedRecordingKeys.clear();
  await loadRecordings();
  await loadAdminStatus();
}

function toggleSelectAllRecordings() {
  if (!recordingsItems.length) return;
  if (selectedRecordingKeys.size === recordingsItems.length) {
    selectedRecordingKeys.clear();
  } else {
    recordingsItems.forEach((item) => selectedRecordingKeys.add(recordingKey(item)));
  }
  renderRecordings();
}

async function deleteSelectedRecordings() {
  const items = recordingsItems
    .filter((item) => selectedRecordingKeys.has(recordingKey(item)))
    .map((item) => ({ roomId: item.roomId, sessionId: item.sessionId }));
  if (!items.length) return;
  await deleteItems(items);
}

refreshAdminBtn.addEventListener("click", () => loadAdminStatus());
refreshRecordingsBtn.addEventListener("click", () => loadRecordings());
selectAllRecordingsBtn.addEventListener("click", () => toggleSelectAllRecordings());
deleteSelectedRecordingsBtn.addEventListener("click", () => deleteSelectedRecordings());
clearTranscriptViewerBtn.addEventListener("click", () => {
  transcriptViewerEl.textContent = "Select a recording transcript to view it here.";
});

Promise.all([loadAdminStatus(), loadRecordings()]).catch((error) => {
  console.error(error);
});
setInterval(() => {
  loadAdminStatus().catch(() => null);
}, 5000);
