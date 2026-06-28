// Metadaten-Hilfsfunktionen rund um ein geladenes PDF.js-Dokument.
// Bewusst frei von pdfjs-Imports (arbeitet nur über das doc-Interface),
// damit die Logik isoliert testbar ist.

// Löst ein PDF-Sprungziel ("destination") in eine 1-basierte Seitennummer auf.
// `dest` kann ein benannter String (→ erst nachschlagen) oder ein explizites
// Array sein, dessen erstes Element die Ziel-Seite referenziert (meist ein
// Ref-Objekt, selten eine direkte Seitenzahl). Liefert null, wenn das Ziel
// nicht auflösbar ist. Wird sowohl für das Outline-Panel als auch für die
// klickbaren internen Link-Annotationen genutzt.
export async function destZuSeite(doc, dest) {
  try {
    let explizit = dest
    if (typeof dest === 'string') explizit = await doc.getDestination(dest)
    if (!Array.isArray(explizit) || explizit.length === 0) return null
    const ref = explizit[0]
    if (ref == null) return null
    if (typeof ref === 'number') return ref + 1
    const index = await doc.getPageIndex(ref)
    return index + 1
  } catch (e) {
    return null
  }
}

// Lädt das PDF-Outline (Lesezeichen/Inhaltsverzeichnis) und löst jedes
// Sprungziel vorab in eine Seitennummer auf, damit Klicks im UI synchron
// navigieren können. Liefert eine rekursive Struktur aus
// { titel, seite, url, kinder }.
export async function outlineLaden(doc) {
  let roh
  try {
    roh = await doc.getOutline()
  } catch (e) {
    return []
  }
  async function aufloesen(items) {
    if (!Array.isArray(items)) return []
    const ergebnis = []
    for (const item of items) {
      ergebnis.push({
        titel: item.title || '',
        seite: item.dest ? await destZuSeite(doc, item.dest) : null,
        url: item.url || null,
        kinder: await aufloesen(item.items),
      })
    }
    return ergebnis
  }
  return aufloesen(roh)
}
