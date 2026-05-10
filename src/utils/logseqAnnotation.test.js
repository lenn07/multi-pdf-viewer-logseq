import { describe, it, expect } from 'vitest'
import { buildAnnotationBlock, parseAnnotationBlock, HIGHLIGHT_COLORS } from './logseqAnnotation'

describe('buildAnnotationBlock', () => {
  it('Text-Annotation: content = Text', () => {
    const result = buildAnnotationBlock({
      type: 'text',
      text: 'Hallo Welt',
      page: 3,
      stamp: 'uuid-123',
      color: 'yellow',
    })
    expect(result.content).toBe('Hallo Welt')
    expect(result.properties['ls-type']).toBe('annotation')
    expect(result.properties['hl-type']).toBe('text')
    expect(result.properties['hl-page']).toBe(3)
    expect(result.properties['hl-stamp']).toBe('uuid-123')
    expect(result.properties['hl-color']).toBe('yellow')
    expect(result.properties['hl-value']).toBeUndefined()
  })

  it('Bereichs-Annotation: content = leer', () => {
    const result = buildAnnotationBlock({
      type: 'area',
      text: '',
      page: 5,
      stamp: 'uuid-456',
      color: 'red',
    })
    expect(result.content).toBe('')
    expect(result.properties['hl-type']).toBe('area')
    expect(result.properties['hl-value']).toBeUndefined()
  })
})

describe('parseAnnotationBlock', () => {
  it('erkennt Annotation-Block', () => {
    const block = {
      uuid: 'block-abc',
      content: 'markierter Text',
      properties: {
        'ls-type': 'annotation',
        'hl-type': 'text',
        'hl-page': 5,
        'hl-stamp': 'uuid-789',
        'hl-color': 'green',
      },
    }
    const result = parseAnnotationBlock(block)
    expect(result).not.toBeNull()
    expect(result.type).toBe('text')
    expect(result.page).toBe(5)
    expect(result.stamp).toBe('uuid-789')
    expect(result.color).toBe('green')
  })

  it('gibt null zurück wenn ls-type nicht annotation', () => {
    expect(parseAnnotationBlock({ uuid: 'x', content: '', properties: { 'ls-type': 'other' } })).toBeNull()
  })

  it('gibt null zurück wenn properties fehlen', () => {
    expect(parseAnnotationBlock({ uuid: 'y', content: '', properties: null })).toBeNull()
    expect(parseAnnotationBlock({ uuid: 'z', content: '', properties: {} })).toBeNull()
  })

  it('wandelt hl-page in Number um', () => {
    const block = {
      uuid: 'x',
      content: '',
      properties: { 'ls-type': 'annotation', 'hl-type': 'text', 'hl-page': '7', 'hl-stamp': 'abc', 'hl-color': 'yellow' },
    }
    expect(parseAnnotationBlock(block).page).toBe(7)
  })
})

describe('HIGHLIGHT_COLORS', () => {
  it('enthält 5 Farben', () => {
    expect(Object.keys(HIGHLIGHT_COLORS)).toEqual(['yellow', 'red', 'green', 'blue', 'purple'])
  })
  it('alle Werte sind RGBA-Strings', () => {
    for (const v of Object.values(HIGHLIGHT_COLORS)) {
      expect(v).toMatch(/^rgba/)
    }
  })
})
