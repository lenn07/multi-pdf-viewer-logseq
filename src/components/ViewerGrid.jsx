import React, { useState } from 'react'
import PdfViewer from './PdfViewer'

// Eine echte Test-PDF von Mozilla — funktioniert ohne lokale Datei
const DEMO_PDF = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'

const stile = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '8px',
    gap: '8px',
    backgroundColor: 'var(--ls-primary-background-color, #fff)',
    boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    flexShrink: 0,
  },
  anzahl: {
    fontSize: '12px',
    color: 'var(--ls-secondary-text-color, #888)',
  },
  grid: {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    overflowX: 'auto',
    flex: 1,
    alignItems: 'flex-start',
  },
  viewerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexShrink: 0,
  },
  schliessenBtn: {
    alignSelf: 'flex-end',
    fontSize: '11px',
    padding: '2px 6px',
    cursor: 'pointer',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--ls-primary-text-color, #333)',
  },
}

function ViewerGrid() {
  // pdfListe ist ein Array von Objekten: [{ id, url, titel }, { id, url, titel }, ...]
  // useState mit einem Demo-Eintrag, damit sofort etwas zu sehen ist
  const [pdfListe, setPdfListe] = useState([
    { id: 1, url: DEMO_PDF, titel: 'Demo PDF' },
  ])

  // PDF hinzufügen: Nutzer gibt eine URL ein, wir hängen ein neues Objekt ans Array
  function pdfHinzufuegen() {
    const url = window.prompt('PDF-URL eingeben:')
    if (!url) return // Nutzer hat abgebrochen

    const neueId = Date.now() // aktuelle Uhrzeit als eindeutige Zahl, z.B. 1713789123456
    const neuerEintrag = { id: neueId, url, titel: 'PDF ' + (pdfListe.length + 1) }

    // ...pdfListe kopiert alle bestehenden Einträge, dann hängen wir den neuen dran
    setPdfListe([...pdfListe, neuerEintrag])
  }

  // PDF entfernen: alle außer der mit der gesuchten id behalten
  function pdfEntfernen(id) {
    setPdfListe(pdfListe.filter((pdf) => pdf.id !== id))
  }

  return (
    <div style={stile.wrapper}>
      {/* Toolbar oben: Button + Anzahl */}
      <div style={stile.toolbar}>
        <button onClick={pdfHinzufuegen}>+ PDF hinzufügen</button>
        <span style={stile.anzahl}>
          {pdfListe.length} PDF(s) offen
        </span>
      </div>

      {/* Das Raster: für jede PDF in der Liste einen PdfViewer rendern */}
      <div style={stile.grid}>
        {pdfListe.map((pdf) => (
          // key={pdf.id} ist Pflicht bei Listen in React — erklärt unten
          <div key={pdf.id} style={stile.viewerWrapper}>
            <button
              style={stile.schliessenBtn}
              onClick={() => pdfEntfernen(pdf.id)}
            >
              ✕ Schließen
            </button>
            <PdfViewer url={pdf.url} titel={pdf.titel} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default ViewerGrid
