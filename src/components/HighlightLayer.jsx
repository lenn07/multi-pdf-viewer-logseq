import React from 'react'
import { HIGHLIGHT_COLORS } from '../utils/logseqAnnotation'

// Konvertiert EDN-Absolutkoordinaten in CSS-Prozent.
// EDN: x1/y1/x2/y2 = absolute Pixel; width/height = Seitenmaße als Referenz.
function ednRectZuProzent(rect) {
  if (!rect || !rect.width || !rect.height) return null
  return {
    left:   (rect.x1 / rect.width)  * 100,
    top:    (rect.y1 / rect.height) * 100,
    width:  ((rect.x2 - rect.x1) / rect.width)  * 100,
    height: ((rect.y2 - rect.y1) / rect.height) * 100,
  }
}

function HighlightLayer({ annotations, seitennummer, activeStamp, loeschModus, onLoeschen }) {
  const seitenAnnotations = annotations.filter((a) => a.page === seitennummer)

  // Im Lösch-Modus müssen die Rect-Divs Klicks empfangen — der Wrapper-Layer
  // bleibt pointerEvents: 'none', sonst würde er den Text-Layer blockieren.
  const rectStyle = loeschModus
    ? { pointerEvents: 'auto', cursor: 'pointer' }
    : null

  function rectKlick(e, stamp) {
    if (!loeschModus) return
    e.stopPropagation()
    e.preventDefault()
    onLoeschen?.(stamp)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
        overflow: 'hidden',
      }}
    >
      {seitenAnnotations.flatMap((ann) => {
        const stamp = ann.id?._edn_uuid
        const isActive = stamp === activeStamp
        const farbe = HIGHLIGHT_COLORS[ann.properties?.color] || HIGHLIGHT_COLORS.yellow

        // Text-Highlight: mehrere Rects aus position.rects
        const rects = ann.position?.rects?.values
        if (rects && rects.length > 0) {
          return rects.map((rect, i) => {
            const pct = ednRectZuProzent(rect)
            if (!pct) return null
            return (
              <div
                key={`${stamp}-${i}`}
                className={isActive ? 'highlight-puls' : ''}
                title={loeschModus ? 'Klicken zum Löschen' : undefined}
                onClick={(e) => rectKlick(e, stamp)}
                style={{
                  position:        'absolute',
                  left:            pct.left   + '%',
                  top:             pct.top    + '%',
                  width:           pct.width  + '%',
                  height:          pct.height + '%',
                  backgroundColor: farbe,
                  ...rectStyle,
                }}
              />
            )
          }).filter(Boolean)
        }

        // Bereichs-Highlight: bounding-Rect
        const b = ann.position?.bounding
        const pct = ednRectZuProzent(b)
        if (!pct) return []
        return [
          <div
            key={stamp}
            className={isActive ? 'highlight-puls' : ''}
            title={loeschModus ? 'Klicken zum Löschen' : undefined}
            onClick={(e) => rectKlick(e, stamp)}
            style={{
              position:        'absolute',
              left:            pct.left   + '%',
              top:             pct.top    + '%',
              width:           pct.width  + '%',
              height:          pct.height + '%',
              backgroundColor: farbe,
              ...rectStyle,
            }}
          />,
        ]
      })}
    </div>
  )
}

export default HighlightLayer
