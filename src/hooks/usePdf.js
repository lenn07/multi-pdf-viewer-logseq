import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// ?url weist Vite an, den Worker als fertige URL zu liefern (kein Bundling).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export function usePdf(url) {
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

    const ladeAufgabe = pdfjsLib.getDocument(url)

    ladeAufgabe.promise
      .then((doc) => {
        setPdfDokument(doc)
        setSeitenanzahl(doc.numPages)
        setLaden(false)
      })
      .catch((err) => {
        if (err.name !== 'AbortException') {
          setFehler('PDF konnte nicht geladen werden: ' + err.message)
          setLaden(false)
        }
      })

    // Wenn die URL wechselt bevor die PDF fertig geladen ist: alten Ladevorgang abbrechen
    return () => ladeAufgabe.destroy()
  }, [url])

  useEffect(() => {
    if (!pdfDokument || !canvasRef.current) return

    let abgebrochen = false

    pdfDokument.getPage(aktuelleSeite).then((seite) => {
      if (abgebrochen || !canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const viewport = seite.getViewport({ scale: 1.5 })

      canvas.width = viewport.width
      canvas.height = viewport.height

      return seite.render({ canvasContext: ctx, viewport }).promise
    })

    return () => { abgebrochen = true }
  }, [pdfDokument, aktuelleSeite])

  function vorherige() {
    setAktuelleSeite((s) => Math.max(1, s - 1))
  }

  function naechste() {
    setAktuelleSeite((s) => Math.min(seitenanzahl, s + 1))
  }

  return { canvasRef, seitenanzahl, aktuelleSeite, vorherige, naechste, laden, fehler }
}
