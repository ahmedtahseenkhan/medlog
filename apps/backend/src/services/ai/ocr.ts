import {
  TextractClient,
  AnalyzeDocumentCommand,
  type Block,
} from '@aws-sdk/client-textract'

const textract = new TextractClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

export interface OcrField {
  key: string
  value: string
  confidence: number // 0–100
}

export interface OcrResult {
  rawText: string
  fields: OcrField[]
  overallConfidence: number
  needsReview: boolean // true when any field < REVIEW_THRESHOLD
}

const REVIEW_THRESHOLD = 80 // percent

/**
 * Analyses a document image already in S3 using AWS Textract.
 * Returns structured key-value pairs + raw text.
 */
export async function analyseDocument(s3Bucket: string, s3Key: string): Promise<OcrResult> {
  const command = new AnalyzeDocumentCommand({
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    FeatureTypes: ['FORMS', 'TABLES'],
  })

  const response = await textract.send(command)
  const blocks: Block[] = response.Blocks ?? []

  // Extract raw text from LINE blocks
  const rawText = blocks
    .filter((b) => b.BlockType === 'LINE')
    .map((b) => b.Text ?? '')
    .join('\n')

  // Extract key-value pairs from FORM blocks
  const keyMap = new Map<string, Block>()
  const valueMap = new Map<string, Block>()

  for (const block of blocks) {
    if (block.BlockType === 'KEY_VALUE_SET') {
      if (block.EntityTypes?.includes('KEY')) keyMap.set(block.Id!, block)
      if (block.EntityTypes?.includes('VALUE')) valueMap.set(block.Id!, block)
    }
  }

  const fields: OcrField[] = []
  for (const [, keyBlock] of keyMap) {
    const keyText = extractText(keyBlock, blocks)
    const valueId = keyBlock.Relationships?.find((r) => r.Type === 'VALUE')?.Ids?.[0]
    if (!valueId) continue
    const valueBlock = valueMap.get(valueId)
    if (!valueBlock) continue
    const valueText = extractText(valueBlock, blocks)
    const confidence = Math.min(keyBlock.Confidence ?? 0, valueBlock.Confidence ?? 0)
    fields.push({ key: keyText.trim(), value: valueText.trim(), confidence })
  }

  const confs = fields.map((f) => f.confidence)
  const overallConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0
  const needsReview = fields.some((f) => f.confidence < REVIEW_THRESHOLD) || fields.length === 0

  return { rawText, fields, overallConfidence, needsReview }
}

function extractText(block: Block, allBlocks: Block[]): string {
  return (block.Relationships ?? [])
    .filter((r) => r.Type === 'CHILD')
    .flatMap((r) => r.Ids ?? [])
    .map((id) => allBlocks.find((b) => b.Id === id))
    .filter((b): b is Block => b?.BlockType === 'WORD')
    .map((b) => b.Text ?? '')
    .join(' ')
}

/**
 * Maps raw Textract fields to known clinical lab fields by fuzzy key matching.
 */
export function mapFieldsToLabResults(fields: OcrField[]) {
  const PATTERNS: [RegExp, string][] = [
    [/haemoglobin|hemoglobin|hgb|hb\b/i, 'Haemoglobin'],
    [/white\s*blood|wbc|leukocyte/i, 'WBC'],
    [/platelet|plt\b/i, 'Platelets'],
    [/creatinine/i, 'Creatinine'],
    [/urea|bun\b/i, 'Urea'],
    [/sodium|na\+?\b/i, 'Sodium'],
    [/potassium|k\+?\b/i, 'Potassium'],
    [/glucose|sugar/i, 'Glucose'],
    [/alanine|alt\b|sgpt/i, 'ALT'],
    [/aspartate|ast\b|sgot/i, 'AST'],
    [/bilirubin/i, 'Bilirubin'],
    [/c[\s-]?reactive|crp\b/i, 'CRP'],
    [/troponin/i, 'Troponin'],
    [/d[\s-]?dimer/i, 'D-Dimer'],
    [/prothrombin|pt\b|inr\b/i, 'PT/INR'],
  ]

  return fields.map((field) => {
    const matched = PATTERNS.find(([re]) => re.test(field.key))
    return { ...field, mappedName: matched ? matched[1] : null }
  })
}
