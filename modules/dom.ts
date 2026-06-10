import type { ModelViewerElement } from "./types";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemen #${id} tidak ditemukan`);
  return element as T;
}

export function getDom() {
  return {
    canvas: byId<HTMLCanvasElement>("scene"),
    modelViewer: byId<ModelViewerElement>("model-viewer"),
    appTitles: Array.from(document.querySelectorAll<HTMLElement>("[data-app-title]")),
    appVersions: Array.from(document.querySelectorAll<HTMLElement>("[data-app-version]")),
    modelName: byId<HTMLElement>("active-model-name"),
    hotspotCount: byId<HTMLElement>("hotspot-count"),
    statusText: byId<HTMLElement>("status"),
    connectionBanner: byId<HTMLElement>("connection-banner"),
    enterArButton: byId<HTMLButtonElement>("enter-ar"),
    arStatus: byId<HTMLElement>("ar-status"),
    arInstructions: byId<HTMLElement>("ar-instructions"),
    arScanReticle: byId<HTMLElement>("ar-scan-reticle"),
    arMenu: byId<HTMLElement>("ar-menu"),
    replaceModelButton: byId<HTMLButtonElement>("replace-model"),
    gestureHint: byId<HTMLElement>("gesture-hint"),
    focusDirection: byId<HTMLElement>("focus-direction"),
    hotspotLayer: byId<HTMLElement>("hotspot-layer"),
    interactionToolbar: byId<HTMLElement>("interaction-toolbar"),
    prevButton: byId<HTMLButtonElement>("prev-button"),
    nextButton: byId<HTMLButtonElement>("next-button"),
    buttonText: byId<HTMLElement>("button-text"),
    navDots: byId<HTMLElement>("nav-dots"),
    topbar: byId<HTMLElement>("topbar"),
    menuButton: byId<HTMLButtonElement>("menu-button"),
    menuBackdrop: byId<HTMLButtonElement>("menu-backdrop"),
    menuHomeButton: byId<HTMLButtonElement>("menu-home"),
    menuGuideButton: byId<HTMLButtonElement>("menu-guide"),
    menuAboutButton: byId<HTMLButtonElement>("menu-about"),
    menuSettingsButton: byId<HTMLButtonElement>("menu-settings"),
    menuExitButton: byId<HTMLButtonElement>("menu-exit"),
    closeInfoButton: byId<HTMLButtonElement>("close-info"),
    sheetTitle: byId<HTMLElement>("sheet-title"),
    sheetContents: Array.from(document.querySelectorAll<HTMLElement>("[data-sheet]")),
    sheetStartArButton: byId<HTMLButtonElement>("sheet-start-ar"),
    sheetPreviewButton: byId<HTMLButtonElement>("sheet-preview"),
    settingLabels: byId<HTMLInputElement>("setting-labels"),
    settingGuide: byId<HTMLInputElement>("setting-guide"),
    settingModelSize: byId<HTMLSelectElement>("setting-model-size"),
    settingResetModel: byId<HTMLButtonElement>("setting-reset-model"),
    detailNumber: byId<HTMLElement>("detail-number"),
    detailTitle: byId<HTMLElement>("detail-title"),
    detailDescription: byId<HTMLElement>("detail-description"),
    detailImage: document.querySelector<HTMLElement>(".detail-image")!,
    detailCloseButton: byId<HTMLButtonElement>("detail-close"),
    sideMenu: byId<HTMLElement>("side-menu"),
    infoSheet: byId<HTMLElement>("info-sheet"),
    navContainer: document.querySelector<HTMLElement>(".button-container")!,
  };
}
