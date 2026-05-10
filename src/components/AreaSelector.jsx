import React, { useState, useRef } from 'react'

function AreaSelector({ aktiv, onAuswahl }) {
  const [vorschau, setVorschau] = useState(null)
  const ref = useRef(null)
  const startRef = useRef(null)

  if (!aktiv) return null

  function getRelPos(e) {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (e.clientY - bounds.top)  / bounds.height)),
    }
  }

  function onMouseDown(e) {
    e.preventDefault()
    const pos = getRelPos(e)
    startRef.current = pos
    setVorschau({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })

    function onDocMove(ev) {
      const cur = getRelPos(ev)
      const s = startRef.current
      if (!s) return
      setVorschau({
        x1: Math.min(s.x, cur.x),
        y1: Math.min(s.y, cur.y),
        x2: Math.max(s.x, cur.x),
        y2: Math.max(s.y, cur.y),
      })
    }

    function onDocUp(ev) {
      document.removeEventListener('mousemove', onDocMove)
      document.removeEventListener('mouseup',   onDocUp)
      const cur = getRelPos(ev)
      const s = startRef.current
      startRef.current = null
      setVorschau(null)
      if (!s) return
      const rect = {
        x1: Math.min(s.x, cur.x),
        y1: Math.min(s.y, cur.y),
        x2: Math.max(s.x, cur.x),
        y2: Math.max(s.y, cur.y),
      }
      if (rect.x2 - rect.x1 > 0.01 && rect.y2 - rect.y1 > 0.01) {
        onAuswahl(rect)
      }
    }

    document.addEventListener('mousemove', onDocMove)
    document.addEventListener('mouseup',   onDocUp)
  }

  const vorschauStil = vorschau ? {
    position:        'absolute',
    left:            vorschau.x1 * 100 + '%',
    top:             vorschau.y1 * 100 + '%',
    width:           (vorschau.x2 - vorschau.x1) * 100 + '%',
    height:          (vorschau.y2 - vorschau.y1) * 100 + '%',
    border:          '2px dashed rgba(0, 100, 255, 0.8)',
    backgroundColor: 'rgba(0, 100, 255, 0.1)',
    pointerEvents:   'none',
  } : null

  return (
    <div
      ref={ref}
      style={{
        position:   'absolute',
        inset:      0,
        zIndex:     4,
        cursor:     'crosshair',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
    >
      {vorschauStil && <div style={vorschauStil} />}
    </div>
  )
}

export default AreaSelector
