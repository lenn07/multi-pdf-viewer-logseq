import { annotationBlockMerken } from '../utils/annotationCache'

export function useHighlightDrag() {
  function dragStarten({ annotationBlock, farbe, onErfolg }) {
    const parentDoc = window.parent?.document
    if (!parentDoc) return

    // Ghost-Div im Parent-Dokument
    const ghost = parentDoc.createElement('div')
    ghost.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:9999',
      `background:${farbe || 'rgba(255,220,0,0.9)'}`,
      'color:#000', 'padding:3px 8px', 'border-radius:4px',
      'font-size:12px', 'max-width:220px', 'overflow:hidden',
      'text-overflow:ellipsis', 'white-space:nowrap',
      'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
    ].join(';')
    const kurztext = annotationBlock.content?.slice(0, 40) ||
      (annotationBlock.properties['hl-type'] === 'area' ? '▣ Bereich' : '…')
    ghost.textContent = kurztext
    parentDoc.body.appendChild(ghost)

    let hervorgehobenerBlock = null

    function ghostBewegen(parentX, parentY) {
      ghost.style.left = parentX + 12 + 'px'
      ghost.style.top  = parentY + 12 + 'px'

      const el = parentDoc.elementFromPoint(parentX, parentY)
      const blockEl = el?.closest?.('[blockid]') || el?.closest?.('[data-block-id]')

      if (blockEl !== hervorgehobenerBlock) {
        if (hervorgehobenerBlock) hervorgehobenerBlock.style.outline = ''
        hervorgehobenerBlock = blockEl || null
        if (hervorgehobenerBlock)
          hervorgehobenerBlock.style.outline = '2px dashed var(--ls-border-color, #888)'
      }
    }

    function onMoveParent(e) { ghostBewegen(e.clientX, e.clientY) }

    function onMoveIframe(e) {
      const rect = window.frameElement?.getBoundingClientRect() || { left: 0, top: 0 }
      ghostBewegen(rect.left + e.clientX, rect.top + e.clientY)
    }

    async function ablegen() {
      const blockEl = hervorgehobenerBlock
      const blockId = blockEl
        ? (blockEl.getAttribute('blockid') || blockEl.dataset?.blockId || null)
        : null
      aufraumen()

      if (blockId) {
        try {
          const neuerBlock = await logseq.Editor.insertBlock(
            blockId,
            annotationBlock.content,
            { before: false, properties: annotationBlock.properties }
          )
          // Cache sofort updaten, damit der erste Klick auf das neue Highlight
          // synchron als Annotation erkannt wird (siehe annotationKlickAbfangen).
          annotationBlockMerken(neuerBlock?.uuid)
          onErfolg?.(neuerBlock)
        } catch (err) {
          console.error('[MultiPdfViewer] insertBlock Fehler:', err)
          logseq.App.showMsg('Fehler beim Erstellen des Blocks: ' + err.message, 'error')
        }
      } else {
        try {
          await navigator.clipboard.writeText(annotationBlock.content)
          logseq.App.showMsg('Highlight in Zwischenablage kopiert (kein Block als Ziel gefunden)')
        } catch (_) {}
      }
    }

    function onDropParent() { ablegen() }
    function onDropIframe() { ablegen() }
    function onEscape(e)    { if (e.key === 'Escape') aufraumen() }

    function aufraumen() {
      ghost.parentNode?.removeChild(ghost)
      if (hervorgehobenerBlock) hervorgehobenerBlock.style.outline = ''
      hervorgehobenerBlock = null
      parentDoc.removeEventListener('mousemove', onMoveParent)
      parentDoc.removeEventListener('mouseup',   onDropParent)
      document.removeEventListener('mousemove',  onMoveIframe)
      document.removeEventListener('mouseup',    onDropIframe)
      document.removeEventListener('keydown',    onEscape)
    }

    parentDoc.addEventListener('mousemove', onMoveParent)
    parentDoc.addEventListener('mouseup',   onDropParent)
    document.addEventListener('mousemove',  onMoveIframe)
    document.addEventListener('mouseup',    onDropIframe)
    document.addEventListener('keydown',    onEscape)
  }

  return { dragStarten }
}
