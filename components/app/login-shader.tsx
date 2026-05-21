"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

// Studio-exported config pasted verbatim from shadergradient.co. Library's
// public TS types are narrower than what the runtime component accepts —
// we cast once here so we can keep the exact studio props (any preview-only
// keys like axesHelper / format / embedMode are simply ignored at runtime).
const SHADER_CONFIG = {
  control: "props",
  animate: "on",
  brightness: 1.2,
  cAzimuthAngle: 180,
  cDistance: 2.41,
  cPolarAngle: 90,
  cameraZoom: 1,
  color1: "#ff5005",
  color2: "#dbba95",
  color3: "#af92e1",
  envPreset: "city",
  fov: 80,
  frameRate: 10,
  grain: "on",
  lightType: "3d",
  pixelDensity: 1.2,
  positionX: -1.4,
  positionY: 0,
  positionZ: 0,
  range: "disabled",
  rangeEnd: 18.4,
  rangeStart: 0,
  reflection: 0.1,
  rotationX: 0,
  rotationY: 10,
  rotationZ: 50,
  shader: "defaults",
  type: "waterPlane",
  uAmplitude: 1,
  uDensity: 7,
  uFrequency: 5.5,
  uSpeed: 0.1,
  uStrength: 1,
  uTime: 0,
  wireframe: false,
} as const;

// Generative WebGL background for the login brand panel. Lives in its own
// client-only chunk (loaded via dynamic import + ssr:false from the page)
// so the three.js + react-three-fiber bundle doesn't bloat the auth route.
export default function LoginShader() {
  return (
    <ShaderGradientCanvas
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <ShaderGradient {...(SHADER_CONFIG as unknown as Record<string, never>)} />
    </ShaderGradientCanvas>
  );
}
