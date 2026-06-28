import { describe, it, expect } from 'vitest'
import { destZuSeite, outlineLaden } from './pdfMeta'

// Minimales Fake-Dokument, das nur die von pdfMeta genutzten Methoden bereitstellt.
function fakeDoc({ destinations = {}, pageIndexByRef = new Map(), outline } = {}) {
  return {
    async getDestination(name) {
      return destinations[name] ?? null
    },
    async getPageIndex(ref) {
      if (pageIndexByRef.has(ref)) return pageIndexByRef.get(ref)
      throw new Error('unbekannte Ref')
    },
    async getOutline() {
      return outline
    },
  }
}

describe('destZuSeite', () => {
  it('löst ein explizites Array-Ziel über die Ref zur 1-basierten Seite auf', async () => {
    const ref = { num: 12, gen: 0 }
    const doc = fakeDoc({ pageIndexByRef: new Map([[ref, 4]]) })
    expect(await destZuSeite(doc, [ref, { name: 'XYZ' }])).toBe(5)
  })

  it('schlägt benannte Ziele erst nach und löst sie dann auf', async () => {
    const ref = { num: 7, gen: 0 }
    const doc = fakeDoc({
      destinations: { 'kap-2': [ref, { name: 'Fit' }] },
      pageIndexByRef: new Map([[ref, 9]]),
    })
    expect(await destZuSeite(doc, 'kap-2')).toBe(10)
  })

  it('akzeptiert ein direktes Seitenindex-Ziel ohne Ref-Lookup', async () => {
    const doc = fakeDoc()
    expect(await destZuSeite(doc, [3, { name: 'XYZ' }])).toBe(4)
  })

  it('liefert null für leere oder ungültige Ziele', async () => {
    const doc = fakeDoc()
    expect(await destZuSeite(doc, null)).toBeNull()
    expect(await destZuSeite(doc, [])).toBeNull()
    expect(await destZuSeite(doc, 'unbekannt')).toBeNull()
  })

  it('liefert null statt zu werfen, wenn die Ref nicht aufgelöst werden kann', async () => {
    const doc = fakeDoc({ pageIndexByRef: new Map() })
    expect(await destZuSeite(doc, [{ num: 99, gen: 0 }])).toBeNull()
  })
})

describe('outlineLaden', () => {
  it('liefert eine leere Liste, wenn kein Outline vorhanden ist', async () => {
    expect(await outlineLaden(fakeDoc({ outline: null }))).toEqual([])
  })

  it('baut den Baum rekursiv auf und löst Seitenziele auf', async () => {
    const refA = { num: 1, gen: 0 }
    const refB = { num: 2, gen: 0 }
    const doc = fakeDoc({
      pageIndexByRef: new Map([[refA, 0], [refB, 5]]),
      outline: [
        {
          title: 'Kapitel 1',
          dest: [refA],
          items: [{ title: 'Abschnitt 1.1', dest: [refB], items: [] }],
        },
        { title: 'Extern', url: 'https://example.com', items: [] },
        { title: 'Gruppe ohne Ziel', items: [] },
      ],
    })

    const baum = await outlineLaden(doc)
    expect(baum).toEqual([
      {
        titel: 'Kapitel 1',
        seite: 1,
        url: null,
        kinder: [{ titel: 'Abschnitt 1.1', seite: 6, url: null, kinder: [] }],
      },
      { titel: 'Extern', seite: null, url: 'https://example.com', kinder: [] },
      { titel: 'Gruppe ohne Ziel', seite: null, url: null, kinder: [] },
    ])
  })
})
