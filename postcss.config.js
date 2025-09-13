// PostCSS config (ESM) that merges ReShaped defaults with Tailwind & Autoprefixer
import { config as reshapedConfig } from "reshaped/config/postcss";

// ReShaped exports plugin map object. Ensure Tailwind/Autoprefixer run before cssnano.
const base = reshapedConfig ?? {};
const basePlugins = base.plugins ?? {};

// Separate cssnano to keep it last
const { cssnano: cssnanoConfig, ...restBasePlugins } = basePlugins;

const mergedPlugins = {
  // ReShaped essentials first (without cssnano)
  ...restBasePlugins,
  // Then project plugins to generate and prefix CSS
  tailwindcss: {},
  autoprefixer: {},
  // Finally minify
  ...(cssnanoConfig ? { cssnano: cssnanoConfig } : {}),
};

export default {
  ...base,
  plugins: mergedPlugins,
};