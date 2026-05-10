import { useState, useEffect, useCallback } from 'react'
import { useFileSystemAccess } from './useFileSystemAccess'

export function useAnnotations(pdfUrl) {
  const [annotations, setAnnotations] = useState([])
  const { ordnerVerbunden, ednLesen, ednSchreiben } = useFileSystemAccess()

  const neuladen = useCallback(async () => {
    if (!pdfUrl || !ordnerVerbunden) { setAnnotations([]); return }
    const daten = await ednLesen(pdfUrl)
    setAnnotations(daten?.highlights || [])
  }, [pdfUrl, ordnerVerbunden, ednLesen])

  useEffect(() => { neuladen() }, [neuladen])

  async function highlightHinzufuegen(ednHighlight) {
    if (!pdfUrl || !ordnerVerbunden) return
    const aktuell = (await ednLesen(pdfUrl)) || { highlights: [], extra: { page: ednHighlight.page } }
    const aktualisiert = {
      ...aktuell,
      highlights: [...(aktuell.highlights || []), ednHighlight],
    }
    await ednSchreiben(pdfUrl, aktualisiert)
    await neuladen()
  }

  // Entfernt das Highlight mit der passenden stamp aus der EDN. Liefert das
  // entfernte Highlight zurück (oder null), damit der Aufrufer Folgeschritte
  // wie PNG-Löschen anhand der Daten ausführen kann.
  async function highlightEntfernen(stamp) {
    if (!pdfUrl || !ordnerVerbunden || !stamp) return null
    const aktuell = await ednLesen(pdfUrl)
    if (!aktuell?.highlights?.length) return null
    const entfernt = aktuell.highlights.find((h) => h.id?._edn_uuid === stamp) || null
    if (!entfernt) return null
    const aktualisiert = {
      ...aktuell,
      highlights: aktuell.highlights.filter((h) => h.id?._edn_uuid !== stamp),
    }
    await ednSchreiben(pdfUrl, aktualisiert)
    await neuladen()
    return entfernt
  }

  return { annotations, neuladen, highlightHinzufuegen, highlightEntfernen }
}
