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
    if (
      event.data.type === "SW_VERSION" &&
      event.data.version !== "spirit-tracker-v1.0.0"
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => { regs.forEach((r) => r.unregister()); window.location.reload() })
    }
    if (event.data.type === "SW_UPDATED") window.location.reload()
  })
}
