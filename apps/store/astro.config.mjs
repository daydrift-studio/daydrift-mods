import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://daydrift-mods.blym.top",
  output: "static",
  build: {
    format: "directory"
  }
});
