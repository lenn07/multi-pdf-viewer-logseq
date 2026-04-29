import React, { useEffect, useRef, useState } from 'react'

// PDF.js rendert immer mit dieser Scale (feste Canvas-Auflösung für gute Bildqualität).
// Die tatsächliche Darstellungsgröße wird anschließend per CSS skaliert.
const RENDER_SCALE = 1.5

const stile = {
  seiteWrapper: {
    display: 'block',
    margin: '0 auto 8px',
    backgroundColor: 'var(--ls-secondary-background-color, #f5f5f5)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
    position: 'relative',
    boxSizing: 'border-box',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  platzhalter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ls-secondary-text-color, #888)',
    fontSize: '11px',
    pointerEvents: 'none',
  },
}

// Eine einzelne PDF-Seite. Wird erst gerendert, wenn sie sich im sichtbaren Bereich
// (oder im Vorlade-Puffer) des Scroll-Containers befindet.
//
// Props:
//   - pdfDokument: das von usePdf gelieferte PDF.js-Document
//   - seitennummer: 1-basierte Seitennummer
//   - zielBreite: gewünschte Anzeige-Breite in Pixeln (Container-Breite × Zoom)
//   - defaultViewport: { width, height } bei scale=1 — Höhe des Platzhalters wird daraus berechnet
//   - scrollContainer: das DOM-Element, das gescrollt wird — als IntersectionObserver-Root
function PdfPage({ pdfDokument, seitennummer, zielBreite, defaultViewport, scrollContainer }) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  const [sichtbar, setSichtbar] = useState(false)
  const [gerendert, setGerendert] = useState(false)

  // Aspect Ratio aus Default-Viewport — für Platzhalter-Höhe BEVOR die Seite geladen ist.
  const seitenHoehe =
    defaultViewport && zielBreite > 0
      ? (zielBreite * defaultViewport.height) / defaultViewport.width
      : 0

  // IntersectionObserver beobachtet die Seite beidseitig:
  //   rein → rendern, raus → Canvas-Buffer freigeben.
  // rootMargin "200% 0px" hält ±2 Viewport-Höhen Vorlauf für flüssiges Scrollen,
  // begrenzt aber zugleich den Speicherverbrauch — weit entfernte Seiten geben ihren
  // Canvas frei, sodass auch sehr lange PDFs nicht den RAM fluten.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const obs = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) setSichtbar(e.isIntersecting)
      },
      {
        root: scrollContainer || null,
        rootMargin: '200% 0px',
        threshold: 0,
      }
    )
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [scrollContainer])

  // Render wenn sichtbar; beim Verlassen des Sichtfelds (oder Unmount) Canvas-Speicher freigeben.
  // canvas.width = 0 zwingt den Browser, den Pixel-Buffer wegzuwerfen — ohne diese Zeile
  // wachsen 4 MB pro A4-Seite über die Lebenszeit des Viewers an.
  useEffect(() => {
    if (!sichtbar || !pdfDokument) return

    let abgebrochen = false
    let renderTask = null

    pdfDokument
      .getPage(seitennummer)
      .then((seite) => {
        if (abgebrochen || !canvasRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const vp = seite.getViewport({ scale: RENDER_SCALE })
        canvas.width = vp.width
        canvas.height = vp.height

        renderTask = seite.render({ canvasContext: ctx, viewport: vp })
        return renderTask.promise
      })
      .then(() => {
        if (!abgebrochen) setGerendert(true)
      })
      .catch((err) => {
        if (!abgebrochen && err.name !== 'RenderingCancelledException') {
          console.error('PDF Render Fehler S.' + seitennummer, err)
        }
      })

    return () => {
      abgebrochen = true
      renderTask?.cancel()
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      setGerendert(false)
    }
  }, [sichtbar, pdfDokument, seitennummer])

  return (
    <div
      ref={wrapperRef}
      data-seite={seitennummer}
      style={{
        ...stile.seiteWrapper,
        width: zielBreite + 'px',
        height: seitenHoehe + 'px',
      }}
    >
      <canvas ref={canvasRef} style={stile.canvas} />
      {!gerendert && <div style={stile.platzhalter}>Seite {seitennummer}</div>}
    </div>
  )
}

export default PdfPage
