import React from 'react'
import { usePdf } from '../hooks/usePdf'

const stile = {
  container: {
    display: 'inline-flex',
    flexDirection: 'column',
    width: 'fit-content',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '6px',
    backgroundColor: 'var(--ls-primary-background-color, #fff)',
  },
  kopfzeile: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    fontSize: '14px',
  },
  seitenInfo: {
    color: 'var(--ls-secondary-text-color, #888)',
    fontSize: '12px',
  },
  canvasWrapper: {
    overflow: 'auto',
    padding: '8px',
  },
  navigation: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    padding: '8px',
    borderTop: '1px solid var(--ls-border-color, #ccc)',
  },
}

function PdfViewer({ url, titel }) {
  const { canvasRef, seitenanzahl, aktuelleSeite, vorherige, naechste, laden, fehler } =
    usePdf(url)

  if (laden) {
    return <div style={stile.container}>PDF wird geladen…</div>
  }

  if (fehler) {
    return <div style={{ ...stile.container, color: 'red' }}>{fehler}</div>
  }

  return (
    <div style={stile.container}>
      <div style={stile.kopfzeile}>
        <strong>{titel}</strong>
        <span style={stile.seitenInfo}>
          Seite {aktuelleSeite} / {seitenanzahl}
        </span>
      </div>

      {/* Der Canvas — hier zeichnet PDF.js die Seite rein */}
      <div style={stile.canvasWrapper}>
        <canvas ref={canvasRef} />
      </div>

      <div style={stile.navigation}>
        <button onClick={vorherige} disabled={aktuelleSeite <= 1}>
          ← Zurück
        </button>
        <button onClick={naechste} disabled={aktuelleSeite >= seitenanzahl}>
          Weiter →
        </button>
      </div>
    </div>
  )
}

export default PdfViewer
