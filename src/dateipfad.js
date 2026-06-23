// Wandelt eine `file://`-URL in einen absoluten Dateisystempfad um.
// Gibt `null` zurück, wenn die URL keine gültige file://-URL ist.
//
// Beispiele:
//   "file:///Users/x/Mein%20Buch.pdf" → "/Users/x/Mein Buch.pdf"
//   "file:///C:/Daten/buch.pdf"       → "C:/Daten/buch.pdf"   (Windows)
export function dateipfadAusUrl(url) {
  if (!url || !/^file:\/\//i.test(url)) return null
  try {
    const u = new URL(url)
    let pfad = decodeURIComponent(u.pathname)
    // Windows-Laufwerkspfade kommen als "/C:/..." an → führenden Slash entfernen.
    if (/^\/[A-Za-z]:\//.test(pfad)) pfad = pfad.slice(1)
    return pfad
  } catch (e) {
    return null
  }
}

// Extrahiert aus einem Seitennamen / Linktext einen PDF-Dateinamen.
// Logseq zeigt vor `[[…]]`-Referenzen oft ein Icon/Emoji; dieses (und sonstige
// führende Nicht-Wort-Zeichen samt Leerzeichen) wird entfernt. Leerzeichen
// INNERHALB des Dateinamens bleiben erhalten.
// Gibt `null` zurück, wenn kein ".pdf" am Ende steht.
//
// Beispiele:
//   "📚 VL-01-WKP-handout.pdf" → "VL-01-WKP-handout.pdf"
//   "Mein Skript.pdf"          → "Mein Skript.pdf"
export function pdfDateinameAusText(text) {
  if (!text) return null
  const treffer = String(text).match(/(\S[^\n]*?\.pdf)\s*$/i)
  if (!treffer) return null
  const name = treffer[1].trim().replace(/^[^\p{L}\p{N}]+/u, '')
  return name || null
}
