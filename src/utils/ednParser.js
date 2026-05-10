// Tokenizer
function tokenize(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]

    // Whitespace + Kommas
    if (/[\s,]/.test(ch)) { i++; continue }

    // Zeilenkommentar
    if (ch === ';') { while (i < text.length && text[i] !== '\n') i++; continue }

    // String
    if (ch === '"') {
      let j = i + 1
      let escaped = ''
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') { escaped += text[j + 1]; j += 2 }
        else { escaped += text[j]; j++ }
      }
      tokens.push({ type: 'string', value: escaped })
      i = j + 1
      continue
    }

    // Strukturzeichen
    if ('{}()[]'.includes(ch)) { tokens.push({ type: ch }); i++; continue }

    // Tagged literal: #uuid
    if (ch === '#') {
      let j = i + 1
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j++
      tokens.push({ type: 'tag', value: text.slice(i + 1, j) })
      i = j
      continue
    }

    // Keyword: :name
    if (ch === ':') {
      let j = i + 1
      while (j < text.length && /[a-zA-Z0-9_?!.\-/]/.test(text[j])) j++
      tokens.push({ type: 'keyword', value: text.slice(i + 1, j) })
      i = j
      continue
    }

    // Zahl (auch negativ, auch float)
    if (/\d/.test(ch) || (ch === '-' && i + 1 < text.length && /\d/.test(text[i + 1]))) {
      let j = i + 1
      while (j < text.length && /[\d.]/.test(text[j])) j++
      tokens.push({ type: 'number', value: parseFloat(text.slice(i, j)) })
      i = j
      continue
    }

    // Symbole: true, false, nil, sonstige
    if (/[a-zA-Z_?!]/.test(ch)) {
      let j = i
      while (j < text.length && /[a-zA-Z0-9_?!\-]/.test(text[j])) j++
      const sym = text.slice(i, j)
      if (sym === 'true') tokens.push({ type: 'boolean', value: true })
      else if (sym === 'false') tokens.push({ type: 'boolean', value: false })
      else if (sym === 'nil') tokens.push({ type: 'nil' })
      else tokens.push({ type: 'symbol', value: sym })
      i = j
      continue
    }

    i++ // unbekanntes Zeichen überspringen
  }
  return tokens
}

function parseAt(tokens, pos) {
  if (pos >= tokens.length) return [null, pos]
  const tok = tokens[pos]

  if (tok.type === 'string')  return [tok.value, pos + 1]
  if (tok.type === 'number')  return [tok.value, pos + 1]
  if (tok.type === 'boolean') return [tok.value, pos + 1]
  if (tok.type === 'nil')     return [null, pos + 1]
  if (tok.type === 'keyword') return [tok.value, pos + 1]
  if (tok.type === 'symbol')  return [tok.value, pos + 1]

  if (tok.type === 'tag') {
    const [val, next] = parseAt(tokens, pos + 1)
    if (tok.value === 'uuid') return [{ _edn_uuid: val }, next]
    return [val, next]
  }

  if (tok.type === '{') {
    const map = {}
    let i = pos + 1
    while (i < tokens.length && tokens[i].type !== '}') {
      const [key, afterKey] = parseAt(tokens, i)
      const [val, afterVal] = parseAt(tokens, afterKey)
      map[String(key)] = val
      i = afterVal
    }
    return [map, i + 1]
  }

  if (tok.type === '(') {
    const values = []
    let i = pos + 1
    while (i < tokens.length && tokens[i].type !== ')') {
      const [val, next] = parseAt(tokens, i)
      values.push(val)
      i = next
    }
    return [{ _edn_list: true, values }, i + 1]
  }

  if (tok.type === '[') {
    const arr = []
    let i = pos + 1
    while (i < tokens.length && tokens[i].type !== ']') {
      const [val, next] = parseAt(tokens, i)
      arr.push(val)
      i = next
    }
    return [arr, i + 1]
  }

  return [null, pos + 1]
}

export function parseEdn(text) {
  const tokens = tokenize(text.trim())
  const [value] = parseAt(tokens, 0)
  return value
}

export function writeEdn(value) {
  if (value === null || value === undefined) return 'nil'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number')  return String(value)
  if (typeof value === 'string')  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

  if (Array.isArray(value)) {
    return '[' + value.map(writeEdn).join(' ') + ']'
  }

  if (typeof value === 'object') {
    if (value._edn_uuid !== undefined) return `#uuid "${value._edn_uuid}"`
    if (value._edn_list)               return '(' + (value.values || []).map(writeEdn).join(' ') + ')'

    const pairs = Object.entries(value)
      .map(([k, v]) => `:${k} ${writeEdn(v)}`)
    return '{' + pairs.join(', ') + '}'
  }

  return 'nil'
}
