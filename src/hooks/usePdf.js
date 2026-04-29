import { useState, useEffect } from 'react'

// Legacy-Build: kompatibel mit älterem Chromium in Logseqs Electron.
// Vermeidet den Fehler "getOrInsertComputed is not a function".
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// pdfjsLib wird NICHT beim Start geladen (kein statischer import).
// Stattdessen laden wir es nur wenn wirklich eine PDF gerendert werden soll.
// Das hält den initialen Bundle klein und logseq.ready() wird sofort aufgerufen.
let pdfjsLib = null
async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  }
  return pdfjsLib
}

// Lädt das PDF-Dokument und liefert es zusammen mit der Größe der ersten Seite zurück.
// Das eigentliche Rendern der einzelnen Seiten passiert in PdfPage.jsx — pro Seite ein Canvas.
//
// Rückgabe:
//   - pdfDokument: das geladene PDF.js-Document (oder null)
//   - seitenanzahl: Anzahl Seiten
//   - defaultViewport: { width, height } der ersten Seite bei scale=1 — für Platzhalter-Höhen
//   - laden: true während das PDF geladen wird
//   - fehler: Fehlermeldung oder null
export function usePdf(url) {
  const [pdfDokument, setPdfDokument] = useState(null)
  const [seitenanzahl, setSeitenanzahl] = useState(0)
  const [defaultViewport, setDefaultViewport] = useState(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState(null)

  useEffect(() => {
    if (!url) return

    setLaden(true)
    setFehler(null)
    setPdfDokument(null)
    setDefaultViewport(null)
    setSeitenanzahl(0)

    let ladeAufgabe = null
    let abgebrochen = false

    getPdfjsLib()
      .then((lib) => {
        if (abgebrochen) return
        ladeAufgabe = lib.getDocument(url)
        return ladeAufgabe.promise
      })
      .then(async (doc) => {
        if (abgebrochen || !doc) return
        // Erste Seite holen, damit wir die Default-Größe (für Platzhalter) kennen.
        const seite1 = await doc.getPage(1)
        if (abgebrochen) return
        const vp = seite1.getViewport({ scale: 1 })
        setDefaultViewport({ width: vp.width, height: vp.height })
        setSeitenanzahl(doc.numPages)
        setPdfDokument(doc)
        setLaden(false)
      })
      .catch((err) => {
        if (!abgebrochen && err.name !== 'AbortException') {
          setFehler('PDF konnte nicht geladen werden: ' + err.message)
          setLaden(false)
        }
      })

    return () => {
      abgebrochen = true
      ladeAufgabe?.destroy()
    }
  }, [url])

  return { pdfDokument, seitenanzahl, defaultViewport, laden, fehler }
}
