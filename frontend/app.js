const state = {
  meta: null,
  dashboard: null,
  trends: null,
  network: null,
  correlations: null,
  selectedDistrictId: null,
  selectedStationId: null,
  selectedHour: null,
  days: 365,
  map: null,
  mapLayer: null,
  graph: null,
};

const els = {
  districtSelect: document.getElementById('districtSelect'),
  stationSelect: document.getElementById('stationSelect'),
  hourSlider: document.getElementById('hourSlider'),
  hourLabel: document.getElementById('hourLabel'),
  windowSlider: document.getElementById('windowSlider'),
  windowLabel: document.getElementById('windowLabel'),
  refreshButton: document.getElementById('refreshButton'),
  resetButton: document.getElementById('resetButton'),
  statusText: document.getElementById('statusText'),
  statCards: document.getElementById('statCards'),
  districtTree: document.getElementById('districtTree'),
  hotspotList: document.getElementById('hotspotList'),
  alertList: document.getElementById('alertList'),
  timelineBars: document.getElementById('timelineBars'),
  graphCanvas: document.getElementById('graphCanvas'),
  repeatOffenderList: document.getElementById('repeatOffenderList'),
  riskOutput: document.getElementById('riskOutput'),
  anomalyOutput: document.getElementById('anomalyOutput'),
  occupationInsights: document.getElementById('occupationInsights'),
  occupationTable: document.getElementById('occupationTable'),
  questionInput: document.getElementById('questionInput'),
  askButton: document.getElementById('askButton'),
  nlqAnswer: document.getElementById('nlqAnswer'),
  nlqQuery: document.getElementById('nlqQuery'),
  nlqRows: document.getElementById('nlqRows'),
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(toNumber(value, 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ======================================================
// Production Backend Configuration - UPDATED
// ======================================================
const BASE_URL = 'https://ksp-backend-50043682310.development.catalystappsail.in';

// ======================================================
// Common API Helper
// ======================================================
async function api(path, options = {}) {
  const url = path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown Error");
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching path [${path}]:`, error);
    const statusIndicator = document.getElementById("statusText");
    if (statusIndicator) {
      statusIndicator.innerText = "Connection error. Retrying...";
      statusIndicator.style.background = "var(--theme-warn, #ffaa00)";
    }
    throw error;
  }
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function syncLabels() {
  els.windowLabel.textContent = `${state.days} days`;
  els.hourLabel.textContent = state.selectedHour === null ? 'All day' : `${String(state.selectedHour).padStart(2, '0')}:00`;
}

function findDistrictName(districtId) {
  const district = state.meta?.districts?.find((item) => Number(item.districtId) === Number(districtId));
  return district?.districtName || `District ${districtId}`;
}

function renderStatCards(payload) {
  const totals = payload.totals || {};
  const cards = [
    ['Cases', totals.cases],
    ['Districts', totals.districts],
    ['Stations', totals.stations],
    ['Hotspots', totals.hotspots],
    ['Alerts', totals.alerts],
    ['Window', `${payload.windowDays || state.days} days`],
  ];
  els.statCards.innerHTML = cards.map(([label, value]) => `
    <article class="stat-card">
      <div class="stat-value">${typeof value === 'number' ? formatNumber(value) : escapeHtml(value)}</div>
      <div class="stat-label">${escapeHtml(label)}</div>
    </article>
  `).join('');
}

function renderTimeline(series) {
  const values = Array.from({ length: 24 }, (_, index) => series.find((item) => Number(item[0]) === index)?.[1] || 0);
  const maxValue = Math.max(...values, 1);
  els.timelineBars.innerHTML = values.map((value, hour) => {
    const height = Math.max(18, Math.round((value / maxValue) * 120));
    const cls = value > maxValue * 0.65 ? 'timeline-bar high' : 'timeline-bar';
    return `<div class="${cls}" style="height:${height}px"><span>${hour}</span></div>`;
  }).join('');
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    els.alertList.innerHTML = '<div class="muted">No red-zone alerts in the selected window.</div>';
    return;
  }
  els.alertList.innerHTML = alerts.slice(0, 12).map((alert) => `
    <article class="alert-card ${escapeHtml(alert.severity || 'high')}">
      <strong>${escapeHtml(alert.districtName || 'Unknown')} - ${escapeHtml(alert.stationName || 'Station')}</strong>
      <div class="muted">${escapeHtml(alert.crimeName || 'Unknown')}</div>
      <div>Observed ${formatNumber(alert.observedCount)} vs expected ${formatNumber(alert.expectedCount)} | z=${escapeHtml(alert.zScore ?? 0)}</div>
    </article>
  `).join('');
}

function renderHotspots(hotspots) {
  if (!hotspots.length) {
    els.hotspotList.innerHTML = '<div class="muted">No hotspot crossed the computed threshold.</div>';
    return;
  }
  els.hotspotList.innerHTML = hotspots.slice(0, 6).map((hotspot) => `
    <article class="compact-card">
      <strong>${escapeHtml(hotspot.districtName || 'Unknown')} | Hour ${escapeHtml(hotspot.hour)}</strong>
      <div class="muted">${escapeHtml(hotspot.topCrimeType || 'Unknown')} | ${formatNumber(hotspot.caseCount)} cases</div>
      <div>Severity ${escapeHtml(hotspot.severity ?? 0)}</div>
    </article>
  `).join('');
}

function renderDistrictTree(nodeList) {
  const renderNode = (node) => {
    const children = node.children || [];
    const stationChildren = children.filter((child) => Number(child.typeId) === 1);
    const nonStationChildren = children.filter((child) => Number(child.typeId) !== 1);
    const childMarkup = [...nonStationChildren, ...stationChildren].map(renderNode).join('');
    const stationCount = node.stationCount || stationChildren.length;
    const label = `${escapeHtml(node.unitName)} <span class="muted">(${formatNumber(stationCount)} stations)</span>`;
    if (Number(node.typeId) === 2) {
      return `
        <details>
          <summary>
            <button type="button" class="tree-action" data-district="${escapeHtml(node.districtId || '')}">${label}</button>
          </summary>
          ${childMarkup}
        </details>
      `;
    }
    if (Number(node.typeId) === 1) {
      return `<button type="button" class="tree-leaf" data-district="${escapeHtml(node.districtId || '')}" data-station="${escapeHtml(node.unitId || '')}">${escapeHtml(node.unitName)}</button>`;
    }
    return `
      <details>
        <summary>${escapeHtml(node.unitName)} <span class="muted">${escapeHtml(node.typeName || '')}</span></summary>
        ${childMarkup}
      </details>
    `;
  };
  els.districtTree.innerHTML = nodeList.map(renderNode).join('');
  els.districtTree.querySelectorAll('[data-district]').forEach((button) => {
    button.addEventListener('click', () => {
      const districtId = button.getAttribute('data-district');
      const stationId = button.getAttribute('data-station');
      if (districtId) {
        els.districtSelect.value = districtId;
        state.selectedDistrictId = Number(districtId);
        if (stationId) {
          state.selectedStationId = Number(stationId);
        }
        syncStationOptions();
        refreshAll();
      }
    });
  });
}

function syncStationOptions() {
  const stations = (state.meta?.stations || []).filter((station) => !state.selectedDistrictId || Number(station.districtId) === Number(state.selectedDistrictId));
  els.stationSelect.innerHTML = ['<option value="">All stations</option>']
    .concat(stations.map((station) => `<option value="${escapeHtml(station.stationId)}">${escapeHtml(station.stationName)}${station.districtName ? ` - ${escapeHtml(station.districtName)}` : ''}</option>`))
    .join('');
  if (state.selectedStationId && stations.some((station) => Number(station.stationId) === Number(state.selectedStationId))) {
    els.stationSelect.value = String(state.selectedStationId);
  } else {
    els.stationSelect.value = '';
    state.selectedStationId = null;
  }
}

function buildMarkerHtml(kind, value) {
  const label = value > 9 ? '9+' : String(value);
  return `<div class="pulse-dot ${kind}" data-label="${escapeHtml(label)}" style="--size:${kind === 'alert' ? 32 : kind === 'hotspot' ? 26 : 20}px"></div>`;
}

function initMap() {
  if (state.map) {
    return;
  }
  state.map = L.map('mapCanvas', { zoomControl: true, preferCanvas: true }).setView([15.3173, 75.7139], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(state.map);
  state.mapLayer = L.layerGroup().addTo(state.map);
}

function nearestAlertFor(payload, districtId, stationId, hour) {
  return (payload.alerts || []).find((alert) => Number(alert.districtId) === Number(districtId) && (!stationId || Number(alert.stationId) === Number(stationId)))
    || (payload.hotspots || []).find((hotspot) => Number(hotspot.districtId) === Number(districtId) && (hour === null || String(hotspot.hour) === String(hour)));
}

function renderMap(payload) {
  initMap();
  state.mapLayer.clearLayers();

  const grouped = new Map();
  const filteredMarkers = (payload.markers || []).filter((marker) => {
    if (state.selectedDistrictId && Number(marker.districtId) !== Number(state.selectedDistrictId)) return false;
    if (state.selectedStationId && Number(marker.stationId) !== Number(state.selectedStationId)) return false;
    return true;
  });

  for (const marker of filteredMarkers) {
    if (marker.latitude === null || marker.longitude === null || marker.latitude === undefined || marker.longitude === undefined) continue;
    const key = state.selectedDistrictId ? String(marker.stationId || marker.caseId) : String(marker.districtId || marker.caseId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(marker);
  }

  const bounds = [];
  grouped.forEach((items) => {
    const latitude = items.reduce((sum, item) => sum + Number(item.latitude), 0) / items.length;
    const longitude = items.reduce((sum, item) => sum + Number(item.longitude), 0) / items.length;
    const first = items[0];
    const matchedAlert = nearestAlertFor(payload, first.districtId, first.stationId, state.selectedHour);
    const kind = matchedAlert ? 'alert' : (payload.hotspots || []).some((hotspot) => Number(hotspot.districtId) === Number(first.districtId)) ? 'hotspot' : 'normal';
    const marker = L.marker([latitude, longitude], {
      icon: L.divIcon({
        html: buildMarkerHtml(kind, items.length),
        className: 'custom-map-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(state.mapLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(first.districtName || 'Unknown')}</strong><br>
      ${escapeHtml(first.stationName || 'Station')}<br>
      ${formatNumber(items.length)} cases<br>
      ${escapeHtml(first.crimeName || 'Unknown')}
    `);
    bounds.push([latitude, longitude]);
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: state.selectedDistrictId ? 11 : 8 });
  }
}

function renderRepeatOffenders(networkPayload) {
  const offenders = (networkPayload.repeatOffenders || []).slice(0, 8);
  if (!offenders.length) {
    els.repeatOffenderList.innerHTML = '<div class="muted">No repeat-offender pattern was identified in the selected slice.</div>';
    return;
  }
  els.repeatOffenderList.innerHTML = offenders.map((offender) => `
    <article class="repeat-card">
      <strong>${escapeHtml(offender.name || offender.personId)}</strong>
      <div class="muted">Specialty: ${escapeHtml(offender.specialtyCrime || 'Unknown')} | Cases: ${formatNumber(offender.caseCount)}</div>
      <div class="muted">Districts: ${escapeHtml((offender.districts || []).map((item) => item.districtName).join(', ') || 'Unknown')}</div>
      <div class="muted">Stations: ${escapeHtml((offender.stations || []).map((item) => item.stationName).join(', ') || 'Unknown')}</div>
    </article>
  `).join('');
}

function renderNetwork(networkPayload) {
  const nodes = (networkPayload.nodes || []).map((node) => {
    const palette = {
      offender: '#46c7c7',
      victim: '#f3b54a',
      station: '#65d08b',
      location: '#9dd2ff',
    };
    return {
      ...node,
      color: palette[node.type] || '#9dd2ff',
      font: { color: '#f4f7fb', face: 'Space Grotesk' },
      shape: node.type === 'station' ? 'box' : 'dot',
      margin: 8,
    };
  });
  const edges = (networkPayload.edges || []).map((edge) => ({
    ...edge,
    color: edge.type === 'coaccused' ? 'rgba(244, 98, 98, 0.72)' : 'rgba(70, 199, 199, 0.5)',
    width: Math.max(1, Math.min(6, edge.value || 1)),
    arrows: '',
  }));
  const container = els.graphCanvas;
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const options = {
    physics: { stabilization: false, barnesHut: { gravitationalConstant: -4200, springLength: 160, springConstant: 0.02 } },
    interaction: { hover: true, multiselect: true },
    edges: { smooth: { type: 'dynamic' } },
  };
  if (state.graph) {
    state.graph.setData(data);
    return;
  }
  state.graph = new vis.Network(container, data, options);
}

function renderCorrelations(correlationPayload) {
  const insights = correlationPayload.insights || [];
  els.occupationInsights.innerHTML = insights.length
    ? insights.map((text) => `<article class="mini-card"><div class="text-block">${escapeHtml(text)}</div></article>`).join('')
    : '<div class="muted">No occupation correlation signal available in the selected window.</div>';

  const rows = correlationPayload.occupationHeatmap || [];
  if (!rows.length) {
    els.occupationTable.innerHTML = '<div class="muted">No occupation rows available for the selected filters.</div>';
    return;
  }

  const topRows = rows.slice(0, 8);
  els.occupationTable.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Occupation</th><th>Cases</th><th>Top crimes</th><th>Top districts</th></tr>
        </thead>
        <tbody>
          ${topRows.map((row) => `
            <tr>
              <td>${escapeHtml(row.occupation)}</td>
              <td>${formatNumber(row.caseCount)}</td>
              <td>${escapeHtml((row.topCrimeTypes || []).map((item) => item.crimeName).join(', '))}</td>
              <td>${escapeHtml((row.topDistricts || []).map((item) => item.districtName).join(', '))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderQuickML(box, payload) {
  if (payload?.error) {
    box.textContent = JSON.stringify(payload, null, 2);
    return;
  }
  box.textContent = JSON.stringify(payload, null, 2);
}

function renderNlq(payload) {
  if (payload.error) {
    els.nlqAnswer.textContent = payload.error;
    els.nlqQuery.textContent = payload.query || 'No query generated.';
    els.nlqRows.innerHTML = `<div class="muted">${escapeHtml(payload.error)}</div>`;
    return;
  }

  els.nlqAnswer.textContent = payload.answer || 'No answer returned.';
  els.nlqQuery.textContent = payload.query || 'No query generated.';

  const rows = payload.rows || [];
  if (!rows.length) {
    els.nlqRows.innerHTML = '<div class="muted">The query returned no rows.</div>';
    return;
  }

  const columns = Object.keys(rows[0]).slice(0, 8);
  els.nlqRows.innerHTML = `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.slice(0, 12).map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function fetchDashboard() {
  const params = new URLSearchParams();
  if (state.selectedDistrictId) params.set('district_id', state.selectedDistrictId);
  if (state.selectedHour !== null) params.set('hour', state.selectedHour);
  params.set('days', state.days);
  return api(`/api/dashboard?${params.toString()}`);
}

async function fetchTrends() {
  const params = new URLSearchParams();
  if (state.selectedDistrictId) params.set('district_id', state.selectedDistrictId);
  params.set('days', state.days);
  return api(`/api/trends?${params.toString()}`);
}

async function fetchNetwork() {
  const params = new URLSearchParams();
  if (state.selectedDistrictId) params.set('district_id', state.selectedDistrictId);
  return api(`/api/network?${params.toString()}`);
}

async function fetchCorrelations() {
  const params = new URLSearchParams();
  if (state.selectedDistrictId) params.set('district_id', state.selectedDistrictId);
  params.set('days', state.days);
  return api(`/api/correlations?${params.toString()}`);
}

async function fetchQuickML(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

function syncDistrictSelection() {
  state.selectedDistrictId = els.districtSelect.value ? Number(els.districtSelect.value) : null;
  syncStationOptions();
}

function syncStationSelection() {
  state.selectedStationId = els.stationSelect.value ? Number(els.stationSelect.value) : null;
}

async function refreshAll() {
  try {
    setStatus('Loading analytics...');
    syncLabels();
    const [dashboard, trends, network, correlations, risk, anomaly] = await Promise.all([
      fetchDashboard(),
      fetchTrends(),
      fetchNetwork(),
      fetchCorrelations(),
      fetchQuickML('/api/ml/risk', { district_id: state.selectedDistrictId, days: state.days }),
      fetchQuickML('/api/ml/anomaly', { district_id: state.selectedDistrictId, days: state.days }),
    ]);

    state.dashboard = dashboard;
    state.trends = trends;
    state.network = network;
    state.correlations = correlations;

    renderStatCards(dashboard);
    renderDistrictTree(state.meta?.unitTree || []);
    renderHotspots(dashboard.hotspots || []);
    renderAlerts(dashboard.alerts || []);
    renderTimeline(dashboard.summary?.hourCounts || []);
    renderMap(dashboard);
    renderNetwork(network);
    renderRepeatOffenders(network);
    renderCorrelations(correlations);
    renderQuickML(els.riskOutput, risk);
    renderQuickML(els.anomalyOutput, anomaly);
    setStatus(`Loaded ${findDistrictName(state.selectedDistrictId)}`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
    console.error(error);
  }
}

async function runNlq() {
  const question = els.questionInput.value.trim();
  if (!question) {
    els.nlqAnswer.textContent = 'Type a question first.';
    return;
  }
  els.askButton.disabled = true;
  els.askButton.textContent = 'Running...';
  try {
    const result = await api('/api/nlq', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
    renderNlq(result);
  } catch (error) {
    renderNlq({ error: error.message });
  } finally {
    els.askButton.disabled = false;
    els.askButton.textContent = 'Run query';
  }
}

async function bootstrap() {
  syncLabels();
  els.questionInput.value = 'Show me theft cases in Bengaluru last month';
  
  state.meta = await api('/api/meta?district_id=0');
  
  els.districtSelect.innerHTML = ['<option value="0">All districts</option>']
    .concat((state.meta.districts || []).map((district) => {
      const id = district.district_id || district.districtId || "";
      const name = district.district_name || district.districtName || "";
      return `<option value="${escapeHtml(id.toString())}">${escapeHtml(name)}</option>`;
    }))
    .join('');
    
  renderDistrictTree(state.meta.unitTree || []);
  syncStationOptions();
  await refreshAll();
}

// Event Listeners
els.districtSelect.addEventListener('change', async () => {
  syncDistrictSelection();
  await refreshAll();
});

els.stationSelect.addEventListener('change', async () => {
  syncStationSelection();
  await refreshAll();
});

els.hourSlider.addEventListener('input', async () => {
  state.selectedHour = Number(els.hourSlider.value) === 24 ? null : Number(els.hourSlider.value);
  syncLabels();
  await refreshAll();
});

els.windowSlider.addEventListener('input', async () => {
  state.days = Number(els.windowSlider.value);
  syncLabels();
  await refreshAll();
});

els.refreshButton.addEventListener('click', refreshAll);

els.resetButton.addEventListener('click', async () => {
  state.selectedDistrictId = null;
  state.selectedStationId = null;
  state.selectedHour = null;
  state.days = 180;
  els.districtSelect.value = '0';
  els.stationSelect.value = '';
  els.hourSlider.value = 24;
  els.windowSlider.value = 365;
  syncLabels();
  syncStationOptions();
  await refreshAll();
});

els.askButton.addEventListener('click', runNlq);
els.questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    runNlq();
  }
});

// Start the application
bootstrap().catch((error) => {
  setStatus(`Startup failed: ${error.message}`);
  console.error(error);
});