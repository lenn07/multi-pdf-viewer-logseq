import React, { useState, useEffect } from 'react'
import PdfViewer from './PdfViewer'
import { viewerSchliessen, pdfAusBlockOeffnen } from '../main'

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
  viewerSchliessenBtn: {
    marginLeft: 'auto',
    padding: '2px 10px',
    cursor: 'pointer',
  },
  leererZustand: {
    padding: '32px',
    textAlign: 'center',
    color: 'var(--ls-secondary-text-color, #888)',
  },
}

function ViewerGrid() {
  const [pdfListe, setPdfListe] = useState([])

  // useEffect mit leerem Array [] läuft einmal beim ersten Rendern der Komponente.
  // Wir registrieren einen Listener für das 'pdf-oeffnen' Custom Event aus main.jsx.
  // Das ist wie ein Briefkasten: main.jsx wirft einen Brief ein, wir lesen ihn hier.
  useEffect(() => {
    function pdfEmpfangen(event) {
      const { url, titel } = event.detail

      // Maximale Anzahl aus den Logseq-Einstellungen lesen (Fallback: 4)
      const max = logseq?.settings?.maxViewer ?? 4

      setPdfListe((aktuelleliste) => {
        if (aktuelleliste.length >= max) {
          // Wir ersetzen die älteste PDF (die erste in der Liste)
          const [, ...rest] = aktuelleliste
          return [...rest, { id: Date.now(), url, titel }]
        }
        return [...aktuelleliste, { id: Date.now(), url, titel }]
      })
    }

    window.addEventListener('pdf-oeffnen', pdfEmpfangen)

    // Cleanup: wenn die Komponente verschwindet, Listener wieder entfernen
    return () => window.removeEventListener('pdf-oeffnen', pdfEmpfangen)
  }, [])

  function pdfEntfernen(id) {
    setPdfListe((alt) => alt.filter((pdf) => pdf.id !== id))
  }

  return (
    <div style={stile.wrapper}>
      {/* Toolbar oben: Button + Anzahl + Schließen */}
      <div style={stile.toolbar}>
        <button onClick={pdfAusBlockOeffnen}>+ PDF hinzufügen</button>
        <span style={stile.anzahl}>
          {pdfListe.length} PDF(s) offen
        </span>
        <button
          onClick={viewerSchliessen}
          style={stile.viewerSchliessenBtn}
          title="Viewer schließen"
        >
          ✕
        </button>
      </div>

      {/* Leerer Zustand: Hinweis wenn noch keine PDFs offen sind */}
      {pdfListe.length === 0 && (
        <div style={stile.leererZustand}>
          Keine PDFs offen. Wähle in Logseq einen Block mit PDF-Link aus<br />
          und klicke dann auf „+ PDF hinzufügen".
        </div>
      )}

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
