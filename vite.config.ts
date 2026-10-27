import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 8080,
    watch: {
      ignored: ['**/.local-tools/**', '**/.runtime/**', '**/demo_vids/**', '**/output/**'],
    },
  },
  plugins: [tsConfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
});
