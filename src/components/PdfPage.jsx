import React, { useEffect, useRef, useState } from 'react'
import { getPdfjsLib } from '../hooks/usePdf'
import HighlightLayer from './HighlightLayer'
import AreaSelector from './AreaSelector'
import AnnotationTooltip from './AnnotationTooltip'

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
  modus,
  annotations,
  activeStamp,
  onAnnotationErstellt,
  onAnnotationLoeschen,
  pdfUrl,
  pngSchreiben,
}) {
  const wrapperRef    = useRef(null)
  const canvasRef     = useRef(null)
  const textLayerRef  = useRef(null)
  const [sichtbar,  setSichtbar]  = useState(false)
  const [gerendert, setGerendert] = useState(false)
  const [tooltip,   setTooltip]   = useState(null)
  // tooltip: { x, y, selText, ednRects, ednBoundingRect } | null

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

  // document-Level mouseup: feuert auch wenn Cursor beim Loslassen außerhalb des Text-Layers ist
  useEffect(() => {
    if (modus !== 'text') return
    function handler() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const selText = sel.toString().trim()
      if (!selText) return
      const wrapper = wrapperRef.current
      if (!wrapper || !defaultViewport || seitenHoehe <= 0 || zielBreite <= 0) return

      const range = sel.getRangeAt(0)
      // Nur Selektion innerhalb dieser Seite verarbeiten
      if (!wrapper.contains(range.commonAncestorContainer)) return

      const wBounds  = wrapper.getBoundingClientRect()
      const bounds   = range.getBoundingClientRect()
      const tooltipX = bounds.left - wBounds.left
      const tooltipY = bounds.top  - wBounds.top - 40

      const ednRects = []
      for (const r of range.getClientRects()) {
        const x1 = (r.left   - wBounds.left) / zielBreite  * defaultViewport.width
        const y1 = (r.top    - wBounds.top)  / seitenHoehe * defaultViewport.height
        const x2 = (r.right  - wBounds.left) / zielBreite  * defaultViewport.width
        const y2 = (r.bottom - wBounds.top)  / seitenHoehe * defaultViewport.height
        ednRects.push({ x1, y1, x2, y2, width: defaultViewport.width, height: defaultViewport.height })
      }

      sel.removeAllRanges()
      setTooltip({ x: tooltipX, y: tooltipY, selText, ednRects, ednBoundingRect: null })
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [modus, defaultViewport, seitenHoehe, zielBreite])

  function onBereichAusgewaehlt(pctRect) {
    if (!defaultViewport) return
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const wBounds = wrapper.getBoundingClientRect()

    // Prozentual → EDN-Absolutkoordinaten
    const ednBoundingRect = {
      x1: pctRect.x1 * defaultViewport.width,
      y1: pctRect.y1 * defaultViewport.height,
      x2: pctRect.x2 * defaultViewport.width,
      y2: pctRect.y2 * defaultViewport.height,
    }
    const tooltipX = pctRect.x1 * wBounds.width
    const tooltipY = pctRect.y1 * wBounds.height - 40

    setTooltip({ x: tooltipX, y: tooltipY, selText: '', ednRects: [], ednBoundingRect, pctRect })
  }

  // Schneidet einen Bereich aus dem gerenderten Canvas aus und liefert ihn als PNG-Blob.
  // pctRect: {x1, y1, x2, y2} in 0-1 relativ zur Seite.
  async function cropAreaPng(pctRect) {
    const srcCanvas = canvasRef.current
    if (!srcCanvas) return null
    const sx = Math.round(pctRect.x1 * srcCanvas.width)
    const sy = Math.round(pctRect.y1 * srcCanvas.height)
    const sw = Math.round((pctRect.x2 - pctRect.x1) * srcCanvas.width)
    const sh = Math.round((pctRect.y2 - pctRect.y1) * srcCanvas.height)
    if (sw <= 0 || sh <= 0) return null

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const ctx = out.getContext('2d')
    ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return await new Promise((resolve) => out.toBlob(resolve, 'image/png'))
  }

  function onHighlightErstellt(data) {
    setTooltip(null)
    // Promise zurückgeben, damit AnnotationTooltip auf den EDN-Save
    // awaiten kann — sonst kollidieren parallele Drags auf dem File-Handle.
    return onAnnotationErstellt?.(data)
  }

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
        className={`pdf-text-layer${modus === 'text' ? ' text-modus' : ''}`}
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

      <HighlightLayer
        annotations={annotations}
        seitennummer={seitennummer}
        activeStamp={activeStamp}
        loeschModus={modus === 'loeschen'}
        onLoeschen={onAnnotationLoeschen}
      />

      <AreaSelector
        aktiv={modus === 'bereich'}
        onAuswahl={onBereichAusgewaehlt}
      />

      {modus !== 'loeschen' && tooltip && (
        <AnnotationTooltip
          position={{ x: tooltip.x, y: tooltip.y }}
          selektierterText={tooltip.selText}
          ednRects={tooltip.ednRects}
          ednBoundingRect={tooltip.ednBoundingRect}
          pctRect={tooltip.pctRect}
          seitennummer={seitennummer}
          defaultViewport={defaultViewport}
          pdfUrl={pdfUrl}
          pngSchreiben={pngSchreiben}
          cropAreaPng={cropAreaPng}
          onErstellt={onHighlightErstellt}
          onSchliessen={() => setTooltip(null)}
        />
      )}

      {!gerendert && <div style={stile.platzhalter}>Seite {seitennummer}</div>}
    </div>
  )
}

export default PdfPage
