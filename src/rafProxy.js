// Patch für requestAnimationFrame: leitet rAF-Aufrufe an ein sichtbares Popup-Fenster um,
// wenn der Logseq-Iframe hidden ist (Logseq minimiert/im Hintergrund).
//
// Warum: PDF.js nutzt rAF intern fürs Rendern. Electron drosselt rAF in hidden-Frames.
// Das Popup-Fenster ist sichtbar → sein rAF-Task läuft normal, auch wenn der Iframe hidden ist.
// Indem wir rAF-Aufrufe an popup.requestAnimationFrame umleiten, laufen die Callbacks
// im Task-Queue des sichtbaren Popups, nicht im gedrosselten Task-Queue des Iframes.

const origRaf = window.requestAnimationFrame.bind(window)
const origCancel = window.cancelAnimationFrame.bind(window)

const popupFenster = new Set()
const syntheticIds = new Map() // synthetische ID → { popup, realId }
let naechsteId = 0x7fff0000

window.requestAnimationFrame = function (cb) {
  if (document.hidden) {
    for (const popup of popupFenster) {
      if (!popup.closed) {
        const id = ++naechsteId
        const realId = popup.requestAnimationFrame(cb)
        syntheticIds.set(id, { popup, realId })
        return id
      }
    }
  }
  return origRaf(cb)
}

window.cancelAnimationFrame = function (id) {
  const info = syntheticIds.get(id)
  if (info) {
    syntheticIds.delete(id)
    if (!info.popup.closed) info.popup.cancelAnimationFrame(info.realId)
  } else {
    origCancel(id)
  }
}

export function popupRegistrieren(fenster) {
  popupFenster.add(fenster)
}

export function popupDeregistrieren(fenster) {
  popupFenster.delete(fenster)
}
