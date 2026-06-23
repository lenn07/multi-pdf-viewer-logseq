import { describe, it, expect } from 'vitest'
import { dateipfadAusUrl, pdfDateinameAusText } from './dateipfad.js'

describe('dateipfadAusUrl', () => {
  it('wandelt eine einfache file://-URL in einen Pfad um', () => {
    expect(dateipfadAusUrl('file:///Users/x/buch.pdf')).toBe('/Users/x/buch.pdf')
  })

  it('dekodiert URL-kodierte Zeichen (Leerzeichen, Umlaute)', () => {
    expect(dateipfadAusUrl('file:///Users/x/Mein%20B%C3%BCch.pdf')).toBe('/Users/x/Mein Büch.pdf')
  })

  it('entfernt den führenden Slash bei Windows-Laufwerkspfaden', () => {
    expect(dateipfadAusUrl('file:///C:/Daten/buch.pdf')).toBe('C:/Daten/buch.pdf')
  })

  it('gibt null für nicht-file-URLs zurück', () => {
    expect(dateipfadAusUrl('https://example.com/buch.pdf')).toBeNull()
    expect(dateipfadAusUrl('../assets/buch.pdf')).toBeNull()
    expect(dateipfadAusUrl('')).toBeNull()
    expect(dateipfadAusUrl(null)).toBeNull()
  })
})

describe('pdfDateinameAusText', () => {
  it('entfernt ein führendes Emoji-Icon vor dem Dateinamen', () => {
    expect(pdfDateinameAusText('📚 VL-01-WKP-handout.pdf')).toBe('VL-01-WKP-handout.pdf')
  })

  it('behält Leerzeichen innerhalb des Dateinamens', () => {
    expect(pdfDateinameAusText('Mein Skript.pdf')).toBe('Mein Skript.pdf')
    expect(pdfDateinameAusText('📄 Mein Skript.pdf')).toBe('Mein Skript.pdf')
  })

  it('akzeptiert auch einen reinen Dateinamen ohne Icon', () => {
    expect(pdfDateinameAusText('buch.pdf')).toBe('buch.pdf')
  })

  it('gibt null zurück, wenn kein .pdf vorhanden ist', () => {
    expect(pdfDateinameAusText('Eine normale Seite')).toBeNull()
    expect(pdfDateinameAusText('')).toBeNull()
    expect(pdfDateinameAusText(null)).toBeNull()
  })
})
