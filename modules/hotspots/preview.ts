import type { HotspotConfig, ModelViewerElement } from "../types.js";
import { createModelViewerHotspotElements, setHotspotState, updateModelViewerHotspotAnchors } from "../ui.js";

interface PreviewHotspotsOptions {
  hotspots: HotspotConfig[];
  modelViewer: ModelViewerElement;
  buttonText: HTMLElement;
  isDesktop: () => boolean;
  getIsInAr: () => boolean;
  getCurrentIndex: () => number;
  onSelect: (index: number) => void;
  onDetail: (index: number) => void;
}

export function createPreviewHotspots(options: PreviewHotspotsOptions) {
  const elements = createModelViewerHotspotElements(
    options.hotspots,
    options.modelViewer,
    options.onSelect,
    options.onDetail,
    options.isDesktop()
  );

  function updateState(index: number): void {
    setHotspotState(elements, index, options.buttonText, options.hotspots);
  }

  function hide(): void {
    elements.forEach((element) => element.classList.add("hidden"));
  }

  function revealSelected(): void {
    if (options.getIsInAr()) return;
    updateState(options.getCurrentIndex());
    requestAnimationFrame(updateCardWidth);
  }

  function updateCardWidth(): void {
    const index = options.getCurrentIndex();
    if (options.getIsInAr() || index === -1) return;
    const hotspot = elements[index];
    if (!hotspot || hotspot.classList.contains("hidden")) return;
    const point = hotspot.querySelector<HTMLElement>(".preview-hotspot-point");
    const card = hotspot.querySelector<HTMLElement>(".preview-native-card");
    if (!point || !card) return;
    const availableWidth = Math.floor(point.getBoundingClientRect().left - 20);
    const maxWidth = window.innerWidth <= 380 ? 168 : window.innerWidth <= 640 ? 196 : 260;
    const width = Math.max(96, Math.min(maxWidth, availableWidth));
    card.style.width = width + "px";
    card.classList.toggle("compact", width < 190);
    card.classList.toggle("narrow", width < 132);
  }

  function showAll(): void {
    elements.forEach((element) => {
      element.classList.remove("hidden", "active", "card-forced-open");
      element.classList.add("card-collapsed");
    });
  }

  function onResize(): void {
    updateModelViewerHotspotAnchors(elements, options.hotspots, options.isDesktop());
    requestAnimationFrame(updateCardWidth);
  }

  return { elements, hide, onResize, revealSelected, showAll, updateCardWidth, updateState };
}
