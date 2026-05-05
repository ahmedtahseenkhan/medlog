/**
 * AI radiology interpretation service.
 *
 * Primary: Infermedica Radiology API (chest X-ray, CT)
 * Fallback: Claude Vision — Claude's multimodal capability to describe
 *           radiological findings when no specialist CV model is configured.
 *
 * Configure RADIOLOGY_AI_PROVIDER='infermedica' | 'claude' (default: 'claude')
 */
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RadiologyFinding {
  label: string
  confidence: number         // 0–1
  boundingBox?: {            // normalised 0–1 coordinates
    x: number; y: number; width: number; height: number
  }
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
}

export interface RadiologyInterpretation {
  modality: string
  bodyPart: string
  findings: RadiologyFinding[]
  impression: string          // overall narrative
  urgency: 'routine' | 'urgent' | 'emergent'
  provider: 'claude' | 'infermedica'
  disclaimer: string
}

const DISCLAIMER =
  'AI-generated interpretation is for preliminary screening only. All findings must be verified by a qualified radiologist before clinical action is taken.'

// ── Infermedica adapter ───────────────────────────────────────────────────────

async function interpretWithInfermedica(imageUrl: string, modality: string): Promise<RadiologyInterpretation> {
  const apiKey = process.env.INFERMEDICA_API_KEY
  const appId = process.env.INFERMEDICA_APP_ID
  if (!apiKey || !appId) throw new Error('Infermedica credentials not configured')

  const res = await fetch('https://api.infermedica.com/v3/radiology/image', {
    method: 'POST',
    headers: {
      'App-Id': appId,
      'App-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_url: imageUrl, modality: modality.toLowerCase() }),
  })

  if (!res.ok) throw new Error(`Infermedica error: ${res.status}`)
  const data = await res.json() as {
    findings: { label: string; probability: number; bounding_box?: { x: number; y: number; w: number; h: number } }[]
    impression: string
    urgency: string
  }

  return {
    modality,
    bodyPart: 'Chest',
    findings: data.findings.map((f) => ({
      label: f.label,
      confidence: f.probability,
      boundingBox: f.bounding_box ? { x: f.bounding_box.x, y: f.bounding_box.y, width: f.bounding_box.w, height: f.bounding_box.h } : undefined,
      severity: f.probability > 0.8 ? 'severe' : f.probability > 0.5 ? 'moderate' : 'mild',
    })),
    impression: data.impression,
    urgency: data.urgency as RadiologyInterpretation['urgency'],
    provider: 'infermedica',
    disclaimer: DISCLAIMER,
  }
}

// ── Claude Vision adapter ─────────────────────────────────────────────────────

async function interpretWithClaude(imageUrl: string, modality: string, bodyPart: string): Promise<RadiologyInterpretation> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `You are assisting a clinician with preliminary review of a ${modality} image of the ${bodyPart}.
Describe the radiological findings in a structured way.
Respond ONLY with JSON:
{
  "findings": [
    { "label": "string", "confidence": 0.0-1.0, "severity": "normal|mild|moderate|severe" }
  ],
  "impression": "2-3 sentence summary",
  "urgency": "routine|urgent|emergent"
}
If the image is not a medical image, respond with { "findings": [], "impression": "Not a medical image", "urgency": "routine" }.`,
          },
        ],
      },
    ],
  })

  const raw = response.content.find((c) => c.type === 'text')?.text ?? '{}'
  const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: { findings: RadiologyFinding[]; impression: string; urgency: string }
  try {
    parsed = JSON.parse(json)
  } catch {
    parsed = { findings: [], impression: 'Could not parse AI response', urgency: 'routine' }
  }

  return {
    modality,
    bodyPart,
    findings: parsed.findings ?? [],
    impression: parsed.impression ?? '',
    urgency: (parsed.urgency as RadiologyInterpretation['urgency']) ?? 'routine',
    provider: 'claude',
    disclaimer: DISCLAIMER,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function interpretRadiologyImage(opts: {
  imageUrl: string
  modality: string
  bodyPart?: string
}): Promise<RadiologyInterpretation> {
  const provider = process.env.RADIOLOGY_AI_PROVIDER ?? 'claude'
  const bodyPart = opts.bodyPart ?? 'chest'

  if (provider === 'infermedica' && process.env.INFERMEDICA_API_KEY) {
    return interpretWithInfermedica(opts.imageUrl, opts.modality)
  }

  return interpretWithClaude(opts.imageUrl, opts.modality, bodyPart)
}
