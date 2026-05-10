// Sync-Cache aller bekannten Annotation-Block-UUIDs.
// Notwendig damit annotationKlickAbfangen synchron entscheiden kann ob es preventDefault
// rufen soll — bevor Logseqs eigener Click-Handler den Klick verarbeitet.
const bekannte = new Set()

export function annotationBlockMerken(uuid) {
  if (uuid) bekannte.add(String(uuid))
}

export function istAnnotationBlock(uuid) {
  return uuid ? bekannte.has(String(uuid)) : false
}

// Lädt alle existierenden Annotation-Blöcke beim Plugin-Start aus Logseqs DB,
// damit auch Blöcke aus früheren Sessions oder vom nativen PDF-Viewer erkannt werden.
export async function annotationCacheLaden() {
  try {
    const ergebnisse = await logseq.DB.datascriptQuery(`
      [:find ?uuid
       :where
       [?b :block/properties ?p]
       [(get ?p :ls-type) ?t]
       [(= ?t "annotation")]
       [?b :block/uuid ?uuid]]
    `)
    if (Array.isArray(ergebnisse)) {
      for (const tupel of ergebnisse) {
        const uuid = Array.isArray(tupel) ? tupel[0] : tupel
        if (uuid) bekannte.add(String(uuid))
      }
    }
  } catch (_) {
    // Query-Schema variiert zwischen Logseq-Versionen — Fallback ist Lazy-Caching beim Klick.
  }
}

// Lazy-Check: falls ein Block noch nicht im Cache ist, async prüfen und cachen.
// So füllt sich der Cache auch ohne erfolgreiche Initialladung.
// Properties kommen via getBlock in camelCase zurück (lsType, nicht 'ls-type').
export async function annotationBlockPruefenUndMerken(uuid) {
  if (!uuid || istAnnotationBlock(uuid)) return
  try {
    const block = await logseq.Editor.getBlock(uuid)
    if (block?.properties?.lsType === 'annotation') {
      bekannte.add(String(uuid))
    }
  } catch (_) {}
}
