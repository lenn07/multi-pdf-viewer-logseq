export const HIGHLIGHT_COLORS = {
  yellow: 'rgba(255, 220, 0, 0.4)',
  red:    'rgba(255, 80,  80,  0.4)',
  green:  'rgba(80,  200, 80,  0.4)',
  blue:   'rgba(80,  150, 255, 0.4)',
  purple: 'rgba(180, 80,  255, 0.4)',
}

export function buildAnnotationBlock({ type, text, page, stamp, color, pdfPfad }) {
  const properties = {
    'ls-type': 'annotation',
    'hl-type':  type,
    'hl-page':  page,
    'hl-stamp': stamp,
    'hl-color': color,
  }
  // hl-pdf merkt sich den Quell-PDF-Pfad direkt am Block. Macht den Klick-Handler
  // unabhängig davon, ob der Eltern-Block oder die Page einen PDF-Link enthält
  // (User können Highlights z.B. auf eine Sub-Block-Seite ziehen).
  if (pdfPfad) properties['hl-pdf'] = pdfPfad
  return {
    // Area: "[:span]"-Hiccup-Placeholder wie native hls__-Pages — der Annotation-
    // Renderer lädt das Bild aus den Properties + Block-UUID.
    content: type === 'area' ? '[:span]' : text,
    properties,
  }
}

// Logseq normalisiert Property-Keys beim Lesen zu camelCase (z.B. "ls-type" → lsType).
// Daher hier camelCase verwenden — Schreiben passiert in buildAnnotationBlock mit kebab-case.
export function parseAnnotationBlock(block) {
  const props = block?.properties
  if (!props || props.lsType !== 'annotation') return null
  return {
    type:  props.hlType  || 'text',
    page:  Number(props.hlPage),
    stamp: String(props.hlStamp),
    color: props.hlColor || 'yellow',
  }
}
