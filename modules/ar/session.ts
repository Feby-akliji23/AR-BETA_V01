export const WEBXR_OPTIONAL_FEATURES = ["local-floor", "anchors", "light-estimation"];

export function requestArSession(root: HTMLElement): Promise<XRSession> {
  if (!navigator.xr) return Promise.reject(new Error("WebXR tidak tersedia"));
  return navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    optionalFeatures: WEBXR_OPTIONAL_FEATURES,
    domOverlay: { root },
  });
}

export function endArSession(session: XRSession | null): void {
  if (!session) return;
  session.end().catch((error) => {
    console.warn("Sesi AR tidak dapat ditutup", error);
  });
}

export function isQuickLookSupported(usdzUrl: string, canActivateAr: boolean): boolean {
  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent);
  return isIosDevice && isSafari && Boolean(usdzUrl) && canActivateAr;
}
