import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { Leva } from "leva"
import App from "./App.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Leva hidden={true || import.meta.env.PROD} />
    <App />
  </StrictMode>,
)
