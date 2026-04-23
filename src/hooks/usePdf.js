import { useState, useEffect, useRef } from 'react'

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

// scale = 1.0 entspricht der Original-Größe der PDF (72 DPI).
// Höhere Werte vergrößern (1.5 = 150%), niedrigere verkleinern (0.5 = 50%).
export function usePdf(url, scale = 1.5) {
  const canvasRef = useRef(null)
  const [pdfDokument, setPdfDokument] = useState(null)
  const [seitenanzahl, setSeitenanzahl] = useState(0)
  const [aktuelleSeite, setAktuelleSeite] = useState(1)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState(null)

  useEffect(() => {
    if (!url) return

    setLaden(true)
    setFehler(null)
    setPdfDokument(null)
    setAktuelleSeite(1)

    let ladeAufgabe = null
    let abgebrochen = false

    // getPdfjsLib() lädt PDF.js beim ersten Aufruf, danach gibt es den Cache zurück
    getPdfjsLib().then((lib) => {
      if (abgebrochen) return
      ladeAufgabe = lib.getDocument(url)
      return ladeAufgabe.promise
    }).then((doc) => {
      if (abgebrochen) return
      setPdfDokument(doc)
      setSeitenanzahl(doc.numPages)
      setLaden(false)
    }).catch((err) => {
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

  useEffect(() => {
    if (!pdfDokument || !canvasRef.current) return

    let abgebrochen = false

    pdfDokument.getPage(aktuelleSeite).then((seite) => {
      if (abgebrochen || !canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      // ctx kann null sein wenn der Browser Canvas-Rendering blockiert
      if (!ctx) {
        setFehler('Canvas-Kontext nicht verfügbar.')
        return
      }

      const viewport = seite.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height

      return seite.render({ canvasContext: ctx, viewport }).promise
    }).catch((err) => {
      if (!abgebrochen) {
        console.error('PDF Render Fehler:', err)
        setFehler('Seite konnte nicht gerendert werden: ' + err.message)
      }
    })

    return () => { abgebrochen = true }
  }, [pdfDokument, aktuelleSeite, scale])

  function vorherige() {
    setAktuelleSeite((s) => Math.max(1, s - 1))
  }

  function naechste() {
    setAktuelleSeite((s) => Math.min(seitenanzahl, s + 1))
  }

  return { canvasRef, seitenanzahl, aktuelleSeite, vorherige, naechste, laden, fehler }
}
