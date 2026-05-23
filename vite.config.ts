import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/healthtracker-react/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/services/adaptiveTDEE.ts", "src/services/mealPlanPresets.ts"],
    },
  },
})
