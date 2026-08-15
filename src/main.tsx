import React from "react"
import ReactDOM from "react-dom/client"
import App from "./components/App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Service worker registration with version-checking auto-reload
if ("serviceWorker" in navigator) {
  let refreshing = false

  function handleInstall(worker: ServiceWorker) {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" })
      }
    })
  }

  navigator.serviceWorker
    .register("/service-worker.js")
    .then((reg) => {
      if (reg.installing) handleInstall(reg.installing)
      reg.addEventListener("updatefound", () => {
        if (reg.installing) handleInstall(reg.installing)
      })
    })
    .catch(() => {})

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  navigator.serviceWorker.ready.then((reg) => {
    if (reg.active) reg.active.postMessage({ type: "GET_VERSION" })
  })

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (!event.data) return
    // ⚠️ This string must match CACHE in public/service-worker.js exactly.
    // They live in separate files with no shared import (service-worker.js
    // is a static public file, not part of the Vite bundle), so nothing
    // enforces this at build time. A mismatch here doesn't break updates —
    // it makes every single load look "outdated," forcing an unnecessary
    // full unregister + reload on every visit instead of a real check.
    // (This is exactly what happened before: this compared against
    // "spirit-tracker-v1.0.0", a stale value from an old app name, which
    // never matched the real "healthtracker-v1.0.0" cache version.)
    if (
      event.data.type === "SW_VERSION" &&
      event.data.version !== "healthtracker-v1.0.0"
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => { regs.forEach((r) => r.unregister()); window.location.reload() })
    }
    if (event.data.type === "SW_UPDATED") window.location.reload()
  })
}
