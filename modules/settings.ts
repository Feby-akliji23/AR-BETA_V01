import type { ArModel } from "./types.js";

const STORAGE_KEY = "dungkluruk-ar-settings";
const MODEL_SIZES = ["0.8", "1", "1.25"];

interface SettingsOptions {
  labels: HTMLInputElement;
  guide: HTMLInputElement;
  modelSize: HTMLSelectElement;
  getPlacedModel: () => ArModel | null;
}

export function createSettingsController(options: SettingsOptions) {
  function save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          showLabels: options.labels.checked,
          showGuide: options.guide.checked,
          modelSize: options.modelSize.value,
        })
      );
    } catch (error) {
      console.warn("Pengaturan tidak dapat disimpan", error);
    }
  }

  function apply(shouldPersist = true): void {
    document.body.classList.toggle("hide-hotspot-labels", !options.labels.checked);
    document.body.classList.toggle("hide-ar-guide", !options.guide.checked);
    const model = options.getPlacedModel();
    if (model?.visible) {
      model.userData.interactionRoot.scale.setScalar(getModelSize());
      model.updateMatrixWorld(true);
    }
    if (shouldPersist) save();
  }

  function load(): void {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY);
      if (!storedSettings) return;
      const settings: unknown = JSON.parse(storedSettings);
      if (!settings || typeof settings !== "object") return;
      const saved = settings as Record<string, unknown>;
      if (typeof saved.showLabels === "boolean") options.labels.checked = saved.showLabels;
      if (typeof saved.showGuide === "boolean") options.guide.checked = saved.showGuide;
      if (MODEL_SIZES.includes(String(saved.modelSize))) options.modelSize.value = String(saved.modelSize);
    } catch (error) {
      console.warn("Pengaturan tersimpan tidak dapat dibaca", error);
    }
  }

  function getModelSize(): number {
    return Number(options.modelSize.value);
  }

  return { apply, getModelSize, load };
}
