import React, { useState, useRef, useEffect } from 'react'
import { usePdf } from '../hooks/usePdf'

const stile = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '4px',
    backgroundColor: 'var(--ls-primary-background-color, #fff)',
    width: '100%',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  kopfzeile: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    fontSize: '12px',
    gap: '6px',
    flexShrink: 0,
  },
  titel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  },
  seitenInfo: {
    color: 'var(--ls-secondary-text-color, #888)',
    fontSize: '11px',
    flexShrink: 0,
  },
  schliessenKopf: {
    padding: '0 4px',
    cursor: 'pointer',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--ls-secondary-text-color, #888)',
    fontSize: '14px',
    lineHeight: 1,
    flexShrink: 0,
  },
  canvasWrapper: {
    overflow: 'auto',
    padding: '0',
    flex: 1,
    display: 'block',
    minHeight: 0,
  },
  navigation: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2px 4px',
    borderTop: '1px solid var(--ls-border-color, #ccc)',
    flexShrink: 0,
    fontSize: '12px',
  },
  zoomAnzeige: {
    fontSize: '11px',
    color: 'var(--ls-secondary-text-color, #888)',
    minWidth: '32px',
    textAlign: 'center',
  },
}

// Zoomstufen (relativ zur Kachelbreite):
// 1.0 = PDF füllt Kachel genau aus, 2.0 = doppelt so breit (horizontal scroll), etc.
const ZOOM_STUFEN = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
const ZOOM_DEFAULT = 1.0

// PDF.js rendert immer mit dieser Scale (feste Canvas-Auflösung für gute Bildqualität).
// Die tatsächliche Darstellungsgröße wird anschließend per CSS skaliert.
const RENDER_SCALE = 1.5

function PdfViewer({ url, titel, onClose }) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)

  const { canvasRef, seitenanzahl, aktuelleSeite, vorherige, naechste, laden, fehler } =
    usePdf(url, RENDER_SCALE)

  const wrapperRef = useRef(null)

  // CSS-Skalierung: Canvas wird auf (Kachelbreite × zoom) gestreckt.
  // Höhe wächst proportional mit — überschüssige Höhe wird vom Wrapper vertikal gescrollt.
  // ResizeObserver reagiert auf Größenänderung der Kachel (z.B. Viewer resize).
  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    function anpassen() {
      if (!canvas.width) return
      const kachelBreite = wrapper.clientWidth
      if (kachelBreite <= 0) return

      const zielBreite = kachelBreite * zoom
      const faktor = zielBreite / canvas.width
      canvas.style.width = zielBreite + 'px'
      canvas.style.height = canvas.height * faktor + 'px'
    }

    anpassen()
    const beobachter = new ResizeObserver(anpassen)
    beobachter.observe(wrapper)

    // Wenn PDF.js neu rendert (Seitenwechsel): canvas.width/height ändert sich
    const mutationBeobachter = new MutationObserver(anpassen)
    mutationBeobachter.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] })

    return () => {
      beobachter.disconnect()
      mutationBeobachter.disconnect()
    }
  }, [zoom, canvasRef])

  function zoomErhoehen() {
    setZoom((aktuell) => ZOOM_STUFEN.find((s) => s > aktuell) ?? aktuell)
  }

  function zoomVerringern() {
    setZoom((aktuell) => [...ZOOM_STUFEN].reverse().find((s) => s < aktuell) ?? aktuell)
  }

  if (laden) {
    return <div style={{ ...stile.container, padding: '8px', fontSize: '12px' }}>PDF wird geladen…</div>
  }

  if (fehler) {
    return <div style={{ ...stile.container, color: 'red', padding: '8px', fontSize: '12px' }}>{fehler}</div>
  }

  return (
    <div style={stile.container}>
      <div style={stile.kopfzeile}>
        <strong style={stile.titel} title={titel}>{titel}</strong>
        <span style={stile.seitenInfo}>
          {aktuelleSeite}/{seitenanzahl}
        </span>
        {onClose && (
          <button
            style={stile.schliessenKopf}
            onClick={onClose}
            title="PDF schließen"
          >
            ✕
          </button>
        )}
      </div>

      <div ref={wrapperRef} style={stile.canvasWrapper}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>

      <div style={stile.navigation}>
        <button onClick={vorherige} disabled={aktuelleSeite <= 1} title="Vorherige Seite">
          ←
        </button>
        <button onClick={naechste} disabled={aktuelleSeite >= seitenanzahl} title="Nächste Seite">
          →
        </button>

        <span style={{ flex: 1 }} />

        <button
          onClick={zoomVerringern}
          disabled={zoom <= ZOOM_STUFEN[0]}
          title="Verkleinern"
        >
          −
        </button>
        <span style={stile.zoomAnzeige}>{Math.round(zoom * 100)}%</span>
        <button
          onClick={zoomErhoehen}
          disabled={zoom >= ZOOM_STUFEN[ZOOM_STUFEN.length - 1]}
          title="Vergrößern"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default PdfViewer
