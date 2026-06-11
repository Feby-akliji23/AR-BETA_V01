import type { HotspotConfig, ModelViewerElement } from "./types.js";
import { projectConfig } from "./config.js";

interface DebugModelViewer extends ModelViewerElement {
  getFieldOfView?: () => number;
  positionAndNormalFromPoint?: (
    clientX: number,
    clientY: number
  ) => { position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } } | null;
}

export interface DebugPanelOptions {
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  buttonText: HTMLElement;
  navDots: HTMLElement;
  previewHotspotElements: HTMLElement[];
  focusCamera: (orbit: string, target: string, fieldOfView: string, onComplete: () => void) => void;
}

interface DebugPick {
  cameraDisplay: string;
  positionDisplay: string;
  normalDisplay: string;
  orbitCamera: string;
  targetCamera: string;
  fieldOfViewCamera: string;
  markerSlot: HTMLElement;
}

interface ValueRow {
  container: HTMLElement;
  set(value: string): void;
  get(): string;
}

const DEG = 180 / Math.PI;

function r2d(rad: number, decimals: number): string {
  return (rad * DEG).toFixed(decimals);
}

function getFrame() {
  const { preview } = projectConfig;
  const isDesktop = window.innerWidth >= preview.desktopBreakpoint;
  return { data: isDesktop ? preview.desktop : preview.mobile, isDesktop };
}

function getConfiguredFieldOfView(modelViewer: DebugModelViewer, fallback: string): number {
  const actual = modelViewer.getFieldOfView?.();
  const idealAspect = modelViewer.getIdealAspect?.();
  const rect = modelViewer.getBoundingClientRect();
  const aspect = rect.height > 0 ? rect.width / rect.height : Number.NaN;

  if (actual !== undefined && idealAspect !== undefined && Number.isFinite(aspect)) {
    const adjustment = Math.max(1, idealAspect / aspect);
    return (2 * Math.atan(Math.tan((actual * Math.PI) / 360) / adjustment) * 180) / Math.PI;
  }

  const configured = Number.parseFloat(modelViewer.fieldOfView ?? "");
  return Number.isFinite(configured) ? configured : Number.parseFloat(fallback);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function css(element: HTMLElement, text: string): void {
  element.style.cssText = text;
}

function make<T extends HTMLElement>(tag: string, styles?: string): T {
  const el = document.createElement(tag) as T;
  if (styles) css(el, styles);
  return el;
}

function sectionTitle(text: string): HTMLElement {
  const div = make("div");
  div.textContent = text;
  css(
    div,
    `font-size:10px;font-weight:bold;color:rgba(255,255,255,.5);text-transform:uppercase;
     letter-spacing:.07em;border-top:1px solid rgba(255,255,255,.1);
     padding-top:10px;margin:10px 0 8px`
  );
  return div;
}

// ── Value row ─────────────────────────────────────────────────────────────────

function makeValueRow(label: string, withPin: boolean): ValueRow {
  let locked = false;
  let current = "—";

  const container = make("div", "margin-bottom:8px");
  const labelRow = make(
    "div",
    "display:flex;align-items:center;justify-content:space-between;margin-bottom:2px"
  );
  const labelEl = make("span", "font-size:10px;color:rgba(255,255,255,.42)");
  labelEl.textContent = label;

  const btnGroup = make("div", "display:flex;gap:4px;align-items:center");

  if (withPin) {
    const pinBtn = make<HTMLButtonElement>("button");
    pinBtn.type = "button";
    pinBtn.textContent = "pin";
    css(
      pinBtn,
      `border:1px solid rgba(255,255,255,.18);background:none;color:rgba(255,255,255,.38);
       border-radius:3px;padding:1px 5px;font-size:9px;cursor:pointer;font-family:monospace`
    );
    const syncPin = () => {
      pinBtn.textContent = locked ? "live" : "pin";
      pinBtn.style.color = locked ? "#ffd060" : "rgba(255,255,255,.38)";
      pinBtn.style.borderColor = locked ? "rgba(255,208,96,.35)" : "rgba(255,255,255,.18)";
    };
    pinBtn.addEventListener("click", () => {
      locked = !locked;
      syncPin();
    });
    btnGroup.appendChild(pinBtn);
  }

  const copyBtn = make<HTMLButtonElement>("button");
  copyBtn.type = "button";
  copyBtn.textContent = "copy";
  css(
    copyBtn,
    `background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:3px;
     padding:1px 6px;font-size:10px;cursor:pointer;font-family:monospace`
  );
  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(current)
      .then(() => {
        copyBtn.textContent = "✓";
        window.setTimeout(() => {
          copyBtn.textContent = "copy";
        }, 1200);
      })
      .catch(() => {});
  });

  btnGroup.appendChild(copyBtn);
  labelRow.append(labelEl, btnGroup);

  const valueEl = make(
    "code",
    "display:block;font-size:11px;color:#7effa8;word-break:break-all;line-height:1.5"
  );
  valueEl.textContent = current;
  container.append(labelRow, valueEl);

  return {
    container,
    set(value: string) {
      if (locked) return;
      current = value;
      valueEl.textContent = value;
    },
    get() {
      return current;
    },
  };
}

// ── Config markers (blue) ─────────────────────────────────────────────────────

function createConfigMarker(
  hotspot: HotspotConfig,
  index: number,
  modelViewer: HTMLElement,
  isDesktop: boolean
): HTMLElement {
  const anchor = isDesktop ? hotspot.anchor.desktop : hotspot.anchor.mobile;
  const slot = make("div");
  slot.slot = `hotspot-dbg-c-${index}`;
  slot.dataset.position = `${anchor.position.x}m ${anchor.position.y}m ${anchor.position.z}m`;
  slot.dataset.normal = `${anchor.normal.x}m ${anchor.normal.y}m ${anchor.normal.z}m`;

  const dot = make("div");
  css(
    dot,
    `width:11px;height:11px;border-radius:50%;background:#3b82f6;
     border:2px solid #fff;transform:translate(-50%,-50%);
     box-shadow:0 0 5px rgba(59,130,246,.8);pointer-events:none`
  );
  const label = make("span");
  label.textContent = hotspot.buttonText;
  css(
    label,
    `position:absolute;top:-15px;left:50%;transform:translateX(-50%);
     font-size:9px;font-family:monospace;color:#fff;
     background:rgba(59,130,246,.85);border-radius:3px;padding:0 3px;
     white-space:nowrap;pointer-events:none`
  );
  slot.append(dot, label);
  modelViewer.appendChild(slot);
  return slot;
}

// ── Pick markers (red) ────────────────────────────────────────────────────────

function createPickMarker(
  num: number,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  modelViewer: HTMLElement
): HTMLElement {
  const slot = make("div");
  slot.slot = `hotspot-dbg-p-${num}`;
  slot.dataset.position = `${px}m ${py}m ${pz}m`;
  slot.dataset.normal = `${nx}m ${ny}m ${nz}m`;

  const dot = make("div");
  css(
    dot,
    `width:13px;height:13px;border-radius:50%;background:#ff1744;
     border:2px solid #fff;transform:translate(-50%,-50%);
     box-shadow:0 0 6px rgba(255,23,68,.9);pointer-events:none`
  );
  const numLabel = make("span");
  numLabel.textContent = String(num);
  css(
    numLabel,
    `position:absolute;top:-16px;left:50%;transform:translateX(-50%);
     font-size:9px;font-family:monospace;color:#fff;
     background:rgba(255,23,68,.85);border-radius:3px;padding:0 3px;
     white-space:nowrap;pointer-events:none`
  );
  slot.append(dot, numLabel);
  modelViewer.appendChild(slot);
  return slot;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function setupDebugPanel(
  modelViewer: ModelViewerElement,
  hotspots: HotspotConfig[],
  options: DebugPanelOptions
): void {
  const mv = modelViewer as DebugModelViewer;
  const mvEl = modelViewer as HTMLElement;

  const picks: DebugPick[] = [];
  let currentPickIndex = -1;
  let isMinimized = false;

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panel = make("div");
  panel.id = "debug-panel";
  const PANEL_FULL_CSS = `position:fixed;top:68px;left:10px;width:276px;
     max-height:calc(100dvh - 80px);overflow-y:auto;
     background:rgba(14,14,22,.95);backdrop-filter:blur(10px);
     border:1px solid rgba(255,255,255,.1);border-radius:10px;
     padding:12px;z-index:9999;color:#fff;font-family:monospace;font-size:11px;
     box-shadow:0 4px 24px rgba(0,0,0,.5);scrollbar-width:thin;transition:none`;
  const PANEL_MINI_CSS = `position:fixed;top:68px;left:10px;
     background:rgba(14,14,22,.95);backdrop-filter:blur(10px);
     border:1px solid rgba(255,255,255,.15);border-radius:20px;
     padding:7px 13px;z-index:9999;color:#fff;font-family:monospace;font-size:11px;
     box-shadow:0 2px 10px rgba(0,0,0,.4);cursor:pointer;display:flex;
     align-items:center;gap:9px;white-space:nowrap`;
  css(panel, PANEL_FULL_CSS);

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = make(
    "div",
    "display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;margin-bottom:6px"
  );
  const titleEl = make("span", "font-weight:bold;color:rgba(255,255,255,.78);font-size:11px");
  titleEl.textContent = "Debug Preview";

  const minimizeBtn = make<HTMLButtonElement>("button");
  minimizeBtn.type = "button";
  minimizeBtn.title = "Perkecil";
  minimizeBtn.textContent = "─";
  css(
    minimizeBtn,
    `display:grid;width:26px;height:24px;place-items:center;justify-self:end;
     border:1px solid rgba(255,255,255,.12);border-radius:6px;
     background:rgba(255,255,255,.06);color:rgba(255,255,255,.62);
     font-size:14px;cursor:pointer;padding:0;line-height:1;flex-shrink:0`
  );
  minimizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMinimize();
  });

  header.append(titleEl, minimizeBtn);
  panel.appendChild(header);

  // ── Mini pill content (shown when minimized) ───────────────────────────────
  const miniPill = make("div", "display:none;align-items:center;gap:6px");
  const miniIcon = make(
    "span",
    "display:grid;width:20px;height:20px;place-items:center;border-radius:50%;background:rgba(255,255,255,.08);font-size:12px"
  );
  miniIcon.textContent = "⚙";
  const miniLabel = make("span", "font-size:11px;color:rgba(255,255,255,.78);font-weight:bold");
  miniLabel.textContent = "DBG";
  miniPill.append(miniIcon, miniLabel);
  panel.appendChild(miniPill);

  // ── Collapsible body ───────────────────────────────────────────────────────
  const body = make("div");

  const bpEl = make("div", "font-size:10px;color:rgba(255,255,255,.3);margin-bottom:2px");
  body.appendChild(bpEl);

  // Kamera section
  body.appendChild(sectionTitle("Kamera"));
  const orbitRow = makeValueRow("homeOrbit", true);
  const targetRow = makeValueRow("homeTarget", true);
  const fovRow = makeValueRow("fieldOfView", true);
  body.append(orbitRow.container, targetRow.container, fovRow.container);

  // Hotspot section
  body.appendChild(sectionTitle("Hotspot"));

  const pickBtn = make<HTMLButtonElement>("button");
  pickBtn.type = "button";
  pickBtn.textContent = "⊕ Ambil Posisi";
  css(
    pickBtn,
    `width:100%;background:rgba(126,255,168,.12);border:1px solid rgba(126,255,168,.28);
     color:#7effa8;border-radius:5px;padding:5px 0;font-size:11px;cursor:pointer;
     font-family:monospace;margin-bottom:8px`
  );
  body.appendChild(pickBtn);

  const hsCameraRow = makeValueRow("camera", false);
  const hsPosRow = makeValueRow("position", false);
  const hsNormalRow = makeValueRow("normal", false);
  [hsCameraRow, hsPosRow, hsNormalRow].forEach((r) => {
    r.container.style.display = "none";
  });
  body.append(hsCameraRow.container, hsPosRow.container, hsNormalRow.container);

  // Pick list section
  const pickSection = make("div", "display:none");
  const pickList = make("div");
  const clearAllBtn = make<HTMLButtonElement>("button");
  clearAllBtn.type = "button";
  clearAllBtn.textContent = "Hapus Semua Pick";
  css(
    clearAllBtn,
    `width:100%;background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.28);
     color:#ff9090;border-radius:5px;padding:4px 0;font-size:10px;cursor:pointer;
     font-family:monospace;margin-top:6px`
  );
  clearAllBtn.addEventListener("click", clearAllPicks);
  pickSection.append(sectionTitle("Hasil Pick"), pickList, clearAllBtn);
  body.appendChild(pickSection);

  panel.appendChild(body);

  // ── Minimize/expand ────────────────────────────────────────────────────────
  miniPill.addEventListener("click", () => {
    if (isMinimized) toggleMinimize();
  });

  function toggleMinimize(): void {
    isMinimized = !isMinimized;
    if (isMinimized) {
      css(panel, PANEL_MINI_CSS);
      header.style.display = "none";
      body.style.display = "none";
      miniPill.style.display = "flex";
    } else {
      css(panel, PANEL_FULL_CSS);
      header.style.display = "grid";
      body.style.display = "block";
      miniPill.style.display = "none";
    }
  }

  // ── Config markers (blue) ──────────────────────────────────────────────────
  const isDesktop = window.innerWidth >= projectConfig.preview.desktopBreakpoint;
  hotspots.forEach((hotspot, index) => createConfigMarker(hotspot, index, mvEl, isDesktop));

  // ── Camera live update ─────────────────────────────────────────────────────
  function updateCamera(): void {
    if (!mv.getCameraOrbit || !mv.getCameraTarget) return;
    const orbit = mv.getCameraOrbit();
    const target = mv.getCameraTarget();
    if (!orbit || !target) return;

    const { data: frame, isDesktop } = getFrame();
    bpEl.textContent = `${isDesktop ? "Desktop" : "Mobile"} · ${window.innerWidth}px`;
    orbitRow.set(`${r2d(orbit.theta, 1)}deg ${r2d(orbit.phi, 2)}deg ${orbit.radius.toFixed(2)}m`);
    targetRow.set(`${target.x.toFixed(2)}m ${target.y.toFixed(2)}m ${target.z.toFixed(2)}m`);
    fovRow.set(getConfiguredFieldOfView(mv, frame.fieldOfView).toFixed(1) + "deg");
  }

  modelViewer.addEventListener("camera-change", updateCamera);
  window.setTimeout(updateCamera, 200);

  // ── Pick mode ──────────────────────────────────────────────────────────────
  pickBtn.addEventListener("click", () => {
    if (!mv.positionAndNormalFromPoint) return;

    const overlay = make("div");
    css(overlay, `position:fixed;inset:0;z-index:9998;cursor:crosshair;background:rgba(126,255,168,.03)`);
    const hint = make("div");
    hint.textContent = "Klik pada model · Esc untuk batal";
    css(
      hint,
      `position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
       background:rgba(14,14,22,.92);color:#7effa8;padding:6px 16px;
       border-radius:20px;font-size:12px;font-family:monospace;white-space:nowrap;
       border:1px solid rgba(126,255,168,.28);pointer-events:none`
    );
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    pickBtn.textContent = "⊕ Klik pada model...";
    pickBtn.disabled = true;

    function exitOverlay(): void {
      overlay.remove();
      pickBtn.textContent = "⊕ Ambil Posisi";
      pickBtn.disabled = false;
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e: KeyboardEvent): void {
      if (e.key === "Escape") exitOverlay();
    }
    document.addEventListener("keydown", onEsc);
    overlay.addEventListener("click", (e: MouseEvent) => {
      exitOverlay();
      handlePick(e.clientX, e.clientY);
    });
  });

  function handlePick(clientX: number, clientY: number): void {
    if (!mv.positionAndNormalFromPoint || !mv.getCameraOrbit || !mv.getCameraTarget) return;
    const result = mv.positionAndNormalFromPoint(clientX, clientY);
    if (!result) return;
    const rawOrbit = mv.getCameraOrbit();
    const rawTarget = mv.getCameraTarget();
    if (!rawOrbit || !rawTarget) return;

    const { position: p, normal: n } = result;
    const { data: frame, isDesktop } = getFrame();
    const fieldOfView = getConfiguredFieldOfView(mv, frame.fieldOfView);
    const orbitCamera = `${r2d(rawOrbit.theta, 4)}deg ${r2d(rawOrbit.phi, 4)}deg ${rawOrbit.radius.toFixed(4)}m`;
    const targetCamera = `${rawTarget.x.toFixed(4)}m ${rawTarget.y.toFixed(4)}m ${rawTarget.z.toFixed(4)}m`;
    const fieldOfViewCamera = `${fieldOfView.toFixed(2)}deg`;
    const cameraDisplay = `${isDesktop ? "desktop" : "mobile"}: { orbit: "${orbitCamera}", target: "${targetCamera}", fieldOfView: "${fieldOfViewCamera}" }`;
    const positionDisplay = `{ x: ${p.x.toFixed(6)}, y: ${p.y.toFixed(6)}, z: ${p.z.toFixed(6)} }`;
    const normalDisplay = `{ x: ${n.x.toFixed(6)}, y: ${n.y.toFixed(6)}, z: ${n.z.toFixed(6)} }`;

    hsCameraRow.container.style.display = "";
    hsPosRow.container.style.display = "";
    hsNormalRow.container.style.display = "";
    hsCameraRow.set(cameraDisplay);
    hsPosRow.set(positionDisplay);
    hsNormalRow.set(normalDisplay);

    const pickNum = picks.length + 1;
    const markerSlot = createPickMarker(pickNum, p.x, p.y, p.z, n.x, n.y, n.z, mvEl);

    const pick: DebugPick = {
      cameraDisplay,
      positionDisplay,
      normalDisplay,
      orbitCamera,
      targetCamera,
      fieldOfViewCamera,
      markerSlot,
    };
    picks.push(pick);

    const listItem = buildPickListItem(pick);
    pickList.appendChild(listItem);
    pickSection.style.display = "";

    currentPickIndex = picks.length - 1;
    updateNavText();
  }

  function buildPickListItem(pick: DebugPick): HTMLElement {
    const num = picks.length; // captured at build time (pick is already pushed)
    const item = make("div", "display:flex;align-items:center;gap:4px;margin-bottom:4px");

    const badge = make("span");
    badge.textContent = String(num);
    css(
      badge,
      `background:rgba(255,23,68,.7);color:#fff;border-radius:3px;padding:0 4px;font-size:9px;flex-shrink:0`
    );

    const coords = make(
      "span",
      "font-size:10px;color:rgba(255,255,255,.52);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
    );
    const m = pick.positionDisplay.match(/x:\s*([-\d.]+).*?y:\s*([-\d.]+).*?z:\s*([-\d.]+)/);
    coords.textContent = m
      ? `${Number(m[1]).toFixed(1)}, ${Number(m[2]).toFixed(1)}, ${Number(m[3]).toFixed(1)}`
      : "—";
    coords.title = pick.positionDisplay;

    const tryBtn = make<HTMLButtonElement>("button");
    tryBtn.type = "button";
    tryBtn.textContent = "coba";
    css(
      tryBtn,
      `background:rgba(126,255,168,.15);border:1px solid rgba(126,255,168,.28);
      color:#7effa8;border-radius:3px;padding:1px 5px;font-size:9px;cursor:pointer;font-family:monospace;flex-shrink:0`
    );
    tryBtn.addEventListener("click", () => {
      const index = picks.indexOf(pick);
      if (index === -1) return;
      currentPickIndex = index;
      updateNavText();
      showPickValues(pick);
      options.focusCamera(pick.orbitCamera, pick.targetCamera, pick.fieldOfViewCamera, updateNavText);
    });

    const deleteBtn = make<HTMLButtonElement>("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Hapus";
    css(
      deleteBtn,
      `background:rgba(255,100,100,.12);border:1px solid rgba(255,100,100,.28);
       color:#ff9090;border-radius:3px;padding:1px 5px;font-size:9px;
       cursor:pointer;font-family:monospace;flex-shrink:0`
    );
    deleteBtn.addEventListener("click", () => {
      const index = picks.indexOf(pick);
      if (index === -1 || !window.confirm(`Hapus Pick ${index + 1}?`)) return;

      pick.markerSlot.remove();
      item.remove();
      picks.splice(index, 1);
      if (currentPickIndex >= picks.length) currentPickIndex = picks.length - 1;

      if (picks.length === 0) {
        pickSection.style.display = "none";
        [hsCameraRow, hsPosRow, hsNormalRow].forEach((row) => {
          row.container.style.display = "none";
        });
      } else {
        const activePick = picks[currentPickIndex];
        if (activePick) showPickValues(activePick);
      }
      updateNavText();
    });

    item.append(badge, coords, tryBtn, deleteBtn);
    return item;
  }

  function showPickValues(pick: DebugPick): void {
    hsCameraRow.container.style.display = "";
    hsPosRow.container.style.display = "";
    hsNormalRow.container.style.display = "";
    hsCameraRow.set(pick.cameraDisplay);
    hsPosRow.set(pick.positionDisplay);
    hsNormalRow.set(pick.normalDisplay);
  }

  // ── Nav interception ───────────────────────────────────────────────────────
  function handlePrev(e: Event): void {
    e.stopImmediatePropagation();
    if (picks.length === 0) return;
    currentPickIndex = (currentPickIndex - 1 + picks.length) % picks.length;
    navigateToPick();
  }

  function handleNext(e: Event): void {
    e.stopImmediatePropagation();
    if (picks.length === 0) return;
    currentPickIndex = (currentPickIndex + 1) % picks.length;
    navigateToPick();
  }

  function navigateToPick(): void {
    const pick = picks[currentPickIndex];
    if (!pick) return;
    updateNavText();
    showPickValues(pick);
    options.focusCamera(pick.orbitCamera, pick.targetCamera, pick.fieldOfViewCamera, updateNavText);
  }

  function updateNavText(): void {
    options.buttonText.textContent = picks.length === 0 ? "—" : `Pick ${currentPickIndex + 1}`;
  }

  options.prevButton.addEventListener("click", handlePrev, { capture: true });
  options.nextButton.addEventListener("click", handleNext, { capture: true });

  // ── Hide app UI elements ───────────────────────────────────────────────────
  options.previewHotspotElements.forEach((el) => {
    el.style.display = "none";
  });
  options.navDots.style.display = "none";
  updateNavText();

  // ── Clear all picks ────────────────────────────────────────────────────────
  function clearAllPicks(): void {
    picks.forEach((p) => p.markerSlot.remove());
    pickList.innerHTML = "";
    picks.length = 0;
    currentPickIndex = -1;
    pickSection.style.display = "none";
    [hsCameraRow, hsPosRow, hsNormalRow].forEach((r) => {
      r.container.style.display = "none";
    });
    updateNavText();
  }

  document.body.appendChild(panel);
}
