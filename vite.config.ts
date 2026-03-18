import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/healthtracker-react/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
})
