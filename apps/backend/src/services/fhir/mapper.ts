/**
 * Maps MedLog internal models to FHIR R4 resources.
 * Spec: https://hl7.org/fhir/R4/
 *
 * We produce minimal-valid FHIR — enough for interoperability with hospital HIS.
 * Full profile conformance (e.g. US Core, IHE) is handled during the compliance review (Phase 6).
 */

// ── Shared types ──────────────────────────────────────────────────────────────

interface FhirCoding { system: string; code: string; display?: string }
interface FhirCodeableConcept { coding: FhirCoding[]; text?: string }
interface FhirReference { reference: string; display?: string }
interface FhirIdentifier { use?: string; system?: string; value: string }

// ── Patient → FHIR Patient ────────────────────────────────────────────────────

export interface DbPatient {
  id: string; mrNumber: string; status: string
  admissionDate?: Date | null; admissionDiagnosis?: string | null
  ward?: { name: string; code: string } | null
}

export function toFhirPatient(p: DbPatient): object {
  return {
    resourceType: 'Patient',
    id: p.id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
    identifier: [
      { use: 'usual', system: 'urn:medlog:mrn', value: p.mrNumber } satisfies FhirIdentifier,
    ],
    active: p.status === 'ADMITTED',
    extension: p.ward ? [{
      url: 'http://hl7.org/fhir/StructureDefinition/patient-locationPerformed',
      valueString: `${p.ward.name} (${p.ward.code})`,
    }] : [],
  }
}

// ── LabReport → FHIR Observation ─────────────────────────────────────────────

export interface DbLabReport {
  id: string; patientId: string; testName: string; value: string; unit: string
  referenceRangeLow?: number | null; referenceRangeHigh?: number | null
  isAbnormal: boolean; isCritical: boolean; reportedAt: Date
}

/** LOINC codes for common lab tests — extend as needed */
const LOINC_MAP: Record<string, FhirCoding> = {
  Haemoglobin:  { system: 'http://loinc.org', code: '718-7',  display: 'Hemoglobin [Mass/volume] in Blood' },
  WBC:          { system: 'http://loinc.org', code: '6690-2', display: 'Leukocytes [#/volume] in Blood' },
  Platelets:    { system: 'http://loinc.org', code: '777-3',  display: 'Platelets [#/volume] in Blood' },
  Creatinine:   { system: 'http://loinc.org', code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
  Sodium:       { system: 'http://loinc.org', code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' },
  Potassium:    { system: 'http://loinc.org', code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' },
  Glucose:      { system: 'http://loinc.org', code: '15074-8', display: 'Glucose [Moles/volume] in Blood' },
  CRP:          { system: 'http://loinc.org', code: '1988-5', display: 'C reactive protein [Mass/volume] in Serum or Plasma' },
  Troponin:     { system: 'http://loinc.org', code: '6598-7', display: 'Troponin T.cardiac [Mass/volume] in Serum or Plasma' },
}

function loincCoding(testName: string): FhirCodeableConcept {
  const loinc = LOINC_MAP[testName]
  return loinc
    ? { coding: [loinc, { system: 'urn:medlog:lab', code: testName }], text: testName }
    : { coding: [{ system: 'urn:medlog:lab', code: testName }], text: testName }
}

function observationStatus(lab: DbLabReport): string {
  return 'final'
}

function interpretationCode(lab: DbLabReport): FhirCodeableConcept[] {
  if (lab.isCritical) return [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'AA', display: 'Critical abnormal' }] }]
  if (lab.isAbnormal) return [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }] }]
  return [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Normal' }] }]
}

export function toFhirObservation(lab: DbLabReport): object {
  const numVal = parseFloat(lab.value)
  const isNumeric = !isNaN(numVal)

  return {
    resourceType: 'Observation',
    id: lab.id,
    status: observationStatus(lab),
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
    code: loincCoding(lab.testName),
    subject: { reference: `Patient/${lab.patientId}` } satisfies FhirReference,
    effectiveDateTime: lab.reportedAt.toISOString(),
    ...(isNumeric ? {
      valueQuantity: { value: numVal, unit: lab.unit, system: 'http://unitsofmeasure.org', code: lab.unit },
      referenceRange: (lab.referenceRangeLow != null || lab.referenceRangeHigh != null) ? [{
        ...(lab.referenceRangeLow != null ? { low: { value: lab.referenceRangeLow, unit: lab.unit } } : {}),
        ...(lab.referenceRangeHigh != null ? { high: { value: lab.referenceRangeHigh, unit: lab.unit } } : {}),
      }] : [],
    } : {
      valueString: lab.value,
    }),
    interpretation: interpretationCode(lab),
  }
}

// ── ClinicalNote → FHIR DiagnosticReport ─────────────────────────────────────

export interface DbNote {
  id: string; patientId: string; type: string
  content: Record<string, string>; createdAt: Date
  author?: { name: string } | null
}

export function toFhirDiagnosticReport(note: DbNote, labIds: string[]): object {
  const conclusion = note.type === 'SOAP'
    ? [note.content.assessment, note.content.plan].filter(Boolean).join('\n')
    : note.content.freeText ?? ''

  return {
    resourceType: 'DiagnosticReport',
    id: note.id,
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '11502-2', display: 'Laboratory report' }] },
    subject: { reference: `Patient/${note.patientId}` },
    effectiveDateTime: note.createdAt.toISOString(),
    issued: note.createdAt.toISOString(),
    ...(note.author ? { performer: [{ display: note.author.name }] } : {}),
    result: labIds.map((id) => ({ reference: `Observation/${id}` })),
    conclusion,
  }
}

// ── Patient admission → FHIR Encounter ───────────────────────────────────────

export function toFhirEncounter(p: DbPatient): object {
  return {
    resourceType: 'Encounter',
    id: `encounter-${p.id}`,
    status: p.status === 'ADMITTED' ? 'in-progress' : p.status === 'DISCHARGED' ? 'finished' : 'cancelled',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
    subject: { reference: `Patient/${p.id}` },
    period: { start: p.admissionDate?.toISOString() },
    reasonCode: p.admissionDiagnosis
      ? [{ text: p.admissionDiagnosis } satisfies FhirCodeableConcept]
      : [],
    location: p.ward ? [{ location: { display: `${p.ward.name} (${p.ward.code})` } }] : [],
  }
}

// ── FHIR Bundle ───────────────────────────────────────────────────────────────

export function buildFhirBundle(resources: object[]): object {
  return {
    resourceType: 'Bundle',
    id: `bundle-${Date.now()}`,
    type: 'searchset',
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map((r) => ({
      resource: r,
      fullUrl: `urn:uuid:${(r as Record<string, string>).id}`,
    })),
  }
}
