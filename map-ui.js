import { MAP_SIZE } from './config.js';

export function createMapUI({ onMarkersChange = () => {}, onOpenChange = () => {} } = {}) {
  const screen = document.getElementById('map-screen');
  const mapImage = document.getElementById('large-map-image');
  const largePins = document.getElementById('large-map-pins');
  const miniPins = document.getElementById('minimap-pins');
  const playerDot = document.getElementById('player-map-dot');
  const count = document.getElementById('map-marker-count');
  const deleteButton = document.getElementById('delete-marker');
  const closeButton = document.getElementById('close-map');
  const coordReadout = document.getElementById('coords-readout');
  const zoneName = document.getElementById('zone-name');
  let markers = [];
  let selectedId = null;
  let isOpen = false;
  let nextId = 1;

  function markerNode(marker, mini = false) {
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'map-pin' + (marker.id === selectedId ? ' selected' : '');
    pin.style.left = `${marker.u * 100}%`; pin.style.top = `${marker.v * 100}%`;
    pin.setAttribute('aria-label', `Markierung ${marker.id}${mini ? '' : ' auswählen'}`);
    pin.title = mini ? 'Deine private Markierung' : 'Zum Löschen auswählen';
    if (!mini) pin.addEventListener('click', event => { event.stopPropagation(); selectedId = marker.id; renderPins(); });
    else pin.tabIndex = -1;
    return pin;
  }
  function renderPins() {
    largePins.replaceChildren(); miniPins.replaceChildren();
    for (const marker of markers) {
      largePins.appendChild(markerNode(marker, false));
      miniPins.appendChild(markerNode(marker, true));
    }
    count.textContent = `${markers.length} MARKIERUNG${markers.length === 1 ? '' : 'EN'}`;
    deleteButton.disabled = selectedId === null;
  }
  function publish() { onMarkersChange(markers.map(m => ({ ...m }))); }
  function addMarker(u, v) {
    const marker = { id: nextId++, u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
    markers.push(marker); selectedId = marker.id; renderPins(); publish();
  }
  function deleteSelected() {
    if (selectedId === null) return;
    markers = markers.filter(m => m.id !== selectedId); selectedId = null; renderPins(); publish();
  }
  function open() {
    if (isOpen) return;
    isOpen = true; screen.classList.remove('hidden'); document.exitPointerLock?.();
    renderPins(); onOpenChange(true);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; screen.classList.add('hidden'); onOpenChange(false);
  }
  function toggle() { isOpen ? close() : open(); }
  mapImage.addEventListener('click', event => {
    if (!isOpen) return;
    const r = mapImage.getBoundingClientRect();
    const u = (event.clientX - r.left) / r.width, v = (event.clientY - r.top) / r.height;
    addMarker(u, v);
  });
  deleteButton.addEventListener('click', deleteSelected);
  closeButton.addEventListener('click', close);
  window.addEventListener('keydown', event => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (isOpen) { event.preventDefault(); deleteSelected(); }
    }
  });
  function updatePlayerPosition(x, z, region = 'INSEL') {
    const u = Math.max(0, Math.min(1, x / MAP_SIZE + .5));
    const v = Math.max(0, Math.min(1, z / MAP_SIZE + .5));
    playerDot.style.left = `${u * 100}%`; playerDot.style.top = `${v * 100}%`;
    coordReadout.textContent = `X ${Math.round(x).toString().padStart(3, '0')} · Z ${Math.round(z).toString().padStart(3, '0')}`;
    zoneName.textContent = region;
  }
  function getMarkers() { return markers.map(m => ({ ...m })); }
  function getOpen() { return isOpen; }
  return { open, close, toggle, addMarker, deleteSelected, updatePlayerPosition, getMarkers, getOpen };
}
