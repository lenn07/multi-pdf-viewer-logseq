import { describe, it, expect } from 'vitest'
import { parseEdn, writeEdn } from './ednParser'

describe('parseEdn — Grundtypen', () => {
  it('parst String', () => expect(parseEdn('"hello"')).toBe('hello'))
  it('parst Integer', () => expect(parseEdn('42')).toBe(42))
  it('parst Float', () => expect(parseEdn('3.14')).toBeCloseTo(3.14))
  it('parst true/false', () => { expect(parseEdn('true')).toBe(true); expect(parseEdn('false')).toBe(false) })
  it('parst nil', () => expect(parseEdn('nil')).toBeNull())
  it('parst Keyword', () => expect(parseEdn(':farbe')).toBe('farbe'))
})

describe('parseEdn — Collections', () => {
  it('parst leere Map', () => expect(parseEdn('{}')).toEqual({}))
  it('parst Map mit String-Wert', () => expect(parseEdn('{:color "yellow"}')).toEqual({ color: 'yellow' }))
  it('parst Map mit Zahl', () => expect(parseEdn('{:page 32}')).toEqual({ page: 32 }))
  it('parst verschachtelte Map', () => expect(parseEdn('{:a {:b 1}}')).toEqual({ a: { b: 1 } }))
  it('parst EDN-Liste (runde Klammern)', () => expect(parseEdn('(1 2 3)')).toEqual({ _edn_list: true, values: [1, 2, 3] }))
  it('parst leere EDN-Liste', () => expect(parseEdn('()')).toEqual({ _edn_list: true, values: [] }))
  it('parst Vektor', () => expect(parseEdn('[1 2]')).toEqual([1, 2]))
  it('parst leeren Vektor', () => expect(parseEdn('[]')).toEqual([]))
})

describe('parseEdn — Tagged literals', () => {
  it('parst #uuid', () => expect(parseEdn('#uuid "abc-123"')).toEqual({ _edn_uuid: 'abc-123' }))
})

describe('parseEdn — Kommas als Whitespace', () => {
  it('ignoriert Kommas in Maps', () => expect(parseEdn('{:a 1, :b 2}')).toEqual({ a: 1, b: 2 }))
})

describe('parseEdn — vollständige EDN-Struktur', () => {
  it('parst echte Logseq-Highlight-Struktur', () => {
    const edn = `{:highlights [{:id #uuid "abc-123",
                                :page 3,
                                :position {:bounding {:x1 10.0 :y1 20.0 :x2 50.0 :y2 30.0
                                                      :width 500.0 :height 700.0},
                                           :rects ({:x1 10.0 :y1 20.0 :x2 50.0 :y2 30.0
                                                    :width 500.0 :height 700.0}),
                                           :page 3},
                                :content {:text "test text"},
                                :properties {:color "yellow"}}],
                 :extra {:page 3}}`
    const result = parseEdn(edn)
    expect(result.highlights).toHaveLength(1)
    const h = result.highlights[0]
    expect(h.id).toEqual({ _edn_uuid: 'abc-123' })
    expect(h.page).toBe(3)
    expect(h.position.bounding.x1).toBe(10.0)
    expect(h.position.bounding.width).toBe(500.0)
    expect(h.position.rects).toEqual({ _edn_list: true, values: [{ x1: 10.0, y1: 20.0, x2: 50.0, y2: 30.0, width: 500.0, height: 700.0 }] })
    expect(h.content.text).toBe('test text')
    expect(h.properties.color).toBe('yellow')
    expect(result.extra.page).toBe(3)
  })
})

describe('writeEdn', () => {
  it('schreibt nil', () => expect(writeEdn(null)).toBe('nil'))
  it('schreibt undefined als nil', () => expect(writeEdn(undefined)).toBe('nil'))
  it('schreibt String', () => expect(writeEdn('hi')).toBe('"hi"'))
  it('schreibt String mit Anführungszeichen', () => expect(writeEdn('say "hi"')).toBe('"say \\"hi\\""'))
  it('schreibt Integer', () => expect(writeEdn(42)).toBe('42'))
  it('schreibt Float', () => expect(writeEdn(3.14)).toBe('3.14'))
  it('schreibt true/false', () => { expect(writeEdn(true)).toBe('true'); expect(writeEdn(false)).toBe('false') })
  it('schreibt #uuid', () => expect(writeEdn({ _edn_uuid: 'abc' })).toBe('#uuid "abc"'))
  it('schreibt EDN-Liste', () => expect(writeEdn({ _edn_list: true, values: [1, 2] })).toBe('(1 2)'))
  it('schreibt leere EDN-Liste', () => expect(writeEdn({ _edn_list: true, values: [] })).toBe('()'))
  it('schreibt Vektor', () => expect(writeEdn([1, 2])).toBe('[1 2]'))

  it('Round-Trip: parse → write → parse ergibt gleiches Ergebnis', () => {
    const original = '{:highlights [], :extra {:page 1}}'
    const parsed = parseEdn(original)
    const written = writeEdn(parsed)
    const reparsed = parseEdn(written)
    expect(reparsed).toEqual(parsed)
  })

  it('Round-Trip mit UUID und EDN-Liste', () => {
    const obj = {
      highlights: [
        {
          id: { _edn_uuid: 'test-uuid' },
          page: 5,
          position: {
            bounding: { x1: 10, y1: 20, x2: 50, y2: 30, width: 500, height: 700 },
            rects: { _edn_list: true, values: [{ x1: 10, y1: 20, x2: 50, y2: 30, width: 500, height: 700 }] },
            page: 5,
          },
          content: { text: 'hallo' },
          properties: { color: 'yellow' },
        },
      ],
      extra: { page: 5 },
    }
    const written = writeEdn(obj)
    const reparsed = parseEdn(written)
    expect(reparsed.highlights[0].id._edn_uuid).toBe('test-uuid')
    expect(reparsed.highlights[0].position.rects.values).toHaveLength(1)
  })
})
