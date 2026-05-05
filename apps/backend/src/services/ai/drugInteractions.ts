import { prisma } from '../../db/client.js'

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor'

export interface DrugInteractionAlert {
  drug1: string
  drug2: string
  severity: InteractionSeverity
  description: string
  mechanism?: string | null
}

/**
 * Checks a list of drug names against the DrugInteraction table.
 * Returns all pairwise interactions found, sorted by severity.
 */
export async function checkInteractions(drugNames: string[]): Promise<DrugInteractionAlert[]> {
  if (drugNames.length < 2) return []

  const normalised = drugNames.map((d) => d.toLowerCase().trim())
  const severityRank: Record<InteractionSeverity, number> = {
    contraindicated: 0, major: 1, moderate: 2, minor: 3,
  }

  const interactions = await prisma.drugInteraction.findMany({
    where: {
      OR: normalised.flatMap((d) => [
        { drug1: d, drug2: { in: normalised.filter((x) => x !== d) } },
        { drug2: d, drug1: { in: normalised.filter((x) => x !== d) } },
      ]),
    },
  })

  return interactions
    .map((i) => ({
      drug1: i.drug1,
      drug2: i.drug2,
      severity: i.severity as InteractionSeverity,
      description: i.description,
      mechanism: i.mechanism,
    }))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
}

/**
 * Checks a single new drug against all currently active medications for a patient.
 */
export async function checkNewDrugAgainstPatientMeds(
  patientId: string,
  newDrug: string
): Promise<DrugInteractionAlert[]> {
  const activeMeds = await prisma.medicationLog.findMany({
    where: { patientId, endDate: null },
    select: { drugName: true },
  })

  const allDrugs = [newDrug, ...activeMeds.map((m) => m.drugName)]
  return checkInteractions(allDrugs)
}
