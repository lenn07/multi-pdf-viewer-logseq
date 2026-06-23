import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { usePdf } from '../hooks/usePdf'
import { imDateiexplorerAnzeigen } from '../main'
import PdfPage from './PdfPage'

// Plattformabhängiger Name des Datei-Managers für die Menü-Beschriftung.
const istMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
const EXPLORER_LABEL = istMac ? 'Im Finder anzeigen' : 'Im Explorer anzeigen'

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
  zoomAnzeige: {
    fontSize: '11px', color: 'var(--ls-secondary-text-color, #888)',
    minWidth: '32px', textAlign: 'center',
  },
  kontextmenu: {
    position: 'fixed',
    zIndex: 9999,
    minWidth: '180px',
    padding: '4px',
    background: 'var(--ls-primary-background-color, #fff)',
    color: 'var(--ls-primary-text-color, #333)',
    border: '1px solid var(--ls-border-color, #ccc)',
    borderRadius: '6px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
    fontSize: '13px',
  },
  kontextmenuEintrag: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 10px', cursor: 'pointer', borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
}

const ZOOM_STUFEN  = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
const ZOOM_DEFAULT = 1.0

function PdfViewer({ url, titel, onClose, onAuslagern, ownerDocument }) {
  const [zoom,           setZoom]           = useState(ZOOM_DEFAULT)
  const [aktuelleSeite,  setAktuelleSeite]  = useState(1)
  const [kachelBreite,   setKachelBreite]   = useState(0)
  const [scroller,       setScroller]       = useState(null)
  const setScrollerRef = useCallback((el) => setScroller(el), [])
  // Scroll-Anker für den Größen-Reanchor: die Seite am oberen Rand plus der
  // Bruchteil, wie weit man in sie hineingescrollt ist. Höhenunabhängig — dadurch
  // bleibt die Position auch bei gemischten/kurzen Seiten exakt erhalten.
  const ankerRef = useRef({ page: 1, frac: 0 })
  // Letzte verarbeitete Zielbreite, um einen echten Größenwechsel vom ersten
  // Erscheinen (0 → X) zu unterscheiden.
  const vorherigeBreiteRef = useRef(0)

  // Kontextmenü (Rechtsklick / Zwei-Finger-Tipp). `null` = geschlossen,
  // sonst { x, y } in Viewport-Koordinaten des jeweiligen Dokuments.
  const containerRef = useRef(null)
  const [kontextmenu, setKontextmenu] = useState(null)

  function onKontextmenu(e) {
    e.preventDefault()
    // Verhindert, dass der Dokument-weite contextmenu-Listener (siehe Effekt
    // unten) das gerade neu gesetzte Menü sofort wieder schließt.
    e.nativeEvent.stopPropagation()
    setKontextmenu({ x: e.clientX, y: e.clientY })
  }

  function explorerOeffnen() {
    setKontextmenu(null)
    imDateiexplorerAnzeigen(url)
  }

  // Menü schließen bei Klick irgendwohin, Scrollen oder Escape. Listener am
  // richtigen Dokument registrieren — im ausgelagerten Popout-Fenster lebt der
  // Viewer in einem anderen `document` als dem des Haupt-iframes.
  useEffect(() => {
    if (!kontextmenu) return
    const doc = containerRef.current?.ownerDocument || document
    const schliessen = () => setKontextmenu(null)
    const onKeydown = (e) => { if (e.key === 'Escape') schliessen() }
    doc.addEventListener('click', schliessen)
    doc.addEventListener('scroll', schliessen, true)
    doc.addEventListener('keydown', onKeydown)
    doc.addEventListener('contextmenu', schliessen)
    return () => {
      doc.removeEventListener('click', schliessen)
      doc.removeEventListener('scroll', schliessen, true)
      doc.removeEventListener('keydown', onKeydown)
      doc.removeEventListener('contextmenu', schliessen)
    }
  }, [kontextmenu])

  const { pdfDokument, seitenanzahl, defaultViewport, laden, fehler } = usePdf(url, ownerDocument)

  useEffect(() => {
    if (!scroller) return
    // 0-Breite ignorieren: Beim Verstecken des Viewers (hideMainUI) meldet der
    // Observer clientWidth = 0. Würden wir das übernehmen, würde zielBreite 0 und
    // die Seiten-Wrapper würden ausgehängt → Scroll-Position ginge verloren.
    // Wir behalten stattdessen die letzte gültige Breite, Seiten bleiben gerendert.
    function messen() {
      const breite = scroller.clientWidth
      if (breite > 0) setKachelBreite(breite)
    }
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
      const oben = scroller.scrollTop
      const ref = oben + scroller.clientHeight / 3
      let beste = 1
      for (const el of elemente) {
        // Anker: letzte Seite, deren Anfang am oberen Rand oder darüber liegt,
        // samt Bruchteil hinein. Wird für den höhenunabhängigen Resize-Reanchor genutzt.
        if (el.offsetTop <= oben) {
          const h = el.offsetHeight
          ankerRef.current = {
            page: parseInt(el.dataset.seite, 10),
            frac: h > 0 ? (oben - el.offsetTop) / h : 0,
          }
        }
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

  // Bei Größenänderung (Viewer-Breite, Zoom oder PDF hinzugefügt/entfernt → andere
  // Kachelbreite) reflowen die Seiten und dieselbe Pixel-Scrollposition zeigt auf
  // einen anderen Inhalt. Deshalb nach jedem echten Größenwechsel den Scroll wieder
  // exakt auf den Anker (Seite am oberen Rand + Bruchteil) setzen — höhenunabhängig,
  // damit es auch bei gemischten/kurzen Seiten nicht driftet. Als Layout-Effekt
  // (vor dem Paint, kein Flackern). vorher <= 0 überspringt das erste Erscheinen.
  useLayoutEffect(() => {
    const zielBreite = kachelBreite * zoom
    const vorher = vorherigeBreiteRef.current
    vorherigeBreiteRef.current = zielBreite
    if (!scroller || zielBreite <= 0 || vorher <= 0) return
    const { page, frac } = ankerRef.current
    const ziel = scroller.querySelector(`[data-seite="${page}"]`)
    if (ziel) scroller.scrollTop = ziel.offsetTop + frac * ziel.offsetHeight
  }, [kachelBreite, zoom, scroller])

  function zuSeite(n) {
    if (!scroller) return
    const ziel = scroller.querySelector(`[data-seite="${n}"]`)
    if (ziel) scroller.scrollTo({ top: ziel.offsetTop - 8, behavior: 'smooth' })
  }

  function vorherige()      { zuSeite(Math.max(1, aktuelleSeite - 1)) }
  function naechste()       { zuSeite(Math.min(seitenanzahl, aktuelleSeite + 1)) }
  function zoomErhoehen()   { setZoom((z) => ZOOM_STUFEN.find((s) => s > z) ?? z) }
  function zoomVerringern() { setZoom((z) => ZOOM_STUFEN.findLast((s) => s < z) ?? z) }

  if (laden)  return <div style={{ ...stile.container, padding: '8px', fontSize: '12px' }}>PDF wird geladen…</div>
  if (fehler) return <div style={{ ...stile.container, color: 'red', padding: '8px', fontSize: '12px' }}>{fehler}</div>

  const zielBreite = Math.max(0, kachelBreite * zoom)

  return (
    <div ref={containerRef} style={stile.container} onContextMenu={onKontextmenu}>
      <div style={stile.kopfzeile}>
        <strong style={stile.titel} title={titel}>{titel}</strong>
        <span style={stile.seitenInfo}>{aktuelleSeite}/{seitenanzahl}</span>
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
            />
          ))}
      </div>

      <div style={stile.navigation}>
        <button onClick={vorherige} disabled={aktuelleSeite <= 1} title="Vorherige Seite">←</button>
        <button onClick={naechste} disabled={aktuelleSeite >= seitenanzahl} title="Nächste Seite">→</button>

        <span style={{ flex: 1 }} />
        <button onClick={zoomVerringern} disabled={zoom <= ZOOM_STUFEN[0]} title="Verkleinern">−</button>
        <span style={stile.zoomAnzeige}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomErhoehen} disabled={zoom >= ZOOM_STUFEN[ZOOM_STUFEN.length - 1]} title="Vergrößern">+</button>
      </div>

      {kontextmenu && (
        <div
          style={{ ...stile.kontextmenu, left: kontextmenu.x, top: kontextmenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            style={stile.kontextmenuEintrag}
            onClick={explorerOeffnen}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ls-secondary-background-color, #eee)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>📂</span>
            <span>{EXPLORER_LABEL}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfViewer
