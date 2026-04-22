import React from 'react'
import { createRoot } from 'react-dom/client'
import ViewerGrid from './components/ViewerGrid'

function App() {
  return <ViewerGrid />
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