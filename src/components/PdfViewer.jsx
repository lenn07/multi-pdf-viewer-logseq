import React, { useState, useEffect, useCallback } from 'react'
import { usePdf } from '../hooks/usePdf'
import { useAnnotations } from '../hooks/useAnnotations'
import { useFileSystemAccess } from '../hooks/useFileSystemAccess'
import PdfPage from './PdfPage'

const stile = {
  container: {
    display: 'flex', flexDirection: 'column',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '4px',
    backgroundColor: 'var(--ls-primary-background-color, #fff)',
    width: '100%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden',
  },
  kopfzeile: {
    display: 'flex', alignItems: 'center', padding: '2px 6px',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    fontSize: '12px', gap: '6px', flexShrink: 0,
  },
  titel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 },
  seitenInfo: { color: 'var(--ls-secondary-text-color, #888)', fontSize: '11px', flexShrink: 0 },
  schliessenKopf: {
    padding: '0 4px', cursor: 'pointer', border: '1px solid transparent',
    background: 'transparent', color: 'var(--ls-secondary-text-color, #888)',
    fontSize: '14px', lineHeight: 1, flexShrink: 0,
  },
  scrollBereich: {
    overflow: 'auto', padding: '8px 0', flex: 1, minHeight: 0,
    backgroundColor: 'var(--ls-tertiary-background-color, #ececec)',
  },
  navigation: {
    display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center',
    padding: '2px 4px', borderTop: '1px solid var(--ls-border-color, #ccc)',
    flexShrink: 0, fontSize: '12px',
  },
  modusBtn: {
    padding: '1px 6px', fontSize: '11px', cursor: 'pointer',
    border: '1px solid var(--ls-border-color, #ccc)', borderRadius: '3px',
    background: 'transparent', color: 'var(--ls-primary-text-color, #333)',
  },
  modusBtnAktiv: { background: 'var(--ls-secondary-background-color, #eee)', fontWeight: 'bold' },
  zoomAnzeige: {
    fontSize: '11px', color: 'var(--ls-secondary-text-color, #888)',
    minWidth: '32px', textAlign: 'center',
  },
  ordnerBtn: {
    fontSize: '11px', padding: '1px 6px', cursor: 'pointer',
    border: '1px solid var(--ls-border-color, #ccc)', borderRadius: '3px',
    background: 'var(--ls-secondary-background-color, #eee)',
    color: 'var(--ls-primary-text-color, #333)',
  },
}

const ZOOM_STUFEN  = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
const ZOOM_DEFAULT = 1.0

function PdfViewer({ url, titel, onClose, onAuslagern, ownerDocument, elternBlockUuid, springZu }) {
  const [zoom,           setZoom]           = useState(ZOOM_DEFAULT)
  const [aktuelleSeite,  setAktuelleSeite]  = useState(1)
  const [kachelBreite,   setKachelBreite]   = useState(0)
  const [scroller,       setScroller]       = useState(null)
  const [modus,          setModus]          = useState('text') // 'text' | 'bereich'
  const [activeStamp,    setActiveStamp]    = useState(null)
  const setScrollerRef = useCallback((el) => setScroller(el), [])

  const { pdfDokument, seitenanzahl, defaultViewport, laden, fehler } = usePdf(url, ownerDocument)
  const { annotations, neuladen, highlightHinzufuegen, highlightEntfernen } = useAnnotations(url)
  const { ordnerVerbunden, ordnerVerbinden, pngSchreiben, pngLoeschen } = useFileSystemAccess()

  // springZu: { seite, hlStamp } — von main.jsx Annotation-Interceptor
  useEffect(() => {
    if (!springZu || !pdfDokument) return
    zuSeite(springZu.seite)
    setActiveStamp(springZu.hlStamp)
    const t = setTimeout(() => setActiveStamp(null), 2000)
    return () => clearTimeout(t)
  }, [springZu, pdfDokument])

  useEffect(() => {
    if (!scroller) return
    function messen() { setKachelBreite(scroller.clientWidth) }
    messen()
    const obs = new ResizeObserver(messen)
    obs.observe(scroller)
    return () => obs.disconnect()
  }, [scroller])

  useEffect(() => {
    if (!scroller || !pdfDokument) return
    let queued = false
    function aktualisieren() {
      const elemente = scroller.querySelectorAll('[data-seite]')
      if (!elemente.length) return
      const ref = scroller.scrollTop + scroller.clientHeight / 3
      let beste = 1
      for (const el of elemente) {
        if (el.offsetTop > ref) break
        beste = parseInt(el.dataset.seite, 10)
      }
      setAktuelleSeite(beste)
    }
    function onScroll() {
      if (queued) return
      queued = true
      requestAnimationFrame(() => { queued = false; aktualisieren() })
    }
    aktualisieren()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [scroller, pdfDokument, kachelBreite, zoom])

  function zuSeite(n) {
    if (!scroller) return
    const ziel = scroller.querySelector(`[data-seite="${n}"]`)
    if (ziel) scroller.scrollTo({ top: ziel.offsetTop - 8, behavior: 'smooth' })
  }

  function vorherige()      { zuSeite(Math.max(1, aktuelleSeite - 1)) }
  function naechste()       { zuSeite(Math.min(seitenanzahl, aktuelleSeite + 1)) }
  function zoomErhoehen()   { setZoom((z) => ZOOM_STUFEN.find((s) => s > z) ?? z) }
  function zoomVerringern() { setZoom((z) => ZOOM_STUFEN.findLast((s) => s < z) ?? z) }

  async function onAnnotationErstellt({ ednHighlight }) {
    await highlightHinzufuegen(ednHighlight)
  }

  // Komplett-Löschung: EDN-Eintrag, Logseq-Block (per hl-stamp gefunden) und
  // bei Bereichs-Highlights das zugehörige PNG. Reihenfolge: erst Block via
  // Datascript suchen (solange Block + UUID existieren), dann EDN entfernen,
  // dann Block löschen, dann PNG. Wenn der Block fehlt (User hat ihn manuell
  // gelöscht), entfernen wir trotzdem den EDN-Eintrag — sonst bliebe er
  // verwaist sichtbar.
  async function onAnnotationLoeschen(stamp) {
    if (!stamp) return
    try {
      let blockUuid = null
      let pageName  = null
      try {
        // logseq.DB.q mit Property-Filter ist über Versionen stabil; Datascript
        // mit get-on-properties kann je nach Logseq-Version scheitern.
        const treffer = await logseq.DB.q(`(property hl-stamp "${stamp}")`)
        const block   = Array.isArray(treffer) ? treffer[0] : null
        if (block?.uuid) {
          blockUuid = block.uuid
          const pageId = block.page?.id ?? block.page
          if (pageId) {
            const page = await logseq.Editor.getPage(pageId)
            pageName = page?.originalName || page?.name || null
          }
        }
      } catch (e) {
        console.warn('[MultiPdfViewer] Block-Suche fehlgeschlagen:', e.message)
      }

      const entfernt = await highlightEntfernen(stamp)

      if (blockUuid) {
        try { await logseq.Editor.removeBlock(blockUuid) }
        catch (e) { console.error('[MultiPdfViewer] removeBlock fehlgeschlagen:', e.message) }
      }

      const istArea = entfernt?.position?.rects?.values?.length === 0 || !entfernt?.position?.rects?.values
      const seite   = entfernt?.page
      if (istArea && blockUuid && pageName && seite && pngLoeschen) {
        const dateiname = `${seite}_${blockUuid}_${stamp}.png`
        await pngLoeschen(pageName, dateiname)
      }
    } catch (err) {
      console.error('[MultiPdfViewer] Highlight-Löschen fehlgeschlagen:', err)
      logseq.App?.showMsg?.('Fehler beim Löschen: ' + err.message, 'error')
    }
  }

  if (laden)  return <div style={{ ...stile.container, padding: '8px', fontSize: '12px' }}>PDF wird geladen…</div>
  if (fehler) return <div style={{ ...stile.container, color: 'red', padding: '8px', fontSize: '12px' }}>{fehler}</div>

  const zielBreite = Math.max(0, kachelBreite * zoom)
  const highlightsAktiv = elternBlockUuid && ordnerVerbunden

  return (
    <div style={stile.container}>
      <div style={stile.kopfzeile}>
        <strong style={stile.titel} title={titel}>{titel}</strong>
        <span style={stile.seitenInfo}>{aktuelleSeite}/{seitenanzahl}</span>
        {!ordnerVerbunden && (
          <button style={stile.ordnerBtn} onClick={ordnerVerbinden} title="Assets-Ordner verbinden um Highlights zu speichern">
            🗂 Ordner
          </button>
        )}
        {onAuslagern && (
          <button style={stile.schliessenKopf} onClick={onAuslagern} title="In separatem Fenster öffnen">↗</button>
        )}
        {onClose && (
          <button style={stile.schliessenKopf} onClick={onClose} title="PDF schließen">✕</button>
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
              modus={highlightsAktiv ? modus : 'text'}
              annotations={annotations}
              activeStamp={activeStamp}
              onAnnotationErstellt={onAnnotationErstellt}
              onAnnotationLoeschen={onAnnotationLoeschen}
              pdfUrl={url}
              pngSchreiben={pngSchreiben}
            />
          ))}
      </div>

      <div style={stile.navigation}>
        <button onClick={vorherige} disabled={aktuelleSeite <= 1} title="Vorherige Seite">←</button>
        <button onClick={naechste} disabled={aktuelleSeite >= seitenanzahl} title="Nächste Seite">→</button>

        {highlightsAktiv && (
          <>
            <button
              onClick={() => setModus('text')}
              style={{ ...stile.modusBtn, ...(modus === 'text' ? stile.modusBtnAktiv : {}) }}
              title="Textauswahl-Modus"
            >T</button>
            <button
              onClick={() => setModus('bereich')}
              style={{ ...stile.modusBtn, ...(modus === 'bereich' ? stile.modusBtnAktiv : {}) }}
              title="Bereichsauswahl-Modus"
            >⬚</button>
            <button
              onClick={() => setModus('loeschen')}
              style={{ ...stile.modusBtn, ...(modus === 'loeschen' ? stile.modusBtnAktiv : {}) }}
              title="Lösch-Modus: Highlight anklicken zum Entfernen"
            >🗑</button>
          </>
        )}

        <span style={{ flex: 1 }} />
        <button onClick={zoomVerringern} disabled={zoom <= ZOOM_STUFEN[0]} title="Verkleinern">−</button>
        <span style={stile.zoomAnzeige}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomErhoehen} disabled={zoom >= ZOOM_STUFEN[ZOOM_STUFEN.length - 1]} title="Vergrößern">+</button>
      </div>
    </div>
  )
}

export default PdfViewer
