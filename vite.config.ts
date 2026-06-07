import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    cssCodeSplit: true,
    assetsInlineLimit: 4_096,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react"
          if (id.includes("@base-ui")) return "vendor-base-ui"
          if (id.includes("lucide-react")) return "vendor-icons"
          if (id.includes("opentype.js")) return "vendor-opentype"
          if (id.includes("tailwind-merge") || id.includes("clsx") || id.includes("class-variance-authority")) return "vendor-utils"
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
