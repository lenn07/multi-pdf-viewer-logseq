import React, { useState } from 'react'
import { useHighlightDrag } from '../hooks/useHighlightDrag'
import { buildAnnotationBlock, HIGHLIGHT_COLORS } from '../utils/logseqAnnotation'

const FARBEN = ['yellow', 'red', 'green', 'blue', 'purple']

// ednRects: Array von { x1, y1, x2, y2, width, height } in EDN-Absolutkoordinaten
// ednBoundingRect: für Bereichs-Highlight { x1, y1, x2, y2 } in EDN-Koordinaten
// defaultViewport: { width, height } bei scale=1
function AnnotationTooltip({
  position,
  selektierterText,
  ednRects,
  ednBoundingRect,
  pctRect,
  seitennummer,
  defaultViewport,
  pdfUrl,
  pngSchreiben,
  cropAreaPng,
  onErstellt,
  onSchliessen,
}) {
  const [gewaehlteFarbe, setGewaehlteFarbe] = useState('yellow')
  const { dragStarten } = useHighlightDrag()

  // Relativer Pfad (../assets/<dateiname>.pdf) — wird als hl-pdf-Property
  // am Annotation-Block gespeichert, damit der Klick-Handler den PDF nicht
  // erst mühsam aus der Block-Hierarchie rekonstruieren muss.
  const pdfRelativ = pdfUrl
    ? `../assets/${decodeURIComponent(pdfUrl.split('?')[0].split('#')[0].split('/').pop())}`
    : null

  function highlightDatenBauen(farbe) {
    const id = crypto.randomUUID()

    if (ednBoundingRect) {
      return {
        ednHighlight: {
          id: { _edn_uuid: id },
          page: seitennummer,
          position: {
            bounding: { ...ednBoundingRect, width: defaultViewport.width, height: defaultViewport.height },
            rects:    { _edn_list: true, values: [] },
            page:     seitennummer,
          },
          // Logseqs area-highlight?-Check verlangt :image im content. Ohne den Key
          // wird der Highlight als Text-Highlight interpretiert und gar nicht angezeigt.
          // Der image-Wert ist gleichzeitig der Stamp im PNG-Dateinamen.
          content:    { text: '[:span]', image: id },
          properties: { color: farbe },
        },
        annotationBlock: buildAnnotationBlock({ type: 'area', text: '', page: seitennummer, stamp: id, color: farbe, pdfPfad: pdfRelativ }),
      }
    }

    // Text-Highlight: bounding = Hüllrechteck aller einzelnen Rects
    const bounding = ednRects.length > 0 ? {
      x1:     Math.min(...ednRects.map((r) => r.x1)),
      y1:     Math.min(...ednRects.map((r) => r.y1)),
      x2:     Math.max(...ednRects.map((r) => r.x2)),
      y2:     Math.max(...ednRects.map((r) => r.y2)),
      width:  defaultViewport.width,
      height: defaultViewport.height,
    } : { x1: 0, y1: 0, x2: 0, y2: 0, width: defaultViewport.width, height: defaultViewport.height }

    return {
      ednHighlight: {
        id: { _edn_uuid: id },
        page: seitennummer,
        position: {
          bounding,
          rects: { _edn_list: true, values: ednRects },
          page:  seitennummer,
        },
        content:    { text: selektierterText },
        properties: { color: farbe },
      },
      annotationBlock: buildAnnotationBlock({ type: 'text', text: selektierterText, page: seitennummer, stamp: id, color: farbe, pdfPfad: pdfRelativ }),
    }
  }

  function onDragStart(e) {
    e.preventDefault()
    const { ednHighlight, annotationBlock } = highlightDatenBauen(gewaehlteFarbe)
    const stamp = ednHighlight.id._edn_uuid

    // Crop sofort (Canvas-Snapshot bevor sich was ändern kann), Save erst nach
    // insertBlock im onErfolg-Callback — dort haben wir die Block-UUID, die
    // Logseq für den Bilddateinamen braucht.
    const cropPromise = (ednBoundingRect && pctRect && cropAreaPng)
      ? cropAreaPng(pctRect)
      : Promise.resolve(null)

    dragStarten({
      annotationBlock,
      farbe: HIGHLIGHT_COLORS[gewaehlteFarbe],
      onErfolg: async (neuerBlock) => {
        if (ednBoundingRect && neuerBlock && pngSchreiben) {
          try {
            const blob = await cropPromise
            if (blob) {
              const seite = await logseq.Editor.getPage(neuerBlock.page?.id ?? neuerBlock.page)
              const seitenName = seite?.originalName || seite?.name
              if (seitenName) {
                const dateiname = `${seitennummer}_${neuerBlock.uuid}_${stamp}.png`
                await pngSchreiben(seitenName, dateiname, blob)
              }
            }
          } catch (err) {
            console.error('[MultiPdfViewer] PNG-Save fehlgeschlagen:', err)
          }
        }
        // EDN-Save MUSS awaited werden — sonst läuft er fire-and-forget weiter
        // und blockiert den nächsten Drag (Chrome serialisiert File-Ops pro Handle).
        const ednResult = onErstellt?.({ ednHighlight, annotationBlock, neuerBlock })
        if (ednResult && typeof ednResult.then === 'function') {
          try { await ednResult } catch (err) {
            console.error('[MultiPdfViewer] EDN-Save fehlgeschlagen:', err)
          }
        }
      },
    })
  }

  return (
    <div
      style={{
        position:     'absolute',
        left:         Math.max(0, position.x) + 'px',
        top:          Math.max(0, position.y) + 'px',
        zIndex:       10,
        background:   'var(--ls-primary-background-color, #fff)',
        border:       '1px solid var(--ls-border-color, #ccc)',
        borderRadius: '6px',
        padding:      '4px 6px',
        display:      'flex',
        alignItems:   'center',
        gap:          '4px',
        boxShadow:    '0 2px 8px rgba(0,0,0,0.18)',
        userSelect:   'none',
      }}
    >
      {FARBEN.map((farbe) => (
        <button
          key={farbe}
          onClick={() => setGewaehlteFarbe(farbe)}
          title={farbe}
          style={{
            width:           '16px',
            height:          '16px',
            borderRadius:    '50%',
            backgroundColor: HIGHLIGHT_COLORS[farbe],
            border:          gewaehlteFarbe === farbe ? '2px solid #333' : '2px solid transparent',
            cursor:          'pointer',
            padding:         0,
            flexShrink:      0,
          }}
        />
      ))}

      <div
        onMouseDown={onDragStart}
        title="In Logseq-Block ziehen"
        style={{
          marginLeft:   '2px',
          padding:      '2px 6px',
          background:   HIGHLIGHT_COLORS[gewaehlteFarbe],
          borderRadius: '4px',
          cursor:       'grab',
          fontSize:     '11px',
          color:        '#000',
          maxWidth:     '120px',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          userSelect:   'none',
          flexShrink:   0,
        }}
      >
        {selektierterText?.slice(0, 20) || '▣ Bereich'} ↗
      </div>

      <button
        onClick={onSchliessen}
        style={{
          fontSize:   '12px',
          padding:    '0 3px',
          background: 'transparent',
          border:     'none',
          cursor:     'pointer',
          color:      'var(--ls-secondary-text-color, #888)',
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default AnnotationTooltip
