import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mods.daydrift.example",
  output: "static",
  build: {
    format: "directory"
  }
});
