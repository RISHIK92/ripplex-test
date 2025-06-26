import { createDefaultPreset } from "ts-jest";

const preset = createDefaultPreset();

/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm", // ✅ enable ESM support in ts-jest
  testEnvironment: "jsdom",
  transform: {
    ...preset.transform,
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],

  // ✅ Tell Jest to transform ESM node_modules (especially preact/signals)
  transformIgnorePatterns: [
    "/node_modules/(?!(@preact)/)", // only allow @preact to be transformed
  ],

  moduleNameMapper: {
    // Optional: resolve CSS/images etc
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },

  globals: {
    "ts-jest": {
      useESM: true, // ✅ Tell ts-jest to output ESM
    },
  },
};
