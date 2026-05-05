/**
 * Ingests drug interaction data from the OpenFDA drug label API.
 * Run as a cron job: node dist/jobs/ingestDrugInteractions.js
 *
 * OpenFDA returns free-text interaction warnings per drug label.
 * We parse these into structured drug-pair rows for fast lookups.
 *
 * For production, supplement with DrugBank or RxNorm for richer data.
 */
import { prisma } from '../db/client.js'

const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json'
const BATCH_SIZE = 100
const HIGH_SEVERITY_PATTERNS = [/contraindicated/i, /do not use/i, /must not/i, /fatal/i]
const MAJOR_PATTERNS = [/serious/i, /severe/i, /significant/i, /life.threaten/i]

interface OpenFdaLabel {
  openfda?: { generic_name?: string[]; brand_name?: string[] }
  drug_interactions?: string[]
}

interface OpenFdaResponse {
  results: OpenFdaLabel[]
  meta: { results: { total: number; skip: number; limit: number } }
}

async function fetchBatch(skip: number): Promise<OpenFdaResponse> {
  const url = `${OPENFDA_BASE}?limit=${BATCH_SIZE}&skip=${skip}&_fields=openfda.generic_name,openfda.brand_name,drug_interactions`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenFDA error: ${res.status}`)
  return res.json() as Promise<OpenFdaResponse>
}

function classifySeverity(text: string): 'contraindicated' | 'major' | 'moderate' | 'minor' {
  if (HIGH_SEVERITY_PATTERNS.some((p) => p.test(text))) return 'contraindicated'
  if (MAJOR_PATTERNS.some((p) => p.test(text))) return 'major'
  if (/caution|monitor|adjust/i.test(text)) return 'moderate'
  return 'minor'
}

function extractDrugPairs(label: OpenFdaLabel): { drug1: string; drug2: string; text: string }[] {
  const primaryNames = [
    ...(label.openfda?.generic_name ?? []),
    ...(label.openfda?.brand_name ?? []),
  ].map((n) => n.toLowerCase().trim())

  const pairs: { drug1: string; drug2: string; text: string }[] = []
  for (const interactionText of label.drug_interactions ?? []) {
    // Extract mentioned drug names via simple heuristic (capitalised words / known patterns)
    const mentionedDrugs = interactionText.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) ?? []
    for (const primary of primaryNames) {
      for (const mentioned of mentionedDrugs) {
        const norm = mentioned.toLowerCase()
        if (norm !== primary && norm.length > 3) {
          pairs.push({ drug1: primary, drug2: norm, text: interactionText.slice(0, 500) })
        }
      }
    }
  }
  return pairs
}

export async function ingestDrugInteractions(maxRecords = 1000) {
  let skip = 0
  let ingested = 0

  console.warn(`Starting OpenFDA drug interaction ingest (max ${maxRecords})…`)

  while (skip < maxRecords) {
    const batch = await fetchBatch(skip)
    if (!batch.results.length) break

    for (const label of batch.results) {
      const pairs = extractDrugPairs(label)
      for (const pair of pairs) {
        const severity = classifySeverity(pair.text)
        const [d1, d2] = [pair.drug1, pair.drug2].sort() // canonical order
        try {
          await prisma.drugInteraction.upsert({
            where: { drug1_drug2: { drug1: d1, drug2: d2 } },
            update: { severity, description: pair.text },
            create: { drug1: d1, drug2: d2, severity, description: pair.text },
          })
          ingested++
        } catch {
          // Ignore duplicate / constraint errors
        }
      }
    }

    skip += BATCH_SIZE
    console.warn(`Processed ${skip} labels, ${ingested} interactions stored`)
    await new Promise((r) => setTimeout(r, 300)) // gentle rate limit
  }

  console.warn(`Ingest complete: ${ingested} drug interactions`)
  await prisma.$disconnect()
}

// Run directly
ingestDrugInteractions(2000).catch((e) => { console.error(e); process.exit(1) })
