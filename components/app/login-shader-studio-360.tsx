"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

// Studio 360 flavour of the sign-in shader: same waterPlane geometry
// Sam liked on review.ciris.studio, re-palletted to pure black + two
// yellow tones (soft highlight + brand accent). Everything else stays
// put — the subtle speed, the grain, the lighting — so the motion
// still feels organic instead of UI-ish.
const SHADER_CONFIG = {
  control: "props",
  animate: "on",
  brightness: 1.1,
  cAzimuthAngle: 180,
  cDistance: 2.6,
  cPolarAngle: 90,
  cameraZoom: 1,
  // Tri-stop palette: deep ink → brand yellow → warm highlight.
  // Keeping the darkest colour pure-ish so the composition doesn't
  // bleed into brown.
  color1: "#0a0a0a",
  color2: "#FFB500",
  color3: "#FFD36B",
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
  uDensity: 6,
  uFrequency: 5.5,
  uSpeed: 0.08,
  uStrength: 1.1,
  uTime: 0,
  wireframe: false,
} as const;

export default function LoginShaderStudio360() {
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
