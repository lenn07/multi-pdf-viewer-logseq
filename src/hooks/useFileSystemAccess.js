import { useState, useEffect } from 'react'
import { parseEdn, writeEdn } from '../utils/ednParser'

// Modul-Singleton: alle Hook-Instanzen teilen denselben Handle.
let globalHandle = null
const listeners = new Set()

// Globaler File-Op-Queue: Chrome serialisiert File-System-Access-Operationen
// pro Handle intern. Wenn eine Op je hängt, blockieren alle nachfolgenden.
// Mit Timeout pro Op verhindern wir, dass ein Hänger den ganzen Plugin-State killt.
let opQueue = Promise.resolve()
const OP_TIMEOUT_MS = 10000

function queueOp(label, fn) {
  const result = opQueue.then(async () => {
    let timer
    const timeout = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error(`fs-queue timeout: ${label}`)), OP_TIMEOUT_MS)
    })
    try {
      return await Promise.race([fn(), timeout])
    } catch (e) {
      console.error(`[fs-queue] FAIL: ${label}`, e.message)
      throw e
    } finally {
      clearTimeout(timer)
    }
  })
  // Fehler/Timeouts dürfen den Queue nicht blockieren — wir resetten ihn.
  opQueue = result.catch(() => {})
  return result
}

function notifyListeners(handle) {
  globalHandle = handle
  for (const fn of listeners) fn(handle)
}

// IndexedDB-Helpers
function idbOeffnen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('multiPdfViewer', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('handles')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function handleSpeichern(handle) {
  const db = await idbOeffnen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(handle, 'assetsOrdner')
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

async function handleLaden() {
  try {
    const db = await idbOeffnen()
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const req = tx.objectStore('handles').get('assetsOrdner')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    if (!handle) return null
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return handle
    const angefragt = await handle.requestPermission({ mode: 'readwrite' })
    return angefragt === 'granted' ? handle : null
  } catch (_) {
    return null
  }
}

function ednDateinameAusPdfUrl(pdfUrl) {
  const ohneQuery = pdfUrl.split('?')[0].split('#')[0]
  const dateiname = decodeURIComponent(ohneQuery.split('/').pop())
  return dateiname.replace(/\.pdf$/i, '') + '.edn'
}

export function useFileSystemAccess() {
  const [ordnerHandle, setOrdnerHandle] = useState(() => globalHandle)

  useEffect(() => {
    const fn = (h) => setOrdnerHandle(h)
    listeners.add(fn)

    // Handle aus IDB laden falls noch nicht geschehen
    if (!globalHandle) {
      handleLaden().then((h) => { if (h) notifyListeners(h) })
    }

    return () => listeners.delete(fn)
  }, [])

  async function ordnerVerbinden() {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    await handleSpeichern(handle)
    notifyListeners(handle)
  }

  async function ednLesen(pdfUrl) {
    const handle = ordnerHandle
    if (!handle) return null
    const dateiname = ednDateinameAusPdfUrl(pdfUrl)
    return queueOp(`ednLesen ${dateiname}`, async () => {
      try {
        const dateiHandle = await handle.getFileHandle(dateiname)
        const datei = await dateiHandle.getFile()
        const text = await datei.text()
        return parseEdn(text)
      } catch (e) {
        if (e.name === 'NotFoundError') return { highlights: [], extra: { page: 1 } }
        console.error('[MultiPdfViewer] EDN lesen fehlgeschlagen:', e.message)
        return { highlights: [], extra: { page: 1 } }
      }
    })
  }

  async function ednSchreiben(pdfUrl, daten) {
    const handle = ordnerHandle
    if (!handle) return
    const dateiname = ednDateinameAusPdfUrl(pdfUrl)
    return queueOp(`ednSchreiben ${dateiname}`, async () => {
      const dateiHandle = await handle.getFileHandle(dateiname, { create: true })
      const writable = await dateiHandle.createWritable()
      await writable.write(writeEdn(daten))
      await writable.close()
    })
  }

  // Schreibt ein Bild (Blob) als PNG in einen Unterordner des verbundenen Ordners.
  // Logseq-Konvention: <assets>/<seitenname>/<page>_<block-uuid>_<stamp>.png
  async function pngSchreiben(unterordner, dateiname, blob) {
    const handle = ordnerHandle
    if (!handle) { console.warn('[MultiPdfViewer] pngSchreiben: kein Handle, Abbruch'); return }
    return queueOp(`pngSchreiben ${unterordner}/${dateiname}`, async () => {
      const dirHandle = await handle.getDirectoryHandle(unterordner, { create: true })
      const dateiHandle = await dirHandle.getFileHandle(dateiname, { create: true })
      const writable = await dateiHandle.createWritable()
      await writable.write(blob)
      await writable.close()
    })
  }

  // Löscht eine PNG-Datei aus einem Unterordner. Wirft NICHT, wenn die Datei
  // nicht existiert — beim Highlight-Löschen ist das ein erwarteter Fall
  // (Text-Highlights haben kein PNG, oder es wurde manuell entfernt).
  async function pngLoeschen(unterordner, dateiname) {
    const handle = ordnerHandle
    if (!handle) return
    return queueOp(`pngLoeschen ${unterordner}/${dateiname}`, async () => {
      try {
        const dirHandle = await handle.getDirectoryHandle(unterordner)
        await dirHandle.removeEntry(dateiname)
      } catch (e) {
        if (e.name !== 'NotFoundError') {
          console.error('[MultiPdfViewer] pngLoeschen fehlgeschlagen:', e.message)
        }
      }
    })
  }

  return {
    ordnerVerbunden: ordnerHandle !== null,
    ordnerVerbinden,
    ednLesen,
    ednSchreiben,
    pngSchreiben,
    pngLoeschen,
  }
}
