/**
 * Pharma module — no PHI exposed, aggregate/educational only
 *
 * Uses hardcoded mock data. No patient records are referenced here.
 * A future iteration can replace this with a live drug database feed
 * (e.g. OpenFDA, RxNorm) without changing the API contract.
 */

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.js'

const DRUG_CARDS = [
  {
    id: 'drug-001',
    name: 'Amoxicillin',
    class: 'Aminopenicillin antibiotic',
    indication: 'Bacterial infections — respiratory tract, otitis media, UTI, H. pylori eradication',
    sideEffects: ['Diarrhoea', 'Nausea', 'Skin rash', 'Urticaria', 'Anaphylaxis (rare)'],
    interactions: ['Warfarin — increased anticoagulant effect', 'Methotrexate — reduced renal clearance', 'Allopurinol — increased rash risk'],
  },
  {
    id: 'drug-002',
    name: 'Metformin',
    class: 'Biguanide (oral antidiabetic)',
    indication: 'Type 2 diabetes mellitus, polycystic ovary syndrome (off-label)',
    sideEffects: ['GI upset', 'Metallic taste', 'Lactic acidosis (rare, eGFR-dependent)', 'Vitamin B12 deficiency (long-term)'],
    interactions: ['Contrast media — hold 48 h peri-procedure', 'Alcohol — lactic acidosis risk', 'Rifampicin — reduces metformin efficacy'],
  },
  {
    id: 'drug-003',
    name: 'Amlodipine',
    class: 'Calcium channel blocker (dihydropyridine)',
    indication: 'Hypertension, stable angina, vasospastic angina',
    sideEffects: ['Peripheral oedema', 'Flushing', 'Headache', 'Palpitations', 'Gingival hyperplasia (rare)'],
    interactions: ['Simvastatin — max simvastatin dose 20 mg/day', 'Cyclosporin — increased cyclosporin levels', 'CYP3A4 inhibitors — raised amlodipine levels'],
  },
  {
    id: 'drug-004',
    name: 'Furosemide',
    class: 'Loop diuretic',
    indication: 'Oedema in heart failure, hepatic cirrhosis, renal disease; hypertension',
    sideEffects: ['Hypokalaemia', 'Hyponatraemia', 'Dehydration', 'Ototoxicity (high doses)', 'Hyperuricaemia'],
    interactions: ['Aminoglycosides — additive ototoxicity', 'Digoxin — hypokalaemia potentiates toxicity', 'NSAIDs — reduced diuretic response'],
  },
  {
    id: 'drug-005',
    name: 'Omeprazole',
    class: 'Proton pump inhibitor (PPI)',
    indication: 'GORD, peptic ulcer disease, H. pylori eradication (triple therapy), NSAID gastroprotection',
    sideEffects: ['Headache', 'Diarrhoea', 'Hypomagnesaemia (long-term)', 'C. difficile risk', 'Osteoporosis (long-term)'],
    interactions: ['Clopidogrel — reduced antiplatelet effect (via CYP2C19)', 'Methotrexate — elevated levels', 'Ketoconazole — reduced absorption'],
  },
]

const DRUG_ALERTS = [
  {
    id: 'alert-001',
    drug: 'Metformin',
    severity: 'HIGH',
    message: 'Withhold metformin ≥48 h before iodinated contrast procedures and restart only after renal function is confirmed stable.',
    date: '2026-04-01',
  },
  {
    id: 'alert-002',
    drug: 'Amoxicillin + Clavulanate',
    severity: 'MEDIUM',
    message: 'Risk of cholestatic jaundice is higher with the combination product than with amoxicillin alone; use caution in patients with hepatic impairment.',
    date: '2026-03-18',
  },
  {
    id: 'alert-003',
    drug: 'Furosemide',
    severity: 'HIGH',
    message: 'IV doses >4 mg/min associated with ototoxicity. Administer as slow IV infusion in high-dose regimens.',
    date: '2026-02-25',
  },
  {
    id: 'alert-004',
    drug: 'Omeprazole',
    severity: 'MEDIUM',
    message: 'Long-term PPI use (>12 months) is associated with hypomagnesaemia. Check serum magnesium in symptomatic patients.',
    date: '2026-01-10',
  },
]

export async function pharmaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** GET /pharma/drugs — educational drug information cards */
  app.get('/drugs', async (_request, reply) => {
    return reply.send({ data: DRUG_CARDS })
  })

  /** GET /pharma/alerts — drug safety alerts */
  app.get('/alerts', async (_request, reply) => {
    return reply.send({ data: DRUG_ALERTS })
  })
}
