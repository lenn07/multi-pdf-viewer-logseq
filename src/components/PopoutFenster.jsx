import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import PdfViewer from './PdfViewer'
import { popupRegistrieren, popupDeregistrieren } from '../rafProxy.js'

const stile = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  kopf: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderBottom: '1px solid var(--ls-border-color, #ccc)',
    flexShrink: 0,
    fontSize: '12px',
  },
  viewerBereich: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
}

function PopoutInhalt({ url, titel, onZurueck, ownerDocument }) {
  return (
    <div style={stile.wrapper}>
      <div style={stile.kopf}>
        <button onClick={onZurueck} title="Zurück in Logseq einlagern">
          ← Zurück in Logseq
        </button>
      </div>
      <div style={stile.viewerBereich}>
        <PdfViewer url={url} titel={titel} ownerDocument={ownerDocument} />
      </div>
    </div>
  )
}

function PopoutFenster({ url, titel, onZurueck }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const fenster = window.open('', '', 'width=900,height=700,resizable=yes')
    if (!fenster) {
      onZurueck()
      return
    }

    // Popup beim rAF-Proxy registrieren: wenn der Iframe hidden wird, leitet
    // der Proxy rAF-Aufrufe an dieses sichtbare Fenster um → PDF lädt weiter.
    popupRegistrieren(fenster)

    fenster.document.title = titel

    document.querySelectorAll('style').forEach((el) =>
      fenster.document.head.appendChild(el.cloneNode(true))
    )
    document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
      const link = fenster.document.createElement('link')
      link.rel = 'stylesheet'
      link.href = el.href
      fenster.document.head.appendChild(link)
    })

    if (document.body.classList.contains('dark')) {
      fenster.document.body.classList.add('dark')
    }
    fenster.document.body.style.cssText = `margin:0;overflow:hidden;${document.body.style.cssText}`

    const container = fenster.document.createElement('div')
    fenster.document.body.appendChild(container)
    rootRef.current = createRoot(container)

    let hatZurueckGerufen = false
    function zurueckRufen() {
      if (hatZurueckGerufen) return
      hatZurueckGerufen = true
      onZurueck()
    }

    rootRef.current.render(
      <PopoutInhalt
        url={url}
        titel={titel}
        ownerDocument={fenster.document}
        onZurueck={() => {
          zurueckRufen()
          fenster.close()
        }}
      />
    )

    fenster.addEventListener('beforeunload', zurueckRufen)

    return () => {
      fenster.removeEventListener('beforeunload', zurueckRufen)
      popupDeregistrieren(fenster)
      rootRef.current?.unmount()
      if (!fenster.closed) fenster.close()
    }
  }, [])

  return null
}

export default PopoutFenster
