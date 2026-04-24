import React, { useState, useEffect } from 'react'
import PdfViewer from './PdfViewer'
import {
  viewerSchliessen,
  pdfAusBlockOeffnen,
  viewerBreiteSetzen,
  viewerBreiteLesen,
  BREITE_MIN,
  BREITE_MAX,
} from '../main'

const stile = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '3px 3px 3px 10px', // links extra Platz für Drag-Handle
    gap: '4px',
    backgroundColor: 'var(--ls-primary-background-color, #fff)',
    boxSizing: 'border-box',
    position: 'relative',
    // Immer sichtbare Trennlinie zu Logseq. rgba-Schwarz, damit sie
    // sowohl auf hellen als auch auf dunklen Themes als dunkler Strich
    // lesbar ist (wird dunkler als jeder Theme-Hintergrund).
    borderLeft: '2px solid rgba(0, 0, 0, 0.45)',
  },
  resizeHandle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '6px',
    height: '100%',
    cursor: 'ew-resize',
    background: 'transparent',
    zIndex: 10,
  },
  resizeHandleAktiv: {
    background: 'var(--ls-border-color, #888)',
  },
  breiteAnzeige: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--ls-secondary-background-color, #222)',
    color: 'var(--ls-primary-text-color, #fff)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    pointerEvents: 'none',
    zIndex: 11,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 0',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    flexShrink: 0,
    flexWrap: 'wrap',
    fontSize: '12px',
  },
  anzahl: {
    fontSize: '11px',
    color: 'var(--ls-secondary-text-color, #888)',
    marginLeft: '4px',
  },
  layoutBtn: {
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '12px',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '3px',
    background: 'transparent',
    color: 'var(--ls-primary-text-color, #333)',
  },
  layoutBtnAktiv: {
    background: 'var(--ls-secondary-background-color, #eee)',
    fontWeight: 'bold',
  },
  viewerSchliessenBtn: {
    marginLeft: 'auto',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  leererZustand: {
    padding: '32px',
    textAlign: 'center',
    color: 'var(--ls-secondary-text-color, #888)',
  },
}

// Mindestbreite einer Kachel im Nebeneinander-Modus.
// Wenn der Viewer zu schmal ist, gibt es stattdessen horizontalen Scroll.
const KACHEL_MIN_BREITE = 240

function ViewerGrid() {
  const [pdfListe, setPdfListe] = useState([])

  // Layout-Modus: 'nebeneinander' = horizontaler Scroll, 'uebersicht' = dynamisches Raster
  const [layoutModus, setLayoutModus] = useState('nebeneinander')

  const [breite, setBreite] = useState(() => viewerBreiteLesen())
  const [zieheGerade, setZieheGerade] = useState(false)

  function handleMouseDown(e) {
    e.preventDefault()
    setZieheGerade(true)

    const parentWin = window.parent
    const parentDoc = parentWin.document
    const iframeEl = window.frameElement

    function breiteAusParentX(parentX) {
      const neueBreitePx = parentWin.innerWidth - parentX
      const prozent = (neueBreitePx / parentWin.innerWidth) * 100
      const geklemmt = Math.max(BREITE_MIN, Math.min(BREITE_MAX, prozent))
      viewerBreiteSetzen(geklemmt)
      setBreite(geklemmt)
    }

    function onMoveIframe(ev) {
      const rect = iframeEl ? iframeEl.getBoundingClientRect() : { left: 0 }
      breiteAusParentX(rect.left + ev.clientX)
    }

    function onMoveParent(ev) {
      breiteAusParentX(ev.clientX)
    }

    function aufraeumen() {
      setZieheGerade(false)
      document.removeEventListener('mousemove', onMoveIframe)
      document.removeEventListener('mouseup', aufraeumen)
      parentDoc.removeEventListener('mousemove', onMoveParent)
      parentDoc.removeEventListener('mouseup', aufraeumen)
      parentDoc.body.style.userSelect = ''
      document.body.style.userSelect = ''
    }

    parentDoc.body.style.userSelect = 'none'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', onMoveIframe)
    document.addEventListener('mouseup', aufraeumen)
    parentDoc.addEventListener('mousemove', onMoveParent)
    parentDoc.addEventListener('mouseup', aufraeumen)
  }

  useEffect(() => {
    function pdfEmpfangen(event) {
      const { url, titel } = event.detail
      const max = logseq?.settings?.maxViewer ?? 4

      setPdfListe((aktuelleliste) => {
        if (aktuelleliste.length >= max) {
          const [, ...rest] = aktuelleliste
          return [...rest, { id: Date.now(), url, titel }]
        }
        return [...aktuelleliste, { id: Date.now(), url, titel }]
      })
    }

    window.addEventListener('pdf-oeffnen', pdfEmpfangen)
    return () => window.removeEventListener('pdf-oeffnen', pdfEmpfangen)
  }, [])

  function pdfEntfernen(id) {
    setPdfListe((alt) => alt.filter((pdf) => pdf.id !== id))
  }

  const istUebersicht = layoutModus === 'uebersicht'
  const anzahl = pdfListe.length

  // Dynamisches Raster für Übersichtsmodus:
  //   cols = ceil(sqrt(N)) → minimale Spalten für annähernd quadratische Kacheln
  //   rows = ceil(N/cols)  → so viele Zeilen wie nötig
  // Beispiele: N=1 → 1×1, N=2 → 2×1, N=3-4 → 2×2, N=5-6 → 3×2, N=7-9 → 3×3
  const uebersichtSpalten = Math.max(1, Math.ceil(Math.sqrt(anzahl)))
  const uebersichtZeilen = Math.max(1, Math.ceil(anzahl / uebersichtSpalten))

  // Layout-Stile je nach Modus:
  // - Nebeneinander: 1 Zeile, N Spalten, jede Kachel min. KACHEL_MIN_BREITE.
  //   Horizontal scroll wenn Viewer zu schmal für N Kacheln.
  // - Übersicht: sqrt-Raster, beide Richtungen füllen den Viewer aus.
  const gridStyle = istUebersicht
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(${uebersichtSpalten}, 1fr)`,
        gridTemplateRows: `repeat(${uebersichtZeilen}, 1fr)`,
        gap: '4px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }
    : {
        display: 'grid',
        gridTemplateColumns: `repeat(${anzahl}, minmax(${KACHEL_MIN_BREITE}px, 1fr))`,
        gridTemplateRows: '1fr',
        gap: '4px',
        flex: 1,
        minHeight: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
      }

  return (
    <div style={stile.wrapper}>
      <div
        style={{
          ...stile.resizeHandle,
          ...(zieheGerade ? stile.resizeHandleAktiv : {}),
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!zieheGerade) e.currentTarget.style.background = 'var(--ls-border-color, #888)'
        }}
        onMouseLeave={(e) => {
          if (!zieheGerade) e.currentTarget.style.background = 'transparent'
        }}
        title="Breite ändern (ziehen)"
      />

      {zieheGerade && (
        <div style={stile.breiteAnzeige}>{Math.round(breite)}%</div>
      )}

      <div style={stile.toolbar}>
        <button onClick={pdfAusBlockOeffnen}>+ PDF</button>

        <button
          onClick={() => setLayoutModus('nebeneinander')}
          style={{
            ...stile.layoutBtn,
            ...(!istUebersicht ? stile.layoutBtnAktiv : {}),
          }}
          title="PDFs nebeneinander anzeigen (scrollbar)"
        >
          ▦ Nebeneinander
        </button>
        <button
          onClick={() => setLayoutModus('uebersicht')}
          style={{
            ...stile.layoutBtn,
            ...(istUebersicht ? stile.layoutBtnAktiv : {}),
          }}
          title="Alle PDFs gleichzeitig in einem Raster"
        >
          ▤ Übersicht
        </button>

        <span style={stile.anzahl}>{anzahl} PDF(s)</span>
        <button
          onClick={viewerSchliessen}
          style={stile.viewerSchliessenBtn}
          title="Viewer schließen"
        >
          ✕
        </button>
      </div>

      {anzahl === 0 && (
        <div style={stile.leererZustand}>
          Keine PDFs offen. Wähle in Logseq einen Block mit PDF-Link aus<br />
          und klicke dann auf „+ PDF".
        </div>
      )}

      {anzahl > 0 && (
        <div style={gridStyle}>
          {pdfListe.map((pdf) => (
            <div
              key={pdf.id}
              style={{ minHeight: 0, minWidth: 0, display: 'flex' }}
            >
              <PdfViewer
                url={pdf.url}
                titel={pdf.titel}
                onClose={() => pdfEntfernen(pdf.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ViewerGrid
