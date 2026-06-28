// Öffnet einen externen Link (z.B. aus einer PDF-Link-Annotation oder einem
// Outline-Eintrag). In Logseq (Electron) bevorzugt die offizielle API, die den
// Link im System-Browser öffnet statt im Plugin-iframe zu navigieren. Im
// Dev-Browser (kein Logseq) fällt es auf window.open zurück.
export function externenLinkOeffnen(url) {
  if (!url) return
  try {
    if (typeof logseq !== 'undefined' && logseq?.App?.openExternalLink) {
      logseq.App.openExternalLink(url)
      return
    }
  } catch (e) {}
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {}
}
