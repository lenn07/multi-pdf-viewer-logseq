import React, { useEffect, useRef, useState } from 'react'
import { getPdfjsLib } from '../hooks/usePdf'

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

function PdfPage({
  pdfDokument,
  seitennummer,
  zielBreite,
  defaultViewport,
  scrollContainer,
}) {
  const wrapperRef    = useRef(null)
  const canvasRef     = useRef(null)
  const textLayerRef  = useRef(null)
  const [sichtbar,  setSichtbar]  = useState(false)
  const [gerendert, setGerendert] = useState(false)

  const seitenHoehe =
    defaultViewport && zielBreite > 0
      ? (zielBreite * defaultViewport.height) / defaultViewport.width
      : 0

  // IntersectionObserver
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const obs = new IntersectionObserver(
      (eintraege) => { for (const e of eintraege) setSichtbar(e.isIntersecting) },
      { root: scrollContainer || null, rootMargin: '200% 0px', threshold: 0 }
    )
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [scrollContainer])

  // Canvas rendern
  useEffect(() => {
    if (!sichtbar || !pdfDokument) return
    let abgebrochen = false
    let renderTask  = null
    pdfDokument.getPage(seitennummer).then((seite) => {
      if (abgebrochen || !canvasRef.current) return
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const vp = seite.getViewport({ scale: RENDER_SCALE })
      canvas.width = vp.width
      canvas.height = vp.height
      renderTask = seite.render({ canvasContext: ctx, viewport: vp })
      return renderTask.promise
    }).then(() => { if (!abgebrochen) setGerendert(true) })
      .catch((err) => {
        if (!abgebrochen && err.name !== 'RenderingCancelledException')
          console.error('PDF Render Fehler S.' + seitennummer, err)
      })
    return () => {
      abgebrochen = true
      renderTask?.cancel()
      const canvas = canvasRef.current
      if (canvas) { canvas.width = 0; canvas.height = 0 }
      setGerendert(false)
    }
  }, [sichtbar, pdfDokument, seitennummer])

  // Text-Layer rendern (nach Canvas-Render)
  useEffect(() => {
    if (!sichtbar || !pdfDokument || !gerendert || zielBreite <= 0) return
    const div = textLayerRef.current
    if (!div) return
    let abgebrochen = false
    ;(async () => {
      try {
        const lib   = await getPdfjsLib()
        const seite = await pdfDokument.getPage(seitennummer)
        if (abgebrochen) return
        const vp1       = seite.getViewport({ scale: 1 })
        const anzeigeVp = seite.getViewport({ scale: zielBreite / vp1.width })
        const textContent = await seite.getTextContent()
        if (abgebrochen) return
        div.innerHTML = ''
        if (typeof lib.renderTextLayer === 'function') {
          await lib.renderTextLayer({ textContentSource: textContent, container: div, viewport: anzeigeVp }).promise
        } else if (lib.TextLayer) {
          await new lib.TextLayer({ textContentSource: textContent, container: div, viewport: anzeigeVp }).render()
        }
      } catch (err) {
        if (!abgebrochen && err.name !== 'RenderingCancelledException')
          console.error('[MultiPdfViewer] Text-Layer Fehler S.' + seitennummer, err)
      }
    })()
    return () => { abgebrochen = true }
  }, [sichtbar, pdfDokument, seitennummer, gerendert, zielBreite])

  return (
    <div
      ref={wrapperRef}
      data-seite={seitennummer}
      style={{
        ...stile.seiteWrapper,
        width:  zielBreite + 'px',
        height: seitenHoehe + 'px',
      }}
    >
      <canvas ref={canvasRef} style={stile.canvas} />

      <div
        ref={textLayerRef}
        className="pdf-text-layer"
        style={{
          zIndex: 2,
          // PDF.js v5 erwartet diese CSS-Variable auf dem Text-Layer-Container.
          // Ohne sie haben die Span-Glyphen font-size 0, die Selektion springt.
          // Scale = Anzeigegröße / Originalgröße der PDF-Seite.
          '--total-scale-factor':
            defaultViewport && zielBreite > 0
              ? zielBreite / defaultViewport.width
              : 1,
        }}
      />

      {!gerendert && <div style={stile.platzhalter}>Seite {seitennummer}</div>}
    </div>
  )
}

export default PdfPage
