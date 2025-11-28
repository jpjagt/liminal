import "./App.css"
import { AsciiNoiseEffect } from "./ascii.tsx"

function App() {
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <AsciiNoiseEffect className='h-full w-full' />
    </div>
  )
}

export default App
