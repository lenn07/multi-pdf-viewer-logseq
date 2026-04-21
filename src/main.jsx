import React from 'react'
import { createRoot } from 'react-dom/client'
import PdfViewer from './components/PdfViewer'

function App() {
  return (
    <div style={{ padding: '16px' }}>
      <h1>Multi PDF Viewer</h1>
      {/* Test-PDF aus dem public/ Ordner — Phase 7 ersetzt das durch echte Logseq-Pfade */}
      <PdfViewer url="/test.pdf" titel="Test Dokument" />
    </div>
  )
}

// Das ist der Logseq-spezifische Teil:
// logseq.ready() wartet, bis Logseq vollständig geladen ist
// Erst dann starten wir React und registrieren Befehle
async function main() {
  // Logseq-Befehle nur registrieren wenn wir wirklich in Logseq laufen
  if (window.__logseq_plugin_id__) {
    logseq.App.registerCommand(
      'multi-pdf-viewer:open',
      { key: 'open-pdf-viewer', label: 'PDF Viewer öffnen', palette: true },
      async () => logseq.App.showMsg('PDF Viewer wird geöffnet!')
    )
  }

  // React in den #app Container rendern
  const root = createRoot(document.getElementById('app'))
  root.render(<App />)
}

// window.__logseq_plugin_id__ existiert nur wenn das Plugin wirklich in Logseq läuft.
// Im normalen Browser (Dev-Modus) starten wir direkt.
if (window.__logseq_plugin_id__) {
  logseq.ready(main).catch(console.error)
} else {
  main()
}