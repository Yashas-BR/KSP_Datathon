const state = {
  meta: null,
  dashboard: null,
  trends: null,
  network: null,
  correlations: null,
  socioPredictive: null,
  selectedDistrictId: null,
  selectedStationId: null,
  selectedHour: null,
  days: 365,
  quickPreset: 'none',
  topDistrictIds: [],
  districtLabelToId: new Map(),
  stationLabelToInfo: new Map(),
  compareMode: false,
  compareDistrictA: null,
  compareDistrictB: null,
  map: null,
  mapLayer: null,
  heatLayer: null,
  mapViewMode: 'markers', // 'markers' | 'heatmap'
  graph: null,
  showRawRiskJson: false,
  showRawAnomalyJson: false,
  currentBrowserStationName: '',
  currentBrowserCases: [],
};

const els = {
  districtSelect: document.getElementById('districtSelect'),
  districtSearch: document.getElementById('districtSearch'),
  districtOptions: document.getElementById('districtOptions'),
  stationSelect: document.getElementById('stationSelect'),
  hourSlider: document.getElementById('hourSlider'),
  hourLabel: document.getElementById('hourLabel'),
  hourBands: document.getElementById('hourBands'),
  windowSlider: document.getElementById('windowSlider'),
  windowLabel: document.getElementById('windowLabel'),
  windowPresets: document.getElementById('windowPresets'),
  quickPresets: document.getElementById('quickPresets'),
  compareToggle: document.getElementById('compareToggle'),
  comparePicks: document.getElementById('comparePicks'),
  compareDistrictA: document.getElementById('compareDistrictA'),
  compareDistrictB: document.getElementById('compareDistrictB'),
  comparePanel: document.getElementById('comparePanel'),
  compareGrid: document.getElementById('compareGrid'),
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
  copyQueryBtn: document.getElementById('copyQueryBtn'),
  caseBrowserModal: document.getElementById('caseBrowserModal'),
  caseBrowserTitle: document.getElementById('caseBrowserTitle'),
  closeCaseBrowserBtn: document.getElementById('closeCaseBrowserBtn'),
  modalCaseSearch: document.getElementById('modalCaseSearch'),
  caseCountBadge: document.getElementById('caseCountBadge'),
  caseListContent: document.getElementById('caseListContent'),
  // Strategic Intelligence Hub
  sihStatus: document.getElementById('sihStatus'),
  sihInsights: document.getElementById('sihInsights'),
  socioCorrelationPanel: document.getElementById('socioCorrelationPanel'),
  predictiveRiskPanel: document.getElementById('predictiveRiskPanel'),
  anomalyDetectionPanel: document.getElementById('anomalyDetectionPanel'),
};

const svgIcons = {
  cases: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  districts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  stations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 21V10M18 21V10M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4M12 3L2 7h20L12 3z"/></svg>`,
  hotspots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  alerts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  window: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(toNumber(value, 0));
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const BASE_URL = (window.BACKEND_URL || window.location.origin || '').replace(/\/$/, '');

// API Fetch Helper
async function api(path, options = {}) {
  const url = path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
  const body = options.body;
  const payload = body === undefined
    ? undefined
    : (typeof body === 'string' ? body : JSON.stringify(body));

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: payload,
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
    }
    throw error;
  }
}

function setStatus(message) {
  if (els.statusText) {
    els.statusText.innerHTML = `<span class="live-dot"></span> ${escapeHtml(message)}`;
  }
}

function syncLabels() {
  els.windowLabel.textContent = `${state.days} days`;
  els.hourLabel.textContent = state.selectedHour === null ? 'All day' : `${String(state.selectedHour).padStart(2, '0')}:00`;
  renderHourBands();
}

function renderHourBands() {
  if (!els.hourBands) return;
  const peak = new Set([8, 9, 10, 18, 19, 20, 21, 22]);
  const selected = state.selectedHour;
  els.hourBands.innerHTML = Array.from({ length: 24 }, (_, hour) => {
    const isPeak = peak.has(hour);
    const isSelected = selected !== null && Number(selected) === hour;
    const cls = `${isPeak ? 'peak' : ''} ${isSelected ? 'selected' : ''}`.trim();
    return `<span class="hour-band ${cls}" title="${String(hour).padStart(2, '0')}:00"></span>`;
  }).join('');
}

function findDistrictName(districtId) {
  if (districtId === null || districtId === undefined || Number(districtId) === 0) {
    return 'All districts';
  }
  const district = state.meta?.districts?.find((item) => Number(item.districtId || item.district_id) === Number(districtId));
  return district?.districtName || district?.district_name || `District ${districtId}`;
}

function findStationName(stationId) {
  if (!stationId) return 'All stations';
  const station = state.meta?.stations?.find((item) => Number(item.stationId || item.station_id) === Number(stationId));
  return station?.stationName || station?.station_name || `Station ${stationId}`;
}

function parseDateFlexible(value) {
  if (!value) return null;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  const parsed = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWeekendDate(value) {
  const date = parseDateFlexible(value);
  if (!date) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function markerHour(marker) {
  if (marker.hour !== undefined && marker.hour !== null) {
    return Number(marker.hour);
  }
  if (!marker.registeredDate) return null;
  const date = parseDateFlexible(marker.registeredDate);
  if (!date) return null;
  return date.getHours();
}

function matchesQuickPreset(marker) {
  if (state.quickPreset === 'top10') {
    if (!state.topDistrictIds.length) return true;
    return state.topDistrictIds.includes(Number(marker.districtId));
  }
  if (state.quickPreset === 'weekend') {
    return isWeekendDate(marker.registeredDate);
  }
  if (state.quickPreset === 'night') {
    const hour = markerHour(marker);
    if (hour === null) return false;
    return hour >= 21 || hour <= 5;
  }
  return true;
}

function applyQuickPreset(preset) {
  state.quickPreset = preset;
  document.querySelectorAll('#quickPresets [data-preset]').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-preset') === preset);
  });
}

function renderStatCards(payload) {
  const allMarkers = payload.markers || [];
  const filteredMarkers = allMarkers.filter((marker) => {
    if (state.selectedDistrictId && Number(marker.districtId) !== Number(state.selectedDistrictId)) return false;
    if (state.selectedStationId && Number(marker.stationId) !== Number(state.selectedStationId)) return false;
    if (!matchesQuickPreset(marker)) return false;
    return true;
  });

  const rawTotals = payload.totals || {};
  const isFiltered = !!(state.selectedDistrictId || state.selectedStationId || state.quickPreset !== 'none' || state.selectedHour !== null);

  const casesValue = isFiltered ? filteredMarkers.length : rawTotals.cases;
  const districtsValue = state.selectedDistrictId
    ? 1
    : (isFiltered ? new Set(filteredMarkers.map(m => m.districtId).filter(Boolean)).size || 1 : rawTotals.districts);

  const stationsValue = state.selectedStationId
    ? 1
    : (state.selectedDistrictId
        ? (state.meta?.stations || []).filter(s => Number(s.districtId ?? s.district_id) === state.selectedDistrictId).length
        : (isFiltered ? new Set(filteredMarkers.map(m => m.stationId).filter(Boolean)).size : rawTotals.stations));

  const hotspotsValue = (payload.hotspots || []).filter(h => (!state.selectedDistrictId || Number(h.districtId) === state.selectedDistrictId) && (!state.selectedStationId || Number(h.stationId) === state.selectedStationId)).length;
  const alertsValue = (payload.alerts || []).filter(a => (!state.selectedDistrictId || Number(a.districtId) === state.selectedDistrictId) && (!state.selectedStationId || Number(a.stationId) === state.selectedStationId)).length;

  let activeScopeLabel = 'Statewide Jurisdiction';
  if (state.selectedStationId) {
    activeScopeLabel = `Scope: ${findStationName(state.selectedStationId)}`;
  } else if (state.selectedDistrictId) {
    activeScopeLabel = `Scope: ${findDistrictName(state.selectedDistrictId)}`;
  } else if (state.quickPreset !== 'none') {
    activeScopeLabel = `Preset: ${state.quickPreset}`;
  }

  const cardsConfig = [
    { key: 'cases', label: 'Registered Cases', value: casesValue, sub: activeScopeLabel, icon: svgIcons.cases },
    { key: 'districts', label: 'Districts Active', value: districtsValue, sub: state.selectedDistrictId ? 'Single District Filter' : 'All Districts Coverage', icon: svgIcons.districts },
    { key: 'stations', label: 'Police Stations', value: stationsValue, sub: state.selectedStationId ? 'Single Police Station' : 'Active Reporting Units', icon: svgIcons.stations },
    { key: 'hotspots', label: 'Spatiotemporal Hotspots', value: hotspotsValue, sub: 'Cluster Danger Zones', icon: svgIcons.hotspots },
    { key: 'alerts', label: 'Red-Zone Alerts', value: alertsValue, sub: 'Statistical Risk Surges', icon: svgIcons.alerts },
    { key: 'window', label: 'Trailing Window', value: `${payload.windowDays || state.days} Days`, sub: 'Real-Time Analytics', icon: svgIcons.window },
  ];

  els.statCards.innerHTML = cardsConfig.map((card) => `
    <article class="stat-card">
      <div class="stat-card-head">
        <div class="stat-card-icon">${card.icon}</div>
      </div>
      <div class="stat-value">${typeof card.value === 'number' ? formatNumber(card.value) : escapeHtml(card.value)}</div>
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-subtext">${escapeHtml(card.sub)}</div>
    </article>
  `).join('');
}

function renderTimeline(series) {
  const values = Array.from({ length: 24 }, (_, index) => series.find((item) => Number(item[0]) === index)?.[1] || 0);
  const maxValue = Math.max(...values, 1);
  els.timelineBars.innerHTML = values.map((value, hour) => {
    const height = Math.max(20, Math.round((value / maxValue) * 125));
    const cls = value > maxValue * 0.65 ? 'timeline-bar high' : 'timeline-bar';
    return `<div class="${cls}" style="height:${height}px" title="Hour ${hour}: ${value} cases"><span>${hour}</span></div>`;
  }).join('');
}

function renderAlerts(alerts) {
  const filteredAlerts = (alerts || []).filter(a => (!state.selectedDistrictId || Number(a.districtId) === state.selectedDistrictId) && (!state.selectedStationId || Number(a.stationId) === state.selectedStationId));
  if (!filteredAlerts.length) {
    els.alertList.innerHTML = '<div class="muted">No red-zone alerts triggered for active selection.</div>';
    return;
  }
  els.alertList.innerHTML = filteredAlerts.slice(0, 10).map((alert) => `
    <article class="alert-card ${escapeHtml(alert.severity || 'high')}">
      <strong>${escapeHtml(alert.districtName || 'Unknown')} • ${escapeHtml(alert.stationName || 'Station')}</strong>
      <div class="muted" style="margin-top:2px;">Category: ${escapeHtml(alert.crimeName || 'Crime')}</div>
      <div style="margin-top:6px; font-size:0.8rem;">
        Observed: <strong style="color:#ef4444;">${formatNumber(alert.observedCount)}</strong> vs expected ${formatNumber(alert.expectedCount)} (z = ${escapeHtml(alert.zScore ?? 0)})
      </div>
    </article>
  `).join('');
}

function renderHotspots(hotspots) {
  const filteredHotspots = (hotspots || []).filter(h => (!state.selectedDistrictId || Number(h.districtId) === state.selectedDistrictId) && (!state.selectedStationId || Number(h.stationId) === state.selectedStationId));
  if (!filteredHotspots.length) {
    els.hotspotList.innerHTML = '<div class="muted">No hotspots crossed the computed risk threshold.</div>';
    return;
  }
  els.hotspotList.innerHTML = filteredHotspots.slice(0, 6).map((hotspot) => `
    <article class="compact-card">
      <strong>${escapeHtml(hotspot.districtName || 'Unknown')} • Peak Hour ${escapeHtml(hotspot.hour)}:00</strong>
      <div class="muted" style="margin-top:2px;">${escapeHtml(hotspot.topCrimeType || 'Crime')} • ${formatNumber(hotspot.caseCount)} incidents</div>
      <div style="margin-top:4px; font-size:0.8rem; color:var(--accent-gold);">Risk Severity: ${escapeHtml(hotspot.severity ?? 0)}/100</div>
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
    const label = `${escapeHtml(node.unitName)} <span class="badge-tag">${formatNumber(stationCount)} PS</span>`;

    if (Number(node.typeId) === 2) {
      return `
        <details ${state.selectedDistrictId === Number(node.districtId) ? 'open' : ''}>
          <summary>
            <span>${label}</span>
            <button type="button" class="tree-action" data-district="${escapeHtml(node.districtId || '')}">Filter District</button>
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
        <summary><span>${escapeHtml(node.unitName)}</span> <span class="muted">${escapeHtml(node.typeName || '')}</span></summary>
        ${childMarkup}
      </details>
    `;
  };

  els.districtTree.innerHTML = nodeList.map(renderNode).join('');
  els.districtTree.querySelectorAll('[data-district]').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const districtId = button.getAttribute('data-district');
      const stationId = button.getAttribute('data-station');
      if (districtId) {
        state.selectedDistrictId = Number(districtId);
        els.districtSelect.value = String(state.selectedDistrictId);
        if (stationId) {
          state.selectedStationId = Number(stationId);
        } else {
          state.selectedStationId = null;
        }
        syncDistrictSearchInput();
        syncStationOptions();
        refreshAll();
      }
    });
  });
}

function syncStationOptions() {
  const stations = (state.meta?.stations || []).filter((station) => {
    const stationDistrictId = station.districtId ?? station.district_id;
    return !state.selectedDistrictId || Number(stationDistrictId) === Number(state.selectedDistrictId);
  });

  els.stationSelect.innerHTML = ['<option value="">All police stations</option>']
    .concat(stations.map((station) => {
      const stationId = station.stationId ?? station.station_id ?? '';
      const stationName = station.stationName ?? station.station_name ?? '';
      const districtName = station.districtName ?? station.district_name ?? '';
      return `<option value="${escapeHtml(String(stationId))}">${escapeHtml(stationName)}${districtName ? ` (${escapeHtml(districtName)})` : ''}</option>`;
    }))
    .join('');

  if (state.selectedStationId && stations.some((station) => Number(station.stationId ?? station.station_id) === Number(state.selectedStationId))) {
    els.stationSelect.value = String(state.selectedStationId);
  } else {
    els.stationSelect.value = '';
    state.selectedStationId = null;
  }
}

function syncDistrictSearchInput() {
  if (!els.districtSearch) return;
  if (!state.selectedDistrictId && !state.selectedStationId) {
    els.districtSearch.value = '';
    return;
  }
  if (state.selectedStationId) {
    els.districtSearch.value = findStationName(state.selectedStationId);
  } else if (state.selectedDistrictId) {
    els.districtSearch.value = findDistrictName(state.selectedDistrictId);
  }
}

function buildMarkerHtml(kind, value) {
  const label = value > 9 ? '9+' : String(value);
  return `<div class="pulse-dot ${kind}" data-label="${escapeHtml(label)}" style="--size:${kind === 'alert' ? 32 : kind === 'hotspot' ? 26 : 20}px"></div>`;
}

function initMap() {
  if (state.map) return;
  state.map = L.map('mapCanvas', { zoomControl: true, preferCanvas: true }).setView([15.3173, 75.7139], 7);

  // Base tile layers
  state._lightTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  });
  state._darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &amp; CARTO',
    maxZoom: 18,
  });
  state._lightTile.addTo(state.map);

  // Marker cluster layer
  if (typeof L.markerClusterGroup === 'function') {
    state.mapLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 12,
      maxClusterRadius: 50,
    }).addTo(state.map);
  } else {
    state.mapLayer = L.layerGroup().addTo(state.map);
  }

  // Heatmap layer (empty until data arrives)
  if (typeof L.heatLayer === 'function') {
    state.heatLayer = L.heatLayer([], {
      radius: 35,
      blur: 25,
      maxZoom: 12,
      max: 1.0,
      gradient: { 0.0: '#00c853', 0.3: '#76ff03', 0.5: '#ffd600', 0.7: '#ff6d00', 1.0: '#d50000' },
    });
  }

  // Wire up the toggle button
  const toggleBtn = document.getElementById('mapViewToggle');
  const heatLegend = document.getElementById('heatmapLegend');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (state.mapViewMode === 'markers') {
        // Switch to heatmap
        state.mapViewMode = 'heatmap';
        state.map.removeLayer(state._lightTile);
        state._darkTile.addTo(state.map);
        state.mapLayer.eachLayer(l => state.map.removeLayer ? null : null);
        state.map.removeLayer(state.mapLayer);
        if (state.heatLayer) state.heatLayer.addTo(state.map);
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="11" r="3"/><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg> Markers`;
        if (heatLegend) heatLegend.removeAttribute('hidden');
      } else {
        // Switch to markers
        state.mapViewMode = 'markers';
        state.map.removeLayer(state._darkTile);
        state._lightTile.addTo(state.map);
        if (state.heatLayer && state.map.hasLayer(state.heatLayer)) state.map.removeLayer(state.heatLayer);
        state.mapLayer.addTo(state.map);
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> Heatmap`;
        if (heatLegend) heatLegend.setAttribute('hidden', '');
      }
    });
  }
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
    if (!matchesQuickPreset(marker)) return false;
    return true;
  });

  for (const marker of filteredMarkers) {
    if (marker.latitude === null || marker.longitude === null || marker.latitude === undefined || marker.longitude === undefined) continue;
    const key = state.selectedDistrictId ? String(marker.stationId || marker.caseId) : String(marker.districtId || marker.caseId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(marker);
  }

  const bounds = [];
  let focusLeafletMarker = null;

  // Build heatmap points: [lat, lng, intensity]
  const maxCount = Math.max(1, ...Array.from(grouped.values()).map(items => items.length));
  const heatPoints = [];

  grouped.forEach((items) => {
    const latitude = items.reduce((sum, item) => sum + Number(item.latitude), 0) / items.length;
    const longitude = items.reduce((sum, item) => sum + Number(item.longitude), 0) / items.length;
    const offset = [latitude, longitude];

    const first = items[0];
    const matchedAlert = nearestAlertFor(payload, first.districtId, first.stationId, state.selectedHour);
    const kind = matchedAlert ? 'alert' : (payload.hotspots || []).some((hotspot) => Number(hotspot.districtId) === Number(first.districtId)) ? 'hotspot' : 'normal';

    const leafletMarker = L.marker(offset, {
      icon: L.divIcon({
        html: buildMarkerHtml(kind, items.length),
        className: 'custom-map-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(state.mapLayer);

    const popupHtml = `
      <div style="font-family: 'Space Grotesk', sans-serif; padding: 4px;">
        <strong style="color: #0f172a; font-size: 1.05rem;">${escapeHtml(first.districtName || 'Unknown')}</strong><br>
        <span style="color: #0284c7; font-weight: 600; font-size: 0.9rem;">PS: ${escapeHtml(first.stationName || 'Station')}</span><br>
        <div style="margin: 6px 0; font-weight: 600; color: #0f172a;">${formatNumber(items.length)} Cases Registered</div>
        <div style="font-size: 0.82rem; color: #64748b; margin-bottom: 8px;">Top Crime: ${escapeHtml(first.crimeName || 'Unknown')}</div>
        <button type="button" class="btn-browse-cases" onclick="window.openCaseBrowser('${escapeHtml(first.stationName || 'Police Station')}', ${first.stationId || 0}, ${first.districtId || 0})">📋 List Case Headings (${items.length} Cases)</button>
      </div>
    `;

    leafletMarker.bindPopup(popupHtml);

    if (state.selectedStationId && Number(first.stationId) === state.selectedStationId) {
      focusLeafletMarker = { marker: leafletMarker, offset };
    }
    bounds.push(offset);

    // Accumulate heatmap point with normalized intensity
    heatPoints.push([latitude, longitude, items.length / maxCount]);
  });

  // Update heatmap layer with new data
  if (state.heatLayer) {
    state.heatLayer.setLatLngs(heatPoints);
    // If currently in heatmap mode, make sure it's on the map
    if (state.mapViewMode === 'heatmap' && !state.map.hasLayer(state.heatLayer)) {
      state.heatLayer.addTo(state.map);
    }
  }

  if (focusLeafletMarker) {
    state.map.setView(focusLeafletMarker.offset, 13);
    setTimeout(() => { focusLeafletMarker.marker.openPopup(); }, 300);
  } else if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: state.selectedDistrictId ? 11 : 8 });
  } else {
    state.map.setView([15.3173, 75.7139], 7);
  }
}

// Case Intelligence Explorer Modal Logic
window.openCaseBrowser = function(stationName, stationId, districtId) {
  const allMarkers = state.dashboard?.markers || [];
  let filteredCases = allMarkers.filter((marker) => {
    if (stationId && Number(marker.stationId) === Number(stationId)) return true;
    if (!stationId && districtId && Number(marker.districtId) === Number(districtId)) return true;
    return false;
  });

  // Fallback: If stationId is missing or doesn't match numerically, search by stationName
  if (!filteredCases.length && stationName) {
    const sName = String(stationName).trim().toLowerCase();
    filteredCases = allMarkers.filter((marker) => {
      const mName = String(marker.stationName || '').trim().toLowerCase();
      return mName.includes(sName) || sName.includes(mName);
    });
  }

  state.currentBrowserStationName = stationName || 'Police Station';
  state.currentBrowserCases = filteredCases;

  els.caseBrowserTitle.textContent = `${state.currentBrowserStationName} • Registered Incidents`;
  els.caseBrowserModal.hidden = false;
  els.modalCaseSearch.value = '';
  renderCaseList();
};

window.closeCaseBrowser = function() {
  els.caseBrowserModal.hidden = true;
};

function renderCaseList() {
  const query = (els.modalCaseSearch.value || '').trim().toLowerCase();
  const cases = state.currentBrowserCases.filter((c) => {
    if (!query) return true;
    const text = `${c.crimeName} ${c.crimeNo} ${c.facts} ${c.registeredDate} ${c.stationName}`.toLowerCase();
    return text.includes(query);
  });

  els.caseCountBadge.textContent = `${cases.length} Cases Loaded`;

  if (!cases.length) {
    els.caseListContent.innerHTML = '<div class="muted" style="padding: 24px; text-align: center;">No cases found matching criteria.</div>';
    return;
  }

  els.caseListContent.innerHTML = cases.map((item, idx) => `
    <article class="case-card">
      <div class="case-card-head">
        <div class="case-card-left">
          <span class="case-num">#${idx + 1}</span>
          <span class="case-card-title">${escapeHtml(item.crimeName || 'Crime Incident')}</span>
          <span class="case-no-badge">FIR: ${escapeHtml(item.crimeNo || 'N/A')}</span>
        </div>
        <div class="case-card-right">
          <span class="case-date-tag">${escapeHtml(item.registeredDate || 'N/A')} ${item.hour !== undefined ? item.hour + ':00' : ''}</span>
          <span class="badge-tag ${item.severity === 'Heinous' ? 'heinous' : 'normal'}">${escapeHtml(item.severity || 'Recorded')}</span>
        </div>
      </div>
      <div class="case-card-body">
        <strong>Brief Summary:</strong> ${escapeHtml(item.facts || 'No detailed incident summary recorded.')}
      </div>
      <div class="case-card-meta">
        <span>Police Station: <strong style="color:#ffffff;">${escapeHtml(item.stationName || 'Station')}</strong></span>
        <span>District: <strong style="color:#ffffff;">${escapeHtml(item.districtName || 'District')}</strong></span>
        ${item.latitude ? `<span>Location: <strong style="color:#ffffff;">${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}</strong></span>` : ''}
      </div>
    </article>
  `).join('');
}

if (els.closeCaseBrowserBtn) {
  els.closeCaseBrowserBtn.addEventListener('click', closeCaseBrowser);
}

if (els.caseBrowserModal) {
  els.caseBrowserModal.addEventListener('click', (e) => {
    if (e.target === els.caseBrowserModal) closeCaseBrowser();
  });
}

if (els.modalCaseSearch) {
  els.modalCaseSearch.addEventListener('input', renderCaseList);
}

function renderCompareCard(title, payload) {
  const topCrime = payload.summary?.crimeCounts?.[0]?.[0] || 'Unknown';
  return `
    <article class="mini-card compare-card">
      <h3 style="margin-top:0; font-family:'Space Grotesk',sans-serif;">${escapeHtml(title)}</h3>
      <div class="compare-metric"><span>Total Cases</span><strong>${formatNumber(payload.totals?.cases || 0)}</strong></div>
      <div class="compare-metric"><span>Hotspots</span><strong>${formatNumber(payload.totals?.hotspots || 0)}</strong></div>
      <div class="compare-metric"><span>Alert Triggers</span><strong>${formatNumber(payload.totals?.alerts || 0)}</strong></div>
      <div class="muted" style="margin-top:8px; font-size:0.84rem;">Top Crime: <strong style="color:#e2e8f0;">${escapeHtml(topCrime)}</strong></div>
    </article>
  `;
}

async function renderCompareMode() {
  if (!state.compareMode || !state.compareDistrictA || !state.compareDistrictB) {
    els.comparePanel.hidden = true;
    return;
  }
  const [aPayload, bPayload] = await Promise.all([
    api(`/api/dashboard?district_id=${encodeURIComponent(state.compareDistrictA)}&days=${encodeURIComponent(state.days)}`),
    api(`/api/dashboard?district_id=${encodeURIComponent(state.compareDistrictB)}&days=${encodeURIComponent(state.days)}`),
  ]);
  els.comparePanel.hidden = false;
  els.compareGrid.innerHTML = [
    renderCompareCard(findDistrictName(state.compareDistrictA), aPayload.dashboard || aPayload),
    renderCompareCard(findDistrictName(state.compareDistrictB), bPayload.dashboard || bPayload),
  ].join('');
}

function renderRepeatOffenders(networkPayload) {
  const offenders = (networkPayload.repeatOffenders || []).slice(0, 6);
  if (!offenders.length) {
    els.repeatOffenderList.innerHTML = '<div class="muted">No repeat-offender pattern identified in current selection.</div>';
    return;
  }
  els.repeatOffenderList.innerHTML = offenders.map((offender) => `
    <article class="repeat-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:0.95rem; color:#f1f5f9;">${escapeHtml(offender.name || offender.personId)}</strong>
        <span class="badge-tag" style="background:rgba(239,68,68,0.18); color:#fca5a5;">${formatNumber(offender.caseCount)} Cases</span>
      </div>
      <div class="muted" style="margin-top:4px; font-size:0.84rem;">Specialty: <span style="color:#7dd3fc;">${escapeHtml(offender.specialtyCrime || 'Unknown')}</span></div>
      <div class="muted" style="margin-top:2px; font-size:0.8rem;">Districts: ${escapeHtml((offender.districts || []).map((i) => i.districtName).join(', ') || 'Unknown')}</div>
    </article>
  `).join('');
}

function renderNetwork(networkPayload) {
  const nodes = (networkPayload.nodes || []).map((node) => {
    const palette = {
      offender: '#06b6d4',
      victim: '#f59e0b',
      station: '#10b981',
      location: '#3b82f6',
    };
    return {
      ...node,
      color: palette[node.type] || '#3b82f6',
      font: { color: '#f8fafc', face: 'Space Grotesk', size: 13 },
      shape: node.type === 'station' ? 'box' : 'dot',
      margin: 8,
    };
  });
  const edges = (networkPayload.edges || []).map((edge) => ({
    ...edge,
    color: edge.type === 'coaccused' ? 'rgba(239, 68, 68, 0.75)' : 'rgba(6, 182, 212, 0.45)',
    width: Math.max(1, Math.min(6, edge.value || 1)),
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
    ? insights.map((text) => `<article class="mini-card" style="border-left: 3px solid var(--accent-cyan);"><div class="text-block" style="color:#e2e8f0; min-height:auto;">${escapeHtml(text)}</div></article>`).join('')
    : '<div class="muted">No occupation correlation signal available in the selected window.</div>';

  const rows = correlationPayload.occupationHeatmap || [];
  if (!rows.length) {
    els.occupationTable.innerHTML = '<div class="muted">No occupation breakdown records available.</div>';
    return;
  }

  const topRows = rows.slice(0, 8);
  els.occupationTable.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Occupation</th><th>Incidents</th><th>Top Crimes</th><th>Hotspot Districts</th></tr>
        </thead>
        <tbody>
          ${topRows.map((row) => `
            <tr>
              <td><strong>${escapeHtml(row.occupation)}</strong></td>
              <td><span class="badge-tag">${formatNumber(row.caseCount)}</span></td>
              <td>${escapeHtml((row.topCrimeTypes || []).map((item) => item.crimeName).join(', '))}</td>
              <td>${escapeHtml((row.topDistricts || []).map((item) => item.districtName).join(', '))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// QuickML Visual Scorecard Renderer
function renderQuickMLRiskScorecard(box, riskPayload) {
  if (state.showRawRiskJson) {
    box.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(riskPayload, null, 2))}</pre>`;
    return;
  }

  const reqData = riskPayload.request || {};
  const hotspots = reqData.hotspots || state.dashboard?.hotspots || [];
  const alerts = reqData.alerts || state.dashboard?.alerts || [];
  const scopeName = state.selectedStationId ? findStationName(state.selectedStationId) : findDistrictName(state.selectedDistrictId);

  let score = 35;
  if (alerts.length > 5) score += 30;
  else if (alerts.length > 0) score += 15;
  if (hotspots.length > 10) score += 25;
  else if (hotspots.length > 0) score += 15;
  if (state.selectedDistrictId || state.selectedStationId) score += 10;
  score = Math.min(98, Math.max(12, score));

  let level = 'LOW';
  let levelClass = 'low';
  if (score >= 75) { level = 'CRITICAL'; levelClass = 'critical'; }
  else if (score >= 50) { level = 'HIGH'; levelClass = 'high'; }
  else if (score >= 35) { level = 'MODERATE'; levelClass = 'moderate'; }

  const topCrimes = Array.from(new Set(hotspots.map(h => h.topCrimeType).filter(Boolean))).slice(0, 3);
  const peakHours = Array.from(new Set(hotspots.map(h => `${h.hour}:00`))).slice(0, 4);

  box.innerHTML = `
    <div class="scorecard-box">
      <div class="risk-index-badge">
        <div class="risk-index-circle ${levelClass}">
          <span class="risk-index-number">${score}</span>
          <span class="risk-index-scale">/ 100</span>
        </div>
        <div class="risk-meta-info">
          <div class="risk-level-tag ${levelClass}">${level} RISK INDEX</div>
          <div class="muted" style="font-size:0.8rem;">Focus Scope: ${escapeHtml(scopeName)}</div>
        </div>
      </div>

      <div class="scorecard-section">
        <div class="scorecard-section-title">Primary Crime Drivers</div>
        <div class="badge-row">
          ${topCrimes.length ? topCrimes.map(c => `<span class="tag-pill">${escapeHtml(c)}</span>`).join('') : '<span class="tag-pill">Theft & Fraud</span>'}
        </div>
      </div>

      <div class="scorecard-section">
        <div class="scorecard-section-title">Vulnerable Peak Bands</div>
        <div class="badge-row">
          ${peakHours.length ? peakHours.map(h => `<span class="badge-tag">${escapeHtml(h)}</span>`).join('') : '<span class="badge-tag">18:00 - 22:00</span>'}
        </div>
      </div>

      <div class="recommendation-box">
        <strong>Recommended Patrol Response:</strong> Increase mobile unit frequency around high incident clusters during vulnerable hours.
      </div>
    </div>
  `;
}

function renderQuickMLAnomalyScorecard(box, anomalyPayload) {
  if (state.showRawAnomalyJson) {
    box.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(anomalyPayload, null, 2))}</pre>`;
    return;
  }

  const reqData = anomalyPayload.request || {};
  const alerts = reqData.alerts || state.dashboard?.alerts || [];
  const hotspots = reqData.hotspots || state.dashboard?.hotspots || [];

  const surgeDetected = alerts.length > 0 || hotspots.length > 4;
  const surgeCount = alerts.length + hotspots.length;

  box.innerHTML = `
    <div class="scorecard-box">
      <div class="risk-index-badge" style="border-left: 3px solid ${surgeDetected ? 'var(--accent-gold)' : 'var(--accent-emerald)'};">
        <div style="flex:1;">
          <div class="risk-level-tag ${surgeDetected ? 'high' : 'low'}">
            ${surgeDetected ? 'ANOMALOUS SURGE DETECTED' : 'NORMAL BASELINE'}
          </div>
          <div class="muted" style="font-size:0.82rem; margin-top:4px;">
            ${surgeDetected ? `${surgeCount} statistical spikes detected in time window` : 'Incident counts align with normal historical distribution'}
          </div>
        </div>
      </div>

      <div class="scorecard-section">
        <div class="scorecard-section-title">Anomaly Signal Analysis</div>
        <div class="badge-row">
          <span class="tag-pill" style="border-color:rgba(245,158,11,0.3); color:#fde047;">Z-Score Threshold: &gt; 2.0</span>
          <span class="tag-pill">Spatiotemporal Cluster: Active</span>
        </div>
      </div>

      <div class="scorecard-section">
        <div class="scorecard-section-title">Engine Status</div>
        <div class="muted" style="font-size:0.8rem; font-family:'IBM Plex Mono', monospace;">
          QuickML Threat Evaluator • Local High-Throughput Processing
        </div>
      </div>
    </div>
  `;
}

function renderNlq(payload) {
  if (payload.error) {
    els.nlqAnswer.innerHTML = `<div style="color:var(--accent-red); font-weight:500;">${escapeHtml(payload.error)}</div>`;
    els.nlqQuery.textContent = payload.query || 'No query generated.';
    els.nlqRows.innerHTML = `<div class="muted">${escapeHtml(payload.error)}</div>`;
    return;
  }

  let answerHtml = `<div style="line-height:1.6; color:#f1f5f9;">${escapeHtml(payload.answer || 'No answer returned.')}</div>`;
  if (payload.citations && payload.citations.length) {
    answerHtml += `<div class="badge-row" style="margin-top:10px;"><span class="suggestion-label">Citations:</span>${payload.citations.map(c => `<span class="badge-tag">${escapeHtml(c)}</span>`).join('')}</div>`;
  }
  els.nlqAnswer.innerHTML = answerHtml;
  els.nlqQuery.textContent = payload.query || 'No query generated.';

  const rows = payload.rows || [];
  if (!rows.length) {
    els.nlqRows.innerHTML = '<div class="muted" style="padding:12px;">The query returned zero records.</div>';
    return;
  }

  const columns = Object.keys(rows[0]).slice(0, 8);
  els.nlqRows.innerHTML = `
    <table>
      <thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.slice(0, 15).map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] ?? '')}</td>`).join('')}</tr>`).join('')}
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

async function fetchSocioPredictive() {
  const params = new URLSearchParams();
  if (state.selectedDistrictId) params.set('district_id', state.selectedDistrictId);
  params.set('days', state.days);
  return api(`/api/socio_predictive?${params.toString()}`);
}

// ── Strategic Intelligence Hub Renderers ───────────────────────────────────

function renderStrategicInsights(insights) {
  if (!els.sihInsights) return;
  if (!insights || !insights.length) {
    els.sihInsights.innerHTML = '';
    return;
  }
  els.sihInsights.innerHTML = insights.map((text, i) => {
    const icons = [
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
    ];
    return `<div class="sih-insight-pill">${icons[i % 3]}${escapeHtml(text)}</div>`;
  }).join('');
}

function renderSocioCorrelation(data) {
  const container = els.socioCorrelationPanel;
  if (!container) return;
  const districts = (data.socioEconomicCorrelation || []).slice(0, 8);
  if (!districts.length) {
    container.innerHTML = '<div class="muted">No socio-economic data available for the selected window.</div>';
    return;
  }

  const maxCases = Math.max(...districts.map(d => d.caseCount), 1);

  container.innerHTML = districts.map((d) => {
    const barWidth = Math.round((d.caseCount / maxCases) * 100);
    const urbanClass = d.urbanizationIndex >= 60 ? 'urban-high' : (d.urbanizationIndex >= 30 ? 'urban-mid' : 'urban-low');
    const topCrime = d.topCrimeTypes?.[0]?.crimeName || 'Unknown';
    const topOcc = d.topOccupations?.[0]?.occupationName || 'N/A';
    const genderEntries = Object.entries(d.genderBreakdown || {});
    const totalGender = genderEntries.reduce((s, [, v]) => s + v, 0);
    return `
      <article class="socio-district-card">
        <div class="socio-card-top">
          <div class="socio-district-name">${escapeHtml(d.districtName)}</div>
          <span class="urbanization-badge ${urbanClass}">UI: ${d.urbanizationIndex}</span>
        </div>
        <div class="socio-bar-wrap">
          <div class="socio-bar" style="width:${barWidth}%"></div>
          <span class="socio-bar-label">${formatNumber(d.caseCount)} cases</span>
        </div>
        <div class="socio-meta-row">
          <span class="socio-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M3 21h18M3 7v14M21 7v14M12 3L2 7h20L12 3z"/></svg>
            ${d.stationCount} PS
          </span>
          <span class="socio-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Avg age: ${d.avgComplainantAge !== null ? d.avgComplainantAge + 'y' : 'N/A'}
          </span>
          ${totalGender > 0 ? genderEntries.slice(0,2).map(([g, v]) =>
            `<span class="socio-meta-item">Gender ${escapeHtml(String(g))}: ${Math.round(v/totalGender*100)}%</span>`
          ).join('') : ''}
        </div>
        <div class="socio-tags">
          <span class="tag-pill" style="font-size:0.72rem;padding:3px 8px;">&#x1f4cc; ${escapeHtml(topCrime)}</span>
          <span class="tag-pill" style="font-size:0.72rem;padding:3px 8px;border-color:rgba(168,85,247,0.3);color:#c084fc;">&#x1f4bc; ${escapeHtml(topOcc)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderPredictiveRisk(data) {
  const container = els.predictiveRiskPanel;
  if (!container) return;
  const districts = (data.predictiveRiskScores || []).slice(0, 8);
  if (!districts.length) {
    container.innerHTML = '<div class="muted">Insufficient historical data for predictive modeling.</div>';
    return;
  }

  const levelColors = {
    critical: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)', text: '#fca5a5', bar: '#ef4444' },
    high:     { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.45)', text: '#fde68a', bar: '#f59e0b' },
    moderate: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', text: '#67e8f9', bar: '#06b6d4' },
    low:      { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', bar: '#10b981' },
  };
  const trendIcon = { rising: '↑', stable: '→', falling: '↓' };
  const trendColor = { rising: '#ef4444', stable: '#94a3b8', falling: '#10b981' };

  container.innerHTML = districts.map((d) => {
    const colors = levelColors[d.riskLevel] || levelColors.low;
    const icon = trendIcon[d.trend] || '→';
    const iconColor = trendColor[d.trend] || '#94a3b8';
    const forecast = d.forecastNext7Days || [];
    const sparkMax = Math.max(...forecast, d.avgDailyCases, 1);
    // Mini sparkline SVG
    const sparkPoints = forecast.map((v, i) => {
      const x = (i / Math.max(forecast.length - 1, 1)) * 80;
      const y = 20 - (v / sparkMax) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const topCrime = d.topCrimeTypes?.[0]?.crimeName || 'Unknown';
    return `
      <article class="pred-risk-card" style="background:${colors.bg};border-color:${colors.border};">
        <div class="pred-risk-top">
          <div>
            <div class="pred-district-name">${escapeHtml(d.districtName)}</div>
            <div class="pred-risk-badge" style="color:${colors.text};">${(d.riskLevel || 'low').toUpperCase()} RISK</div>
          </div>
          <div class="pred-score-circle" style="border-color:${colors.bar};">
            <span style="color:${colors.text};font-weight:700;font-size:1.1rem;">${d.riskScore}</span>
            <span style="color:var(--muted);font-size:0.65rem;">/100</span>
          </div>
        </div>
        <div class="pred-metrics">
          <div class="pred-metric">
            <span class="pred-metric-label">Avg Daily</span>
            <span class="pred-metric-val">${d.avgDailyCases}</span>
          </div>
          <div class="pred-metric">
            <span class="pred-metric-label">Peak</span>
            <span class="pred-metric-val">${d.peakDailyCases}</span>
          </div>
          <div class="pred-metric">
            <span class="pred-metric-label">7-Day Forecast Avg</span>
            <span class="pred-metric-val">${d.forecastAvgDaily}</span>
          </div>
          <div class="pred-metric">
            <span class="pred-metric-label">Trend</span>
            <span class="pred-metric-val" style="color:${iconColor};font-weight:700;">${icon} ${escapeHtml(d.trend)}</span>
          </div>
        </div>
        ${forecast.length >= 2 ? `
        <div class="pred-sparkline">
          <span class="pred-sparkline-label">7-Day Forecast</span>
          <svg viewBox="0 0 80 20" preserveAspectRatio="none" class="sparkline-svg">
            <polyline points="${sparkPoints}" fill="none" stroke="${colors.bar}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>` : ''}
        <div class="pred-top-crime" style="font-size:0.78rem; color:var(--muted); margin-top:8px;">
          Primary Crime: <strong style="color:#e2e8f0;">${escapeHtml(topCrime)}</strong>
        </div>
      </article>
    `;
  }).join('');
}

function renderAnomalyDetection(data) {
  const container = els.anomalyDetectionPanel;
  if (!container) return;
  const anomalies = (data.anomalyCallouts || []).slice(0, 8);
  if (!anomalies.length) {
    container.innerHTML = `
      <div class="anomaly-clear">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px;height:36px;color:#10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div>
          <div style="font-weight:600;color:#6ee7b7;margin-bottom:4px;">Normal Behavioral Baseline</div>
          <div class="muted" style="font-size:0.84rem;">No significant Z-score deviations detected in the selected analysis window.</div>
        </div>
      </div>
    `;
    return;
  }

  const sevColors = {
    critical: { border: 'rgba(239,68,68,0.6)', bg: 'rgba(239,68,68,0.1)', badge: '#fca5a5', badgeBg: 'rgba(239,68,68,0.2)' },
    high:     { border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.08)', badge: '#fde68a', badgeBg: 'rgba(245,158,11,0.15)' },
    moderate: { border: 'rgba(168,85,247,0.4)', bg: 'rgba(168,85,247,0.07)', badge: '#c084fc', badgeBg: 'rgba(168,85,247,0.15)' },
  };

  container.innerHTML = anomalies.map((anomaly) => {
    const sev = sevColors[anomaly.severity] || sevColors.moderate;
    const issurge = anomaly.anomalyType === 'surge';
    const zAbs = Math.abs(anomaly.zScore);
    // Mini bar chart for signal series
    const series = anomaly.signalSeries || [];
    const seriesMax = Math.max(...series, 1);
    const miniBar = series.map(v =>
      `<span class="anomaly-mini-bar" style="height:${Math.max(4, Math.round((v / seriesMax) * 28))}px;background:${issurge ? '#ef4444' : '#a855f7'};opacity:${v > 0 ? 0.7 + (v/seriesMax)*0.3 : 0.2}"></span>`
    ).join('');
    const affectedDistricts = (anomaly.topAffectedDistricts || []).slice(0, 3);
    return `
      <article class="anomaly-callout" style="border-color:${sev.border};background:${sev.bg};">
        <div class="anomaly-header">
          <div class="anomaly-title-block">
            <span class="anomaly-type-badge" style="background:${sev.badgeBg};color:${sev.badge};">
              ${issurge ? '▲ SURGE' : '▼ SUPPRESSION'}
            </span>
            <strong class="anomaly-crime-name">${escapeHtml(anomaly.crimeName)}</strong>
          </div>
          <div class="anomaly-zscore" style="color:${sev.badge};">
            z = ${anomaly.zScore > 0 ? '+' : ''}${anomaly.zScore}
          </div>
        </div>

        <div class="anomaly-stats-row">
          <div class="anomaly-stat">
            <span class="anomaly-stat-label">Observed (14d)</span>
            <span class="anomaly-stat-val" style="color:${issurge ? '#fca5a5' : '#c084fc'}">${formatNumber(anomaly.signalCount)}</span>
          </div>
          <div class="anomaly-stat">
            <span class="anomaly-stat-label">Expected</span>
            <span class="anomaly-stat-val">${anomaly.expectedCount}</span>
          </div>
          <div class="anomaly-stat">
            <span class="anomaly-stat-label">Baseline σ</span>
            <span class="anomaly-stat-val">${anomaly.baselineStdDev}</span>
          </div>
          <div class="anomaly-stat">
            <span class="anomaly-stat-label">Severity</span>
            <span class="anomaly-stat-val" style="color:${sev.badge};text-transform:uppercase;">${anomaly.severity}</span>
          </div>
        </div>

        <div class="anomaly-sparkrow">
          <span style="font-size:0.72rem;color:var(--muted);margin-right:6px;">14-day signal:</span>
          <div class="anomaly-mini-bars">${miniBar}</div>
        </div>

        ${affectedDistricts.length ? `
        <div class="anomaly-districts">
          <span style="font-size:0.72rem;color:var(--muted);">Hotzone:</span>
          ${affectedDistricts.map(d => `<span class="badge-tag" style="font-size:0.7rem;">${escapeHtml(d.districtName)} (${d.count})</span>`).join('')}
        </div>` : ''}

        <div class="anomaly-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0;color:var(--accent-gold);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>${escapeHtml(anomaly.investigatorNote)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderStrategicHub(payload) {
  renderStrategicInsights(payload.strategicInsights || []);
  renderSocioCorrelation(payload);
  renderPredictiveRisk(payload);
  renderAnomalyDetection(payload);
  if (els.sihStatus) {
    const computedAt = payload.computedAt ? new Date(payload.computedAt).toLocaleTimeString() : 'unknown';
    els.sihStatus.innerHTML = `<span class="live-dot"></span> Computed at ${computedAt}`;
  }
}

async function fetchQuickML(path, body) {
  return api(path, { method: 'POST', body });
}

function syncDistrictSelection() {
  state.selectedDistrictId = els.districtSelect.value ? Number(els.districtSelect.value) : null;
  if (!Number.isFinite(state.selectedDistrictId) || state.selectedDistrictId === 0) {
    state.selectedDistrictId = null;
  }
  state.selectedStationId = null;
  syncDistrictSearchInput();
  syncStationOptions();
}

function syncStationSelection() {
  state.selectedStationId = els.stationSelect.value ? Number(els.stationSelect.value) : null;
  syncDistrictSearchInput();
}

async function refreshAll() {
  try {
    setStatus('Running analytics pipeline...');
    syncLabels();
    const [dashboard, trends, network, correlations, risk, anomaly] = await Promise.all([
      fetchDashboard(),
      fetchTrends(),
      fetchNetwork(),
      fetchCorrelations(),
      fetchQuickML('/api/ml/risk', { district_id: state.selectedDistrictId, days: state.days }),
      fetchQuickML('/api/ml/anomaly', { district_id: state.selectedDistrictId, days: state.days }),
    ]);



    // Unwrap API response envelope keys before passing to renderers
    const dashPayload = dashboard.dashboard || dashboard;
    const networkPayload = network.network || network;
    const corrPayload = correlations.correlations || correlations;

    state.dashboard = dashPayload;
    state.trends = trends;
    state.network = networkPayload;
    state.correlations = corrPayload;
    state.topDistrictIds = (dashPayload.summary?.districtCounts || []).slice(0, 10).map((item) => Number(item.districtId));

    renderStatCards(dashPayload);
    renderDistrictTree(state.meta?.unitTree || []);
    renderHotspots(dashPayload.hotspots || []);
    renderAlerts(dashPayload.alerts || []);
    renderTimeline(dashPayload.summary?.hourCounts || []);
    renderMap(dashPayload);
    renderNetwork(networkPayload);
    renderRepeatOffenders(networkPayload);
    renderCorrelations(corrPayload);

    renderQuickMLRiskScorecard(els.riskOutput, risk);
    renderQuickMLAnomalyScorecard(els.anomalyOutput, anomaly);

    await renderCompareMode();

    let scopeTitle = 'Statewide Jurisdiction';
    if (state.selectedStationId) {
      scopeTitle = `${findStationName(state.selectedStationId)} (${findDistrictName(state.selectedDistrictId)})`;
    } else if (state.selectedDistrictId) {
      scopeTitle = findDistrictName(state.selectedDistrictId);
    }
    setStatus(`Active Scope: ${scopeTitle}`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
    console.error(error);
  }

  // Strategic Intelligence Hub loads independently so it never blocks the main dashboard
  refreshStrategicHub();
}

async function refreshStrategicHub() {
  if (els.sihStatus) {
    els.sihStatus.innerHTML = `<span class="pulse-icon"></span> Computing intelligence...`;
  }
  // Show skeleton loaders so panels don't look empty while fetching
  const skeletonHtml = `<div class="sih-skeleton"></div><div class="sih-skeleton"></div><div class="sih-skeleton" style="opacity:0.5"></div>`;
  if (els.socioCorrelationPanel) els.socioCorrelationPanel.innerHTML = skeletonHtml;
  if (els.predictiveRiskPanel) els.predictiveRiskPanel.innerHTML = skeletonHtml;
  if (els.anomalyDetectionPanel) els.anomalyDetectionPanel.innerHTML = skeletonHtml;

  try {
    const socioPred = await fetchSocioPredictive();
    state.socioPredictive = socioPred;
    renderStrategicHub(socioPred);
  } catch (error) {
    console.error('Strategic Hub error:', error);
    if (els.sihStatus) {
      els.sihStatus.innerHTML = `<span style="color:#ef4444;">⚠ Hub error: ${escapeHtml(error.message)}</span>`;
    }
    const errHtml = `<div class="muted" style="padding:12px;font-size:0.82rem;">Could not load data: ${escapeHtml(error.message)}</div>`;
    if (els.socioCorrelationPanel) els.socioCorrelationPanel.innerHTML = errHtml;
    if (els.predictiveRiskPanel) els.predictiveRiskPanel.innerHTML = errHtml;
    if (els.anomalyDetectionPanel) els.anomalyDetectionPanel.innerHTML = errHtml;
  }
}


// ── NLQ Renderer ──────────────────────────────────────────────────────────────

function _nlqTypewriter(element, text, speedMs = 12) {
  element.textContent = '';
  let index = 0;
  function tick() {
    if (index < text.length) {
      element.textContent += text[index++];
      setTimeout(tick, speedMs);
    }
  }
  tick();
}

function _nlqHighlightZcql(query) {
  const keywords = ['SELECT', 'FROM', 'WHERE', 'LIMIT', 'OFFSET', 'ORDER', 'BY',
                    'AND', 'OR', 'LIKE', 'IN', 'NOT', 'IS', 'NULL', 'ASC', 'DESC'];

  function highlightNonString(seg) {
    seg = escapeHtml(seg);
    keywords.forEach((kw) => {
      seg = seg.replace(new RegExp(`\\b${kw}\\b`, 'gi'), `<span class="zcql-kw">${kw}</span>`);
    });
    return seg.replace(/\b(\d+)\b/g, `<span class="zcql-num">$1</span>`);
  }

  // Process string literals FIRST (before escaping) to avoid &#039; entity bug
  const parts = [];
  const strRe = /'([^']*)'/g;
  let last = 0;
  let m;
  while ((m = strRe.exec(query)) !== null) {
    if (m.index > last) parts.push(highlightNonString(query.slice(last, m.index)));
    parts.push(`<span class="zcql-str">'${escapeHtml(m[1])}'</span>`);
    last = m.index + m[0].length;
  }
  if (last < query.length) parts.push(highlightNonString(query.slice(last)));
  return parts.join('');
}

function _nlqBuildTable(rows) {
  if (!rows || rows.length === 0) {
    return `<div class="nlq-empty-rows">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:.35;margin-bottom:8px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      <p>No records returned.</p>
    </div>`;
  }

  const keys = Object.keys(rows[0]);
  const VISIBLE_COLS = 8;
  const displayKeys = keys.slice(0, VISIBLE_COLS);
  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  let currentPage = 0;

  const tableId = `nlq-tbl-${Date.now()}`;
  const pageId = `nlq-pg-${Date.now()}`;
  const infoId = `nlq-info-${Date.now()}`;

  function renderPage(page) {
    const start = page * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);
    const bodyHtml = slice.map((row) =>
      `<tr>${displayKeys.map((k) => `<td>${escapeHtml(String(row[k] ?? ''))}</td>`).join('')}</tr>`
    ).join('');
    const tbl = document.getElementById(tableId);
    if (tbl) tbl.querySelector('tbody').innerHTML = bodyHtml;
    const pg = document.getElementById(pageId);
    if (pg) pg.querySelectorAll('.nlq-page-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === page);
    });
    const info = document.getElementById(infoId);
    if (info) info.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} rows`;
  }

  const headerHtml = displayKeys.map((k) => `<th>${escapeHtml(k)}</th>`).join('');
  const pageBtns = totalPages > 1
    ? Array.from({ length: Math.min(totalPages, 10) }, (_, i) =>
        `<button class="nlq-page-btn${i === 0 ? ' active' : ''}" data-page="${i}">${i + 1}</button>`
      ).join('')
    : '';

  const hiddenCols = keys.length > VISIBLE_COLS ? `<span class="nlq-hidden-cols">+${keys.length - VISIBLE_COLS} more columns hidden</span>` : '';

  const html = `
    <div class="nlq-table-header-row">
      <span id="${infoId}" class="nlq-row-info">Showing 1–${Math.min(PAGE_SIZE, rows.length)} of ${rows.length} rows</span>
      ${hiddenCols}
    </div>
    <div class="nlq-table-scroll">
      <table id="${tableId}" class="nlq-data-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
    ${totalPages > 1 ? `<div id="${pageId}" class="nlq-pagination">${pageBtns}</div>` : ''}
  `;

  // Defer wiring of pagination until after DOM insert
  setTimeout(() => {
    renderPage(0);
    if (totalPages > 1) {
      document.getElementById(pageId)?.querySelectorAll('.nlq-page-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentPage = Number(btn.getAttribute('data-page'));
          renderPage(currentPage);
        });
      });
    }
  }, 0);

  return html;
}

function renderNlq(result) {
  // ── Error state ──
  if (result.error) {
    const isNoKey = result.error.includes('GROQ_API_KEY') || result.error.includes('No LLM');
    els.nlqAnswer.innerHTML = `
      <div class="nlq-error-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;color:#f87171"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <strong>${escapeHtml(result.error)}</strong>
          ${isNoKey ? `<p style="margin:6px 0 0;font-size:0.8rem;opacity:.8;">Get a free API key at <a href="https://console.groq.com" target="_blank" rel="noopener" style="color:#60a5fa">console.groq.com</a>, then set it as <code>GROQ_API_KEY</code> and restart the server.</p>` : ''}
          ${result.hint ? `<p style="margin:4px 0 0;font-size:0.8rem;opacity:.75">${escapeHtml(result.hint)}</p>` : ''}
        </div>
      </div>`;
    els.nlqQuery.innerHTML = 'No query generated.';
    els.nlqRows.innerHTML = '';
    return;
  }

  // ── Answer block ──
  const intentHtml = result.intent
    ? `<div class="nlq-intent-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>${escapeHtml(result.intent)}</div>`
    : '';

  const metaHtml = [
    result.citations?.length ? `<span class="nlq-meta-chip">Fields: ${result.citations.map(escapeHtml).join(', ')}</span>` : '',
    result.assumptions?.length ? `<span class="nlq-meta-chip nlq-assume">Assumptions: ${result.assumptions.map(escapeHtml).join(' · ')}</span>` : '',
    result.rowCount != null ? `<span class="nlq-meta-chip nlq-rows-chip">${result.rowCount} row${result.rowCount !== 1 ? 's' : ''} returned</span>` : '',
  ].filter(Boolean).join('');

  els.nlqAnswer.innerHTML = `
    ${intentHtml}
    <p id="nlq-answer-text" class="nlq-answer-text"></p>
    ${metaHtml ? `<div class="nlq-meta-row">${metaHtml}</div>` : ''}
  `;
  _nlqTypewriter(document.getElementById('nlq-answer-text'), result.answer || 'No answer generated.');

  // ── Query block ──
  if (result.query) {
    els.nlqQuery.innerHTML = _nlqHighlightZcql(result.query);
    els.nlqQuery._rawQuery = result.query;
  } else {
    els.nlqQuery.textContent = 'No query generated.';
    els.nlqQuery._rawQuery = '';
  }

  // ── Results table ──
  els.nlqRows.innerHTML = _nlqBuildTable(result.rows || []);
}

// Copy query button
els.copyQueryBtn?.addEventListener('click', () => {
  const text = els.nlqQuery._rawQuery || els.nlqQuery.textContent || '';
  if (!text || text === 'No query generated.') return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = els.copyQueryBtn;
    const original = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.style.color = '#34d399';
    setTimeout(() => { btn.innerHTML = original; btn.style.color = ''; }, 2000);
  });
});

async function runNlq() {
  const question = els.questionInput.value.trim();
  if (!question) {
    els.nlqAnswer.textContent = 'Please enter a natural language query first.';
    return;
  }

  // Optimistic loading state
  els.nlqAnswer.innerHTML = `<div class="nlq-thinking">
    <span class="nlq-dot"></span><span class="nlq-dot"></span><span class="nlq-dot"></span>
    <span style="margin-left:8px;opacity:.7;font-size:.85rem">Thinking...</span>
  </div>`;
  els.nlqQuery.textContent = 'Generating query...';
  els.nlqRows.innerHTML = '';

  els.askButton.disabled = true;
  els.askButton.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Running Query...`;
  try {
    const result = await api('/api/nlq', {
      method: 'POST',
      body: { question },
    });
    renderNlq(result);
  } catch (error) {
    renderNlq({ error: error.message });
  } finally {
    els.askButton.disabled = false;
    els.askButton.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Execute Query`;
  }
}

async function bootstrap() {
  if (els.caseBrowserModal) els.caseBrowserModal.hidden = true;
  syncLabels();
  applyQuickPreset('none');
  els.questionInput.value = 'Show me theft cases in Bengaluru last month';

  state.meta = await api('/api/meta?district_id=0');

  // Populate District Select Dropdown
  const districtOptionsHtml = ['<option value="0">All districts (31)</option>']
    .concat((state.meta.districts || []).map((district) => {
      const id = district.district_id || district.districtId || "";
      const name = district.district_name || district.districtName || "";
      state.districtLabelToId.set(String(name).trim().toLowerCase(), Number(id));
      return `<option value="${escapeHtml(id.toString())}">${escapeHtml(name)}</option>`;
    }))
    .join('');

  els.districtSelect.innerHTML = districtOptionsHtml;

  // Build Datalist for Search Box
  const datalistOptions = ['<option value="All districts"></option>']
    .concat((state.meta.districts || []).map((d) => `<option value="${escapeHtml(d.districtName || d.district_name)}"></option>`))
    .concat((state.meta.stations || []).slice(0, 100).map((s) => {
      const name = s.stationName || s.station_name || "";
      state.stationLabelToInfo.set(String(name).trim().toLowerCase(), {
        stationId: Number(s.stationId || s.station_id),
        districtId: Number(s.districtId || s.district_id),
      });
      return `<option value="${escapeHtml(name)}"></option>`;
    }));
  els.districtOptions.innerHTML = datalistOptions.join('');

  // Compare mode selects
  els.compareDistrictA.innerHTML = (state.meta.districts || []).map((district) => {
    const id = district.district_id || district.districtId || "";
    const name = district.district_name || district.districtName || "";
    return `<option value="${escapeHtml(id.toString())}">${escapeHtml(name)}</option>`;
  }).join('');
  els.compareDistrictB.innerHTML = els.compareDistrictA.innerHTML;

  const [firstDistrict, secondDistrict] = (state.meta.districts || []).slice(0, 2);
  state.compareDistrictA = firstDistrict ? Number(firstDistrict.district_id || firstDistrict.districtId) : null;
  state.compareDistrictB = secondDistrict ? Number(secondDistrict.district_id || secondDistrict.districtId) : null;
  if (state.compareDistrictA) els.compareDistrictA.value = String(state.compareDistrictA);
  if (state.compareDistrictB) els.compareDistrictB.value = String(state.compareDistrictB);

  renderDistrictTree(state.meta.unitTree || []);
  syncStationOptions();
  await refreshAll();
}

// Event Listeners
els.districtSelect.addEventListener('change', () => {
  syncDistrictSelection();
});

els.districtSearch.addEventListener('input', () => {
  const text = String(els.districtSearch.value || '').trim().toLowerCase();
  if (!text || text === 'all districts') {
    els.districtSelect.value = '0';
    syncDistrictSelection();
    return;
  }

  const districtId = state.districtLabelToId.get(text);
  if (districtId) {
    els.districtSelect.value = String(districtId);
    syncDistrictSelection();
    return;
  }

  const stationInfo = state.stationLabelToInfo.get(text);
  if (stationInfo) {
    state.selectedDistrictId = stationInfo.districtId;
    state.selectedStationId = stationInfo.stationId;
    els.districtSelect.value = String(stationInfo.districtId);
    syncStationOptions();
    els.stationSelect.value = String(stationInfo.stationId);
  }
});

els.stationSelect.addEventListener('change', () => {
  syncStationSelection();
});

els.hourSlider.addEventListener('input', () => {
  state.selectedHour = Number(els.hourSlider.value) === 24 ? null : Number(els.hourSlider.value);
  syncLabels();
});

els.windowSlider.addEventListener('input', () => {
  state.days = Number(els.windowSlider.value);
  syncLabels();
});

els.windowPresets.querySelectorAll('[data-days]').forEach((button) => {
  button.addEventListener('click', () => {
    const days = Number(button.getAttribute('data-days'));
    if (!Number.isFinite(days)) return;
    state.days = days;
    els.windowSlider.value = String(Math.min(365, Math.max(30, days)));
    syncLabels();
  });
});

els.quickPresets.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const preset = button.getAttribute('data-preset') || 'none';
    applyQuickPreset(preset);
    if (preset === 'top10') {
      state.selectedDistrictId = null;
      state.selectedStationId = null;
      els.districtSelect.value = '0';
      els.stationSelect.value = '';
      syncDistrictSearchInput();
      syncStationOptions();
    }
    if (preset === 'night') {
      state.selectedHour = null;
      els.hourSlider.value = '24';
    }
    syncLabels();
  });
});

els.compareToggle.addEventListener('change', async () => {
  state.compareMode = !!els.compareToggle.checked;
  els.comparePicks.classList.toggle('active', state.compareMode);
  await refreshAll();
});

els.compareDistrictA.addEventListener('change', async () => {
  state.compareDistrictA = Number(els.compareDistrictA.value) || null;
  if (state.compareMode) await refreshAll();
});

els.compareDistrictB.addEventListener('change', async () => {
  state.compareDistrictB = Number(els.compareDistrictB.value) || null;
  if (state.compareMode) await refreshAll();
});

// "Apply Filters & Run" Primary Action Handler
els.refreshButton.addEventListener('click', async () => {
  els.refreshButton.disabled = true;
  const originalText = els.refreshButton.innerHTML;
  els.refreshButton.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Processing...`;
  try {
    await refreshAll();
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.innerHTML = originalText;
  }
});

els.resetButton.addEventListener('click', async () => {
  state.selectedDistrictId = null;
  state.selectedStationId = null;
  state.selectedHour = null;
  state.days = 365;
  state.quickPreset = 'none';
  els.districtSelect.value = '0';
  els.stationSelect.value = '';
  els.hourSlider.value = 24;
  els.windowSlider.value = 365;
  applyQuickPreset('none');
  syncLabels();
  syncDistrictSearchInput();
  syncStationOptions();
  await refreshAll();
});

// NLQ Handlers
els.askButton.addEventListener('click', runNlq);
els.questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    runNlq();
  }
});

// Quick suggestion chips
document.querySelectorAll('.chip-suggestion').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-query');
    if (text) {
      els.questionInput.value = text;
      runNlq();
    }
  });
});

// Copy ZCQL Query button
if (els.copyQueryBtn) {
  els.copyQueryBtn.addEventListener('click', () => {
    const text = els.nlqQuery.textContent;
    if (text && text !== 'No query generated yet.') {
      navigator.clipboard.writeText(text);
      const prevHtml = els.copyQueryBtn.innerHTML;
      els.copyQueryBtn.innerHTML = 'Copied!';
      setTimeout(() => { els.copyQueryBtn.innerHTML = prevHtml; }, 2000);
    }
  });
}

// Toggle Raw JSON buttons
document.querySelectorAll('.btn-toggle-json').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (target === 'riskOutput') {
      state.showRawRiskJson = !state.showRawRiskJson;
      btn.textContent = state.showRawRiskJson ? 'Scorecard View' : 'Raw JSON';
      if (state.dashboard) {
        fetchQuickML('/api/ml/risk', { district_id: state.selectedDistrictId, days: state.days })
          .then(r => renderQuickMLRiskScorecard(els.riskOutput, r));
      }
    } else if (target === 'anomalyOutput') {
      state.showRawAnomalyJson = !state.showRawAnomalyJson;
      btn.textContent = state.showRawAnomalyJson ? 'Scorecard View' : 'Raw JSON';
      if (state.dashboard) {
        fetchQuickML('/api/ml/anomaly', { district_id: state.selectedDistrictId, days: state.days })
          .then(a => renderQuickMLAnomalyScorecard(els.anomalyOutput, a));
      }
    }
  });
});

// Start application
bootstrap().catch((error) => {
  setStatus(`Startup failed: ${error.message}`);
  console.error(error);
});

// ═══════════════════════════════════════════════════════════════════
//  District-Level Drill-Down Interactive Map
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────
  const ddState = {
    map: null,
    districtLayerGroup: null,
    stationLayerGroup: null,
    data: null,            // full API payload
    selectedDistrict: null, // district object currently drilled-into
    districtMarkers: [],   // case markers fetched for the drilled district
    days: 365,
  };

  // ── DOM refs ────────────────────────────────────────────────────
  const ddEls = {
    canvas: document.getElementById('ddmapCanvas'),
    status: document.getElementById('ddmapStatus'),
    resetBtn: document.getElementById('ddmapResetBtn'),
    breadcrumb: document.getElementById('ddmapBreadcrumb'),
    windowSelect: document.getElementById('ddmapWindowSelect'),
    districtList: document.getElementById('ddmapDistrictList'),
    stationPanel: document.getElementById('ddmapStationPanel'),
    stationPanelTitle: document.getElementById('ddmapStationPanelTitle'),
    stationList: document.getElementById('ddmapStationList'),
    crimeList: document.getElementById('ddmapCrimeList'),
  };

  // ── Colour helpers ───────────────────────────────────────────────
  function intensityClass(ratio) {
    if (ratio >= 0.75) return 'dm-critical';
    if (ratio >= 0.45) return 'dm-high';
    if (ratio >= 0.2)  return 'dm-moderate';
    return 'dm-low';
  }

  function intensityBarColor(ratio) {
    if (ratio >= 0.75) return '#ef4444';
    if (ratio >= 0.45) return '#f59e0b';
    if (ratio >= 0.2)  return '#06b6d4';
    return '#10b981';
  }

  function markerSize(ratio) {
    // bubble diameter 28–64px proportional to crime count ratio
    return Math.round(28 + ratio * 36);
  }

  // ── Initialise Leaflet map ───────────────────────────────────────
  function initDdMap() {
    if (ddState.map) return;
    ddState.map = L.map('ddmapCanvas', {
      zoomControl: true,
      preferCanvas: true,
      attributionControl: false,
    }).setView([15.3173, 75.7139], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap & CARTO',
      maxZoom: 18,
    }).addTo(ddState.map);

    // A small attribution in bottom-right
    L.control.attribution({ position: 'bottomright', prefix: '' })
      .addAttribution('© CARTO | KSP Analytics')
      .addTo(ddState.map);

    ddState.districtLayerGroup = L.layerGroup().addTo(ddState.map);
    ddState.stationLayerGroup  = L.layerGroup().addTo(ddState.map);
  }

  // ── Render district markers on map ──────────────────────────────
  function renderDistrictMarkers(districts) {
    ddState.districtLayerGroup.clearLayers();
    ddState.stationLayerGroup.clearLayers();

    (districts || []).forEach((district) => {
      const lat = district.centroidLat;
      const lng = district.centroidLng;
      if (!lat || !lng) return;

      const ratio = district.intensityRatio || 0;
      const cls   = intensityClass(ratio);
      const size  = markerSize(ratio);
      const abbr  = (district.districtName || '').slice(0, 3).toUpperCase();

      const icon = L.divIcon({
        html: `<div class="ddmap-district-marker ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.max(9, Math.round(size * 0.22))}px">${abbr}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(ddState.districtLayerGroup);

      // Rich popup
      const topCrimes = (district.topCrimes || []).slice(0, 3)
        .map(c => `<li style="font-size:0.78rem;color:#94a3b8;">${escapeHtml(c.crimeName)} <span style="color:#e2e8f0;font-weight:600;">(${c.caseCount})</span></li>`)
        .join('');

      marker.bindPopup(`
        <div style="font-family:'Space Grotesk',sans-serif;padding:4px;min-width:200px;">
          <div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;">${escapeHtml(district.districtName)}</div>
          <div style="font-size:0.85rem;font-weight:600;color:#0284c7;margin-bottom:8px;">${formatNumber(district.caseCount)} Registered Cases</div>
          ${topCrimes ? `<div style="font-size:0.78rem;color:#374151;margin-bottom:4px;font-weight:600;">Top Crime Types:</div><ul style="margin:0 0 8px;padding-left:14px;">${topCrimes}</ul>` : ''}
          <button type="button" class="btn-browse-cases" style="margin-top:6px;"
            onclick="window._ddDrillDistrict(${district.districtId})">
            🔍 Drill Into Stations
          </button>
        </div>
      `);

      marker.on('click', () => {
        drillIntoDistrict(district);
      });
    });
  }

  // ── Render station markers on drill-down ─────────────────────────
  function renderStationMarkers(stations) {
    ddState.stationLayerGroup.clearLayers();
    const maxCount = Math.max(...(stations || []).map(s => s.caseCount), 1);

    (stations || []).forEach((station) => {
      const lat = station.centroidLat;
      const lng = station.centroidLng;
      if (!lat || !lng) return;

      const ratio = station.caseCount / maxCount;
      const size  = Math.round(22 + ratio * 18);
      const abbr  = String(station.caseCount);

      const icon = L.divIcon({
        html: `<div class="ddmap-station-marker" style="width:${size}px;height:${size}px;font-size:${Math.max(8, Math.round(size * 0.28))}px">${abbr}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(ddState.stationLayerGroup);

      const topCrimes = (station.topCrimes || []).slice(0, 3)
        .map(c => `<li style="font-size:0.78rem;color:#374151;">${escapeHtml(c.crimeName)} <span style="font-weight:600;">(${c.caseCount})</span></li>`)
        .join('');

      marker.bindPopup(`
        <div style="font-family:'Space Grotesk',sans-serif;padding:4px;min-width:180px;">
          <div style="font-weight:700;font-size:0.95rem;color:#0f172a;margin-bottom:4px;">${escapeHtml(station.stationName)}</div>
          <div style="font-size:0.82rem;font-weight:600;color:#7c3aed;margin-bottom:8px;">${formatNumber(station.caseCount)} Cases</div>
          ${topCrimes ? `<ul style="margin:0;padding-left:14px;">${topCrimes}</ul>` : ''}
          <button type="button" class="btn-browse-cases" style="margin-top:8px;"
            onclick="window._ddOpenCaseBrowser('${escapeHtml(station.stationName)}', ${station.stationId}, ${ddState.selectedDistrict?.districtId || 0})">
            Browse Cases (${station.caseCount})
          </button>
        </div>
      `);
    });
  }

  // ── District rank list (sidebar) ────────────────────────────────
  function renderDistrictRankList(districts) {
    const el = ddEls.districtList;
    if (!el) return;
    const maxCount = Math.max(...(districts || []).map(d => d.caseCount), 1);

    el.innerHTML = (districts || []).slice(0, 31).map((d, i) => {
      const ratio = d.caseCount / maxCount;
      const barColor = intensityBarColor(ratio);
      const barWidth = Math.round(ratio * 100);
      const isSelected = ddState.selectedDistrict?.districtId === d.districtId;
      return `
        <div class="ddmap-rank-row${isSelected ? ' selected' : ''}"
             data-district-id="${d.districtId}"
             title="${escapeHtml(d.districtName)} — ${d.caseCount} cases">
          <span class="ddmap-rank-num">${i + 1}</span>
          <span class="ddmap-rank-name">${escapeHtml(d.districtName)}</span>
          <div class="ddmap-rank-bar-wrap">
            <div class="ddmap-rank-bar" style="width:${barWidth}%;background:${barColor};"></div>
          </div>
          <span class="ddmap-rank-count">${formatNumber(d.caseCount)}</span>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.ddmap-rank-row').forEach((row) => {
      row.addEventListener('click', () => {
        const dId = Number(row.getAttribute('data-district-id'));
        const district = (ddState.data?.districts || []).find(d => d.districtId === dId);
        if (district) drillIntoDistrict(district);
      });
    });
  }

  // ── Station rank list (sidebar) ─────────────────────────────────
  function renderStationRankList(stations) {
    const el = ddEls.stationList;
    if (!el) return;
    const maxCount = Math.max(...(stations || []).map(s => s.caseCount), 1);
    el.innerHTML = (stations || []).slice(0, 20).map((s, i) => {
      const ratio = s.caseCount / maxCount;
      const barWidth = Math.round(ratio * 100);
      return `
        <div class="ddmap-rank-row" title="${escapeHtml(s.stationName)} — ${s.caseCount} cases"
             style="cursor:default;">
          <span class="ddmap-rank-num">${i + 1}</span>
          <span class="ddmap-rank-name">${escapeHtml(s.stationName)}</span>
          <div class="ddmap-rank-bar-wrap">
            <div class="ddmap-rank-bar" style="width:${barWidth}%;background:#a855f7;"></div>
          </div>
          <span class="ddmap-rank-count">${formatNumber(s.caseCount)}</span>
        </div>
      `;
    }).join('');
  }

  // ── Crime breakdown bars (sidebar) ──────────────────────────────
  function renderCrimeBars(crimes) {
    const el = ddEls.crimeList;
    if (!el) return;
    const maxCount = Math.max(...(crimes || []).map(c => c.caseCount), 1);
    el.innerHTML = (crimes || []).slice(0, 8).map((c) => {
      const barWidth = Math.round((c.caseCount / maxCount) * 100);
      return `
        <div class="ddmap-crime-row">
          <span class="ddmap-crime-name">${escapeHtml(c.crimeName)}</span>
          <div class="ddmap-crime-bar-wrap">
            <div class="ddmap-crime-bar" style="width:${barWidth}%;"></div>
          </div>
          <span class="ddmap-crime-count">${formatNumber(c.caseCount)}</span>
        </div>
      `;
    }).join('');
  }

  // ── Breadcrumb helpers ──────────────────────────────────────────
  function setBreadcrumb(items) {
    if (!ddEls.breadcrumb) return;
    ddEls.breadcrumb.innerHTML = items.map((item, i) => {
      const isLast = i === items.length - 1;
      return `
        ${i > 0 ? '<span class="ddmap-bc-sep">›</span>' : ''}
        <span class="ddmap-bc-item${isLast ? ' active' : ''}"
              ${!isLast ? `data-bc-idx="${i}"` : ''}>${escapeHtml(item.label)}</span>
      `;
    }).join('');
    ddEls.breadcrumb.querySelectorAll('[data-bc-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-bc-idx'));
        if (idx === 0) resetDdMap();
      });
    });
  }

  // ── Drill into a district ────────────────────────────────────────
  async function drillIntoDistrict(district) {
    ddState.selectedDistrict = district;
    ddState.districtMarkers = []; // clear until fresh fetch completes

    // Show/hide panels
    if (ddEls.stationPanel) ddEls.stationPanel.removeAttribute('hidden');
    if (ddEls.stationPanelTitle) ddEls.stationPanelTitle.textContent = `${district.districtName} Stations`;
    if (ddEls.resetBtn) ddEls.resetBtn.style.display = 'inline-flex';

    setBreadcrumb([
      { label: 'Karnataka State' },
      { label: district.districtName },
    ]);

    // Update district rank list (highlight selected)
    renderDistrictRankList(ddState.data?.districts || []);

    // Render station markers on map
    const stations = district.stations || [];
    ddState.districtLayerGroup.clearLayers(); // hide district bubbles
    renderStationMarkers(stations);

    // Fit map to stations with GPS data
    const stationsWithGps = stations.filter(s => s.centroidLat && s.centroidLng);
    if (stationsWithGps.length >= 2) {
      const bounds = stationsWithGps.map(s => [s.centroidLat, s.centroidLng]);
      ddState.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } else if (district.centroidLat && district.centroidLng) {
      ddState.map.setView([district.centroidLat, district.centroidLng], 10);
    }

    // Render station rank list
    renderStationRankList(stations);

    // Show crime breakdown for this district
    renderCrimeBars(district.topCrimes || []);

    // Update status
    if (ddEls.status) {
      ddEls.status.innerHTML = `<span class="live-dot"></span> ${escapeHtml(district.districtName)} · ${formatNumber(district.caseCount)} cases · ${stations.length} stations`;
    }

    // ── Fetch district-specific case markers for the Case Browser ───
    // Done in background so it doesn't block the map render above.
    try {
      const distPayload = await api(`/api/dashboard?district_id=${district.districtId}&days=${ddState.days}`);
      ddState.districtMarkers = (distPayload.dashboard || distPayload).markers || [];
    } catch (err) {
      console.warn('Could not fetch district markers for case browser:', err);
      ddState.districtMarkers = [];
    }
  }

  // ── Reset to statewide view ──────────────────────────────────────
  function resetDdMap() {
    ddState.selectedDistrict = null;
    ddState.districtMarkers = [];
    ddState.stationLayerGroup.clearLayers();
    if (ddEls.stationPanel) ddEls.stationPanel.setAttribute('hidden', '');
    if (ddEls.resetBtn) ddEls.resetBtn.style.display = 'none';
    setBreadcrumb([{ label: 'Karnataka State' }]);

    const districts = ddState.data?.districts || [];
    renderDistrictMarkers(districts);
    renderDistrictRankList(districts);
    // Top-5 statewide crimes
    const allCrimes = buildStatewideCrimes(districts);
    renderCrimeBars(allCrimes);

    if (ddEls.status) {
      ddEls.status.innerHTML = `<span class="live-dot"></span> ${districts.length} districts · ${formatNumber(ddState.data?.totalCases || 0)} total cases`;
    }
    ddState.map.setView([15.3173, 75.7139], 7);
  }

  // ── Aggregate statewide crime counts ─────────────────────────────
  function buildStatewideCrimes(districts) {
    const counter = {};
    (districts || []).forEach(d => {
      (d.topCrimes || []).forEach(c => {
        counter[c.crimeName] = (counter[c.crimeName] || 0) + c.caseCount;
      });
    });
    return Object.entries(counter)
      .map(([crimeName, caseCount]) => ({ crimeName, caseCount }))
      .sort((a, b) => b.caseCount - a.caseCount)
      .slice(0, 8);
  }

  // ── Fetch data and render ────────────────────────────────────────
  async function loadDdMap() {
    initDdMap();
    if (ddEls.status) ddEls.status.innerHTML = `<span class="pulse-icon"></span> Fetching district data...`;

    try {
      const payload = await api(`/api/district_map?days=${ddState.days}`);
      ddState.data = payload;
      const districts = payload.districts || [];
      renderDistrictMarkers(districts);
      renderDistrictRankList(districts);
      renderCrimeBars(buildStatewideCrimes(districts));
      setBreadcrumb([{ label: 'Karnataka State' }]);
      if (ddEls.status) {
        ddEls.status.innerHTML = `<span class="live-dot"></span> ${districts.length} districts · ${formatNumber(payload.totalCases || 0)} cases`;
      }
    } catch (err) {
      if (ddEls.status) {
        ddEls.status.innerHTML = `<span style="color:#ef4444">⚠ ${escapeHtml(err.message)}</span>`;
      }
      console.error('District map load error:', err);
    }
  }

  // ── Wire up global drill helper (used from Leaflet popup HTML) ───
  window._ddDrillDistrict = function (districtId) {
    const district = (ddState.data?.districts || []).find(d => d.districtId === districtId);
    if (district) drillIntoDistrict(district);
  };

  // ── Case browser for drill-down stations ─────────────────────────
  // Uses ddState.districtMarkers (fetched per district) instead of the
  // statewide state.dashboard.markers which is capped at 500 entries.
  window._ddOpenCaseBrowser = function (stationName, stationId, districtId) {
    const allMarkers = ddState.districtMarkers;

    // Match by stationId first (most reliable)
    let cases = allMarkers.filter(m => stationId && Number(m.stationId) === Number(stationId));

    // Fallback: match by station name substring
    if (!cases.length && stationName) {
      const needle = String(stationName).trim().toLowerCase();
      cases = allMarkers.filter(m => {
        const hay = String(m.stationName || '').trim().toLowerCase();
        return hay.includes(needle) || needle.includes(hay);
      });
    }

    // If district markers not loaded yet, fall back to the existing helper
    if (!allMarkers.length) {
      window.openCaseBrowser(stationName, stationId, districtId);
      return;
    }

    // Re-use existing modal infrastructure
    state.currentBrowserStationName = stationName || 'Police Station';
    state.currentBrowserCases = cases;
    els.caseBrowserTitle.textContent = `${stationName} • Registered Incidents`;
    els.caseBrowserModal.hidden = false;
    els.modalCaseSearch.value = '';
    // renderCaseList is a global function defined in the main module
    renderCaseList();
  };

  // ── Window select change ─────────────────────────────────────────
  if (ddEls.windowSelect) {
    ddEls.windowSelect.addEventListener('change', () => {
      ddState.days = Number(ddEls.windowSelect.value) || 365;
      resetDdMap();
      loadDdMap();
    });
  }

  // ── Reset button ─────────────────────────────────────────────────
  if (ddEls.resetBtn) {
    ddEls.resetBtn.addEventListener('click', resetDdMap);
  }

  // ── Lazy initialise when section scrolls into view ───────────────
  if (ddEls.canvas && typeof IntersectionObserver !== 'undefined') {
    let loaded = false;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loaded) {
        loaded = true;
        observer.disconnect();
        loadDdMap();
      }
    }, { threshold: 0.1 });
    observer.observe(ddEls.canvas);
  } else if (ddEls.canvas) {
    // Fallback: load after main bootstrap settles
    setTimeout(loadDdMap, 1200);
  }
})();

/* ═══════════════════════════════════════════════════════════════
   CRIME STATISTICS OVERVIEW — Self-contained IIFE module
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Shared Chart.js dark theme defaults ─────────────────────── */
  const CHART_FONT = "'IBM Plex Mono', 'Inter', monospace";
  const GRID_COLOR = 'rgba(148,163,184,0.10)';
  const TICK_COLOR = '#64748b';
  const LABEL_COLOR = '#94a3b8';

  function applyDarkDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = LABEL_COLOR;
    Chart.defaults.font.family = CHART_FONT;
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.color = LABEL_COLOR;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(9,13,22,0.95)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(6,182,212,0.35)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  }

  /* ── 1. Crime by Category — horizontal bar chart ─────────────── */
  function initCategoryChart() {
    const canvas = document.getElementById('csoCategoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const categories = ['Theft', 'Assault', 'Robbery', 'Snatching', 'Fraud', 'Vandalism', 'Burglary', 'Cyber Crime'];
    const counts     = [1142,    874,       563,       421,        388,     267,        214,       418];

    // Gradient from cyan → teal
    const ctx = canvas.getContext('2d');
    const totalBars = categories.length;
    const barColors = categories.map((_, i) => {
      const t = i / (totalBars - 1);
      const r = Math.round(6   + t * (13  - 6));
      const g = Math.round(182 + t * (148 - 182));
      const b = Math.round(212 + t * (189 - 212));
      return `rgba(${r},${g},${b},0.85)`;
    });
    const hoverColors = barColors.map(c => c.replace('0.85', '1'));

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Incidents',
          data: counts,
          backgroundColor: barColors,
          hoverBackgroundColor: hoverColors,
          borderRadius: 5,
          borderSkipped: false,
          borderWidth: 0,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        layout: { padding: { right: 10 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.x.toLocaleString('en-IN')} cases`,
            }
          }
        },
        scales: {
          x: {
            grid: { color: GRID_COLOR, drawBorder: false },
            border: { display: false },
            ticks: {
              color: TICK_COLOR,
              callback: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v,
            }
          },
          y: {
            grid: { display: false, drawBorder: false },
            border: { display: false },
            ticks: { color: '#cbd5e1', font: { size: 11 } }
          }
        }
      }
    });
  }

  /* ── 2. Month-over-Month Trend — line chart ──────────────────── */
  function initTrendChart() {
    const canvas = document.getElementById('csoTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const months     = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const thisYear   = [3980, 4210, 4430, 4185, 4430, 4287];
    const lastYear   = [3620, 3850, 4100, 3975, 4060, 3920];

    const ctx = canvas.getContext('2d');

    // Gradient fill under this-year line
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0,   'rgba(6,182,212,0.28)');
    gradient.addColorStop(0.6, 'rgba(6,182,212,0.06)');
    gradient.addColorStop(1,   'rgba(6,182,212,0)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'This Year',
            data: thisYear,
            borderColor: '#06b6d4',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#06b6d4',
            pointBorderColor: '#090d16',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Last Year',
            data: lastYear,
            borderColor: 'rgba(148,163,184,0.5)',
            borderWidth: 1.8,
            borderDash: [5, 4],
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: 'rgba(148,163,184,0.5)',
            pointBorderColor: '#090d16',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 14,
              boxHeight: 2,
              usePointStyle: true,
              pointStyle: 'line',
              color: LABEL_COLOR,
              font: { size: 11 },
              padding: 16,
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')} crimes`,
            }
          }
        },
        scales: {
          x: {
            grid: { color: GRID_COLOR, drawBorder: false },
            border: { display: false },
            ticks: { color: TICK_COLOR }
          },
          y: {
            grid: { color: GRID_COLOR, drawBorder: false },
            border: { display: false },
            ticks: {
              color: TICK_COLOR,
              callback: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v,
            }
          }
        }
      }
    });
  }

  /* ── 3. District Comparison Table ───────────────────────────── */
  const DISTRICT_DATA = [
    { name: 'Bengaluru City',  total: 8142, solved: 5102, status: 'alert'  },
    { name: 'Mysuru',          total: 4231, solved: 2987, status: 'watch'  },
    { name: 'Kalaburagi',      total: 3870, solved: 2213, status: 'alert'  },
    { name: 'Belagavi',        total: 3541, solved: 2486, status: 'watch'  },
    { name: 'Shivamogga',      total: 2894, solved: 2183, status: 'normal' },
    { name: 'Davanagere',      total: 2647, solved: 1852, status: 'normal' },
    { name: 'Hubballi-Dharwad',total: 2398, solved: 1531, status: 'watch'  },
    { name: 'Mangaluru',       total: 2154, solved: 1720, status: 'normal' },
    { name: 'Tumakuru',        total: 1987, solved: 1347, status: 'normal' },
    { name: 'Vijayapura',      total: 1762, solved: 1012, status: 'alert'  },
  ].map(d => ({ ...d, pending: d.total - d.solved, rate: Math.round((d.solved / d.total) * 1000) / 10 }));

  function statusConfig(s) {
    if (s === 'alert')  return { cls: 'cso-dot-red',    label: 'Alert',  color: '#f87171' };
    if (s === 'watch')  return { cls: 'cso-dot-yellow', label: 'Watch',  color: '#fbbf24' };
    return                     { cls: 'cso-dot-green',  label: 'Normal', color: '#34d399' };
  }

  function rateClass(rate) {
    if (rate >= 60) return 'cso-rate-high';
    if (rate >= 40) return 'cso-rate-mid';
    return 'cso-rate-low';
  }

  function fmt(n) {
    return n.toLocaleString('en-IN');
  }

  function initDistrictTable() {
    const tbody = document.getElementById('csoDistrictTableBody');
    if (!tbody) return;

    tbody.innerHTML = DISTRICT_DATA.map(d => {
      const sc  = statusConfig(d.status);
      const rc  = rateClass(d.rate);
      const pct = d.rate.toFixed(1);
      return `
        <tr>
          <td class="cso-td-district">${d.name}</td>
          <td class="cso-td-count">${fmt(d.total)}</td>
          <td class="cso-td-count" style="color:#34d399">${fmt(d.solved)}</td>
          <td class="cso-td-count" style="color:#fbbf24">${fmt(d.pending)}</td>
          <td>
            <div class="cso-progress-wrap">
              <div class="cso-progress-track">
                <div class="cso-progress-fill ${rc}" style="width:${pct}%"></div>
              </div>
              <span class="cso-progress-pct">${pct}%</span>
            </div>
          </td>
          <td>
            <div class="cso-td-status" style="color:${sc.color}">
              <span class="cso-status-dot ${sc.cls}"></span>
              ${sc.label}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* ── Bootstrap ───────────────────────────────────────────────── */
  function initCSO() {
    if (typeof Chart === 'undefined') {
      // Chart.js might still be loading — retry once
      setTimeout(initCSOCharts, 600);
    } else {
      initCSOCharts();
    }
    initDistrictTable();
  }

  function initCSOCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('[CSO] Chart.js not available — charts skipped.');
      return;
    }
    applyDarkDefaults();
    initCategoryChart();
    initTrendChart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCSO);
  } else {
    initCSO();
  }
})();
