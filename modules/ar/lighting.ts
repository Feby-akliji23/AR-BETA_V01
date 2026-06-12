import type { DirectionalLight, HemisphereLight, Scene, Vector3, WebGLRenderer } from "three";
import { THREE } from "../three.js";

interface XrLightProbe {
  readonly probeSpace?: XRSpace;
}

interface XrLightEstimate {
  sphericalHarmonicsCoefficients: Float32Array;
  primaryLightDirection: DOMPointReadOnly;
  primaryLightIntensity: DOMPointReadOnly;
}

type LightingSession = XRSession & {
  requestLightProbe?: () => Promise<XrLightProbe>;
};

type LightingFrame = XRFrame & {
  getLightEstimate?: (probe: XrLightProbe) => XrLightEstimate | null;
};

const PREVIEW_HEMISPHERE_INTENSITY = 1.1;
const PREVIEW_DIRECTIONAL_INTENSITY = 3.2;
const AR_FALLBACK_HEMISPHERE_INTENSITY = 0.55;
const AR_FALLBACK_DIRECTIONAL_INTENSITY = 1.4;
const AR_FALLBACK_ENVIRONMENT_INTENSITY = 0.35;
const AR_ESTIMATED_ENVIRONMENT_INTENSITY = 0.55;
const ESTIMATED_LIGHT_PROBE_INTENSITY = 1.15;
const ESTIMATED_HEMISPHERE_INTENSITY = 0.2;
const MAX_ESTIMATED_DIRECTIONAL_INTENSITY = 3;
const LIGHT_ESTIMATION_SMOOTHING = 0.08;

export function createArLightingController(
  scene: Scene,
  renderer: WebGLRenderer,
  hemisphereLight: HemisphereLight,
  directionalLight: DirectionalLight
) {
  let lightProbe: XrLightProbe | null = null;
  let requestVersion = 0;
  let hasEstimate = false;
  let lightTarget: Vector3 | null = null;
  const previewEnvironmentIntensity = scene.environmentIntensity;
  const estimatedLightProbe = new THREE.LightProbe();
  const estimatedSphericalHarmonics = new THREE.SphericalHarmonics3();
  const estimatedColor = new THREE.Color();
  const estimatedDirection = new THREE.Vector3();
  const directionalPosition = new THREE.Vector3();
  estimatedLightProbe.intensity = 0;
  scene.add(estimatedLightProbe);

  function restorePreviewLighting(): void {
    lightTarget = null;
    hemisphereLight.color.setHex(0xffffff);
    hemisphereLight.groundColor.setHex(0x8c97a3);
    hemisphereLight.intensity = PREVIEW_HEMISPHERE_INTENSITY;
    directionalLight.color.setHex(0xffffff);
    directionalLight.intensity = PREVIEW_DIRECTIONAL_INTENSITY;
    directionalPosition.set(3, 5, 2);
    applyDirectionalPosition(directionalPosition);
    estimatedLightProbe.intensity = 0;
    estimatedLightProbe.sh.zero();
    scene.environmentIntensity = previewEnvironmentIntensity;
    hasEstimate = false;
  }

  function useArFallbackLighting(): void {
    hemisphereLight.color.setHex(0xffffff);
    hemisphereLight.groundColor.setHex(0x8c97a3);
    hemisphereLight.intensity = AR_FALLBACK_HEMISPHERE_INTENSITY;
    directionalLight.color.setHex(0xffffff);
    directionalLight.intensity = AR_FALLBACK_DIRECTIONAL_INTENSITY;
    directionalPosition.set(3, 5, 2);
    applyDirectionalPosition(directionalPosition);
    estimatedLightProbe.intensity = 0;
    estimatedLightProbe.sh.zero();
    scene.environmentIntensity = AR_FALLBACK_ENVIRONMENT_INTENSITY;
    hasEstimate = false;
  }

  function reset(resetLighting = true): void {
    requestVersion += 1;
    lightProbe = null;
    if (resetLighting) restorePreviewLighting();
  }

  function request(session: XRSession): void {
    reset(false);
    useArFallbackLighting();
    const currentRequestVersion = requestVersion;
    const lightingSession = session as LightingSession;
    if (!lightingSession.requestLightProbe) return;

    lightingSession
      .requestLightProbe()
      .then((probe) => {
        if (currentRequestVersion !== requestVersion || renderer.xr.getSession() !== session) return;
        lightProbe = probe;
      })
      .catch((error) => {
        if (currentRequestVersion !== requestVersion) return;
        console.warn("Estimasi cahaya AR tidak tersedia; menggunakan lighting default", error);
        useArFallbackLighting();
      });
  }

  function update(frame: XRFrame): void {
    if (!lightProbe) return;
    const lightingFrame = frame as LightingFrame;
    if (!lightingFrame.getLightEstimate) return;

    let estimate: XrLightEstimate | null = null;
    try {
      estimate = lightingFrame.getLightEstimate(lightProbe);
    } catch (error) {
      console.warn("Estimasi cahaya AR gagal dibaca; menggunakan lighting default", error);
      requestVersion += 1;
      lightProbe = null;
      useArFallbackLighting();
      return;
    }
    if (!estimate) return;

    if (!hasEstimate) {
      hasEstimate = true;
      scene.environmentIntensity = AR_ESTIMATED_ENVIRONMENT_INTENSITY;
    }

    const coefficients = estimate.sphericalHarmonicsCoefficients;
    if (coefficients.length >= 27) {
      estimatedSphericalHarmonics.fromArray(coefficients);
      estimatedLightProbe.sh.lerp(estimatedSphericalHarmonics, LIGHT_ESTIMATION_SMOOTHING);
      estimatedLightProbe.intensity = THREE.MathUtils.lerp(
        estimatedLightProbe.intensity,
        ESTIMATED_LIGHT_PROBE_INTENSITY,
        LIGHT_ESTIMATION_SMOOTHING
      );
      hemisphereLight.intensity = THREE.MathUtils.lerp(
        hemisphereLight.intensity,
        ESTIMATED_HEMISPHERE_INTENSITY,
        LIGHT_ESTIMATION_SMOOTHING
      );
    }

    const intensity = estimate.primaryLightIntensity;
    const intensityScalar = Math.max(1, intensity.x, intensity.y, intensity.z);
    if (intensityScalar > 0.001) {
      estimatedColor.setRGB(
        intensity.x / intensityScalar,
        intensity.y / intensityScalar,
        intensity.z / intensityScalar
      );
      directionalLight.color.lerp(estimatedColor, LIGHT_ESTIMATION_SMOOTHING);
      directionalLight.intensity = THREE.MathUtils.lerp(
        directionalLight.intensity,
        THREE.MathUtils.clamp(intensityScalar, 0.35, MAX_ESTIMATED_DIRECTIONAL_INTENSITY),
        LIGHT_ESTIMATION_SMOOTHING
      );
    }

    const direction = estimate.primaryLightDirection;
    estimatedDirection.set(direction.x, direction.y, direction.z);
    if (estimatedDirection.lengthSq() > 0.0001) {
      estimatedDirection.normalize().multiplyScalar(5);
      directionalPosition.lerp(estimatedDirection, LIGHT_ESTIMATION_SMOOTHING);
      applyDirectionalPosition(directionalPosition);
    }
  }

  function applyDirectionalPosition(direction: Vector3): void {
    if (lightTarget) {
      directionalLight.target.position.copy(lightTarget);
      directionalLight.position.copy(lightTarget).add(direction);
    } else {
      directionalLight.target.position.set(0, 0, 0);
      directionalLight.position.copy(direction);
    }
    directionalLight.target.updateMatrixWorld();
  }

  function setTarget(target: Vector3 | null): void {
    lightTarget = target;
    applyDirectionalPosition(directionalPosition);
  }

  return { hasEstimate: () => hasEstimate, request, reset, setTarget, update };
}
