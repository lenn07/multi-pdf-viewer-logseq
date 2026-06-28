import React, { useEffect, useRef, useState } from 'react'
import { getPdfjsLib, destZuSeite } from '../hooks/usePdf'
import { externenLinkOeffnen } from '../externerLink'

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
  onZuSeite,
}) {
  const wrapperRef    = useRef(null)
  const canvasRef     = useRef(null)
  const textLayerRef  = useRef(null)
  const [sichtbar,  setSichtbar]  = useState(false)
  const [gerendert, setGerendert] = useState(false)
  // Klickbare Link-Annotationen dieser Seite, bereits in Pixel-Positionen
  // (left/top/width/height) für die aktuelle Anzeigegröße umgerechnet.
  const [links, setLinks] = useState([])

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

  // Link-Annotationen laden und in Pixel-Positionen für die aktuelle
  // Anzeigegröße umrechnen. Nur echte Links (interne Sprungziele + externe
  // URLs) — andere Annotationstypen (Highlights, Kommentare) ignorieren wir.
  useEffect(() => {
    if (!sichtbar || !pdfDokument || zielBreite <= 0) {
      setLinks([])
      return
    }
    let abgebrochen = false
    ;(async () => {
      try {
        const seite = await pdfDokument.getPage(seitennummer)
        if (abgebrochen) return
        const vp1 = seite.getViewport({ scale: 1 })
        const vp = seite.getViewport({ scale: zielBreite / vp1.width })
        const annotationen = await seite.getAnnotations()
        if (abgebrochen) return
        const linkListe = annotationen
          .filter((a) => a.subtype === 'Link' && (a.url || a.dest))
          .map((a) => {
            const r = vp.convertToViewportRectangle(a.rect)
            return {
              left: Math.min(r[0], r[2]),
              top: Math.min(r[1], r[3]),
              width: Math.abs(r[2] - r[0]),
              height: Math.abs(r[3] - r[1]),
              url: a.url || null,
              dest: a.dest || null,
            }
          })
        setLinks(linkListe)
      } catch (err) {
        if (!abgebrochen)
          console.error('[MultiPdfViewer] Annotationen Fehler S.' + seitennummer, err)
      }
    })()
    return () => { abgebrochen = true }
  }, [sichtbar, pdfDokument, seitennummer, zielBreite])

  function linkKlick(e, link) {
    e.preventDefault()
    if (link.url) {
      externenLinkOeffnen(link.url)
    } else if (link.dest) {
      destZuSeite(pdfDokument, link.dest).then((seite) => {
        if (seite && onZuSeite) onZuSeite(seite)
      })
    }
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

      {links.length > 0 && (
        <div className="pdf-annotation-layer">
          {links.map((link, i) => (
            <a
              key={i}
              className="pdf-annotation-link"
              href={link.url || '#'}
              style={{
                left:   link.left + 'px',
                top:    link.top + 'px',
                width:  link.width + 'px',
                height: link.height + 'px',
              }}
              title={link.url || 'Im Dokument springen'}
              onClick={(e) => linkKlick(e, link)}
            />
          ))}
        </div>
      )}

      {!gerendert && <div style={stile.platzhalter}>Seite {seitennummer}</div>}
    </div>
  )
}

export default PdfPage
