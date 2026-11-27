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
  brightness: 1.0,
  cAzimuthAngle: 180,
  cDistance: 2.6,
  cPolarAngle: 90,
  cameraZoom: 1,
  // Tri-stop palette: deep ink → pure Pantone-adjacent yellow →
  // lighter pure yellow. No orange undertone — the brand accent
  // #FFB500 reads as orange when softened by warm lighting, so for
  // the shader we shift a notch cooler. UI chrome keeps #FFB500.
  color1: "#0a0a0a",
  color2: "#FFCF00",
  color3: "#FFE866",
  // "studio" is a cooler, more neutral HDRI than "city" (which bakes
  // warm sodium tones into the reflections and tipped the whole scene
  // towards orange).
  envPreset: "studio",
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
