/**
 * Minimal HL7 v2.x message parser.
 * Handles ADT (admission/discharge/transfer) and ORU (lab results) message types.
 *
 * HL7 v2 wire format: segments separated by \r, fields by |, components by ^
 */

export interface Hl7Segment {
  name: string
  fields: string[]
}

export interface ParsedHl7 {
  type: string       // e.g. 'ADT^A01', 'ORU^R01'
  segments: Map<string, Hl7Segment[]>
  raw: string
}

export function parseHl7(raw: string): ParsedHl7 {
  const lines = raw.replace(/\r\n|\n/g, '\r').split('\r').filter(Boolean)
  const segments = new Map<string, Hl7Segment[]>()

  for (const line of lines) {
    const fields = line.split('|')
    const name = fields[0]
    const seg: Hl7Segment = { name, fields }
    if (!segments.has(name)) segments.set(name, [])
    segments.get(name)!.push(seg)
  }

  const msh = segments.get('MSH')?.[0]
  const msgType = msh?.fields[8] ?? ''

  return { type: msgType, segments, raw }
}

/** Extract a component from a field (^ separated) */
export function component(field: string, idx: number): string {
  return field.split('^')[idx] ?? ''
}

/** Extract a sub-component from a component (& separated) */
export function sub(field: string, compIdx: number, subIdx: number): string {
  return component(field, compIdx).split('&')[subIdx] ?? ''
}
