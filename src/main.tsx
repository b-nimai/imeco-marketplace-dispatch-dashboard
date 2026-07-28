import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"

// No ThemeProvider: the wall display is dark-only and its `d` keyboard toggle would be a
// hazard on an unattended screen. `class="dark"` is pinned on <html> in index.html.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
