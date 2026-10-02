import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          transformers: ["@huggingface/transformers"]
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globIgnores: [
          "**/ort-*.wasm",
          "**/transformers-*.js"
        ]
      },
      manifest: {
        name: "3Dstreaming",
        short_name: "3Dstreaming",
        description: "Web-first stereoscopic playback using synchronized 3D sidecar metadata.",
        start_url: "/",
        display: "standalone",
        background_color: "#090b10",
        theme_color: "#090b10"
      }
    })
  ]
});
