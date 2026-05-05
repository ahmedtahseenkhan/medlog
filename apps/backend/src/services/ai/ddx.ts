import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DdxInput {
  symptoms: string[]
  examination: string
  labs: { testName: string; value: string; unit: string; isAbnormal: boolean }[]
  history: string
  age?: number
  sex?: 'M' | 'F' | 'Other'
}

export interface Differential {
  diagnosis: string
  likelihood: 'High' | 'Moderate' | 'Low'
  supportingFindings: string[]
  againstFindings: string[]
  rationale: string
}

export interface ManagementStep {
  category: 'Investigation' | 'Treatment' | 'Monitoring' | 'Referral' | 'Follow-up'
  action: string
  urgency: 'Immediate' | 'Urgent' | 'Routine'
}

export interface DdxResult {
  differentials: Differential[]
  managementPlan: ManagementStep[]
  redFlags: string[]
  modelVersion: string
}

const SYSTEM_PROMPT = `You are a clinical decision-support assistant embedded in MedLog AI, used by doctors in training.
Your role is to suggest differential diagnoses and management steps based on structured clinical data.

IMPORTANT RULES:
1. Never replace clinical judgement — always frame suggestions as possibilities to consider, not definitive diagnoses.
2. Surface red flags explicitly and prominently.
3. Be concise and structured. Avoid verbose prose.
4. Do not ask for more information — work with what you are given.
5. Respond ONLY with valid JSON matching the schema exactly.`

const USER_TEMPLATE = (input: DdxInput) => `
Patient: ${input.age ?? 'Unknown age'} ${input.sex ?? ''}
Symptoms: ${input.symptoms.join(', ') || 'None provided'}
Examination: ${input.examination || 'Not documented'}
History: ${input.history || 'Not documented'}
Labs:
${input.labs.length ? input.labs.map((l) => `  - ${l.testName}: ${l.value} ${l.unit}${l.isAbnormal ? ' [ABNORMAL]' : ''}`).join('\n') : '  None'}

Respond with JSON only:
{
  "differentials": [
    {
      "diagnosis": "string",
      "likelihood": "High|Moderate|Low",
      "supportingFindings": ["string"],
      "againstFindings": ["string"],
      "rationale": "string (2-3 sentences max)"
    }
  ],
  "managementPlan": [
    {
      "category": "Investigation|Treatment|Monitoring|Referral|Follow-up",
      "action": "string",
      "urgency": "Immediate|Urgent|Routine"
    }
  ],
  "redFlags": ["string"]
}
List 3–6 differentials ordered by likelihood. Management plan: 4–8 steps.
`.trim()

export async function generateDifferentials(input: DdxInput): Promise<DdxResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_TEMPLATE(input) }],
  })

  const raw = message.content.find((c) => c.type === 'text')?.text ?? '{}'

  // Strip markdown code fences if present
  const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: Omit<DdxResult, 'modelVersion'>
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`)
  }

  return {
    differentials: parsed.differentials ?? [],
    managementPlan: parsed.managementPlan ?? [],
    redFlags: parsed.redFlags ?? [],
    modelVersion: message.model,
  }
}
