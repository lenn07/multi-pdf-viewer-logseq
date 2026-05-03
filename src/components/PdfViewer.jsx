import React, { useState, useEffect, useCallback } from 'react'
import { usePdf } from '../hooks/usePdf'
import PdfPage from './PdfPage'

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
  scrollBereich: {
    overflow: 'auto',
    padding: '8px 0',
    flex: 1,
    minHeight: 0,
    backgroundColor: 'var(--ls-tertiary-background-color, #ececec)',
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

function PdfViewer({ url, titel, onClose, onAuslagern, ownerDocument }) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [aktuelleSeite, setAktuelleSeite] = useState(1)
  const [kachelBreite, setKachelBreite] = useState(0)
  // Callback-Ref: hält das DOM-Element des Scrollers als State.
  // Vorteil gegenüber useRef: Effects + Kinder sehen das Element im selben Render-Schritt,
  // ohne extra "container-bereit"-Flag.
  const [scroller, setScroller] = useState(null)
  const setScrollerRef = useCallback((el) => setScroller(el), [])

  const { pdfDokument, seitenanzahl, defaultViewport, laden, fehler } = usePdf(url, ownerDocument)

  // Container-Breite messen: Basis für die Anzeige-Breite der Seiten (× Zoom).
  // ResizeObserver reagiert auf Größenänderungen der Kachel (z.B. Layout-Resize).
  useEffect(() => {
    if (!scroller) return
    function messen() {
      // clientWidth zieht eine evtl. vertikale Scrollbar bereits ab.
      setKachelBreite(scroller.clientWidth)
    }
    messen()
    const obs = new ResizeObserver(messen)
    obs.observe(scroller)
    return () => obs.disconnect()
  }, [scroller])

  // Scroll-Position → "aktuelle Seite". rAF-Throttle hält den Handler bei einer Frame-Rate
  // statt bei jedem Scroll-Tick (60–120 Hz Browser-Events). offsetTop wächst monoton, also
  // brechen wir die Iteration ab sobald wir die Referenzhöhe überschritten haben.
  useEffect(() => {
    if (!scroller || !pdfDokument) return

    let queued = false

    function aktualisieren() {
      const seitenElemente = scroller.querySelectorAll('[data-seite]')
      if (seitenElemente.length === 0) return
      const referenz = scroller.scrollTop + scroller.clientHeight / 3
      let beste = 1
      for (const seitenEl of seitenElemente) {
        if (seitenEl.offsetTop > referenz) break
        beste = parseInt(seitenEl.dataset.seite, 10)
      }
      setAktuelleSeite(beste)
    }

    function onScroll() {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        aktualisieren()
      })
    }

    aktualisieren()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [scroller, pdfDokument, kachelBreite, zoom])

  // Scrollt den Container so, dass der Anfang der Zielseite oben sichtbar ist.
  function zuSeite(n) {
    if (!scroller) return
    const ziel = scroller.querySelector(`[data-seite="${n}"]`)
    if (ziel) {
      scroller.scrollTo({ top: ziel.offsetTop - 8, behavior: 'smooth' })
    }
  }

  function vorherige() {
    zuSeite(Math.max(1, aktuelleSeite - 1))
  }

  function naechste() {
    zuSeite(Math.min(seitenanzahl, aktuelleSeite + 1))
  }

  function zoomErhoehen() {
    setZoom((aktuell) => ZOOM_STUFEN.find((s) => s > aktuell) ?? aktuell)
  }

  function zoomVerringern() {
    setZoom((aktuell) => ZOOM_STUFEN.findLast((s) => s < aktuell) ?? aktuell)
  }

  if (laden) {
    return <div style={{ ...stile.container, padding: '8px', fontSize: '12px' }}>PDF wird geladen…</div>
  }

  if (fehler) {
    return <div style={{ ...stile.container, color: 'red', padding: '8px', fontSize: '12px' }}>{fehler}</div>
  }

  // zielBreite = Kachelbreite × Zoom. Bei zoom > 1 wird die Seite breiter als die Kachel
  // → horizontaler Scroll. Bei zoom < 1 ist sie schmaler und wird durch margin: 0 auto zentriert.
  const zielBreite = Math.max(0, kachelBreite * zoom)

  return (
    <div style={stile.container}>
      <div style={stile.kopfzeile}>
        <strong style={stile.titel} title={titel}>{titel}</strong>
        <span style={stile.seitenInfo}>
          {aktuelleSeite}/{seitenanzahl}
        </span>
        {onAuslagern && (
          <button
            style={stile.schliessenKopf}
            onClick={onAuslagern}
            title="In separatem Fenster öffnen"
          >
            ↗
          </button>
        )}
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

      <div ref={setScrollerRef} style={stile.scrollBereich}>
        {pdfDokument && scroller && zielBreite > 0 &&
          Array.from({ length: seitenanzahl }, (_, i) => (
            <PdfPage
              key={i + 1}
              pdfDokument={pdfDokument}
              seitennummer={i + 1}
              zielBreite={zielBreite}
              defaultViewport={defaultViewport}
              scrollContainer={scroller}
            />
          ))}
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
