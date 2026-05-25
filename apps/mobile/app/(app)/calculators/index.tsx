import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ─── Calculator definitions ────────────────────────────────────────────────────
const CALCS = [
  { id: 'antibiotics', icon: '💊', title: 'Antibiotic Guide', subtitle: '7 systems · Dose & duration' },
  { id: 'crcl',    icon: '🩺', title: 'CrCl',          subtitle: 'Cockcroft-Gault · Drug dosing' },
  { id: 'egfr',    icon: '🫘', title: 'eGFR',           subtitle: 'CKD-EPI · Renal function' },
  { id: 'ca',      icon: '🦴', title: 'Corrected Ca²⁺', subtitle: 'Albumin correction' },
  { id: 'curb65',  icon: '🫁', title: 'CURB-65',        subtitle: 'Pneumonia severity' },
  { id: 'wells_dvt', icon: '🦵', title: 'Wells DVT',   subtitle: 'DVT probability score' },
  { id: 'fluids',  icon: '💧', title: 'IV Fluids',      subtitle: 'Maintenance rate · Holliday-Segar' },
  { id: 'bmi',     icon: '⚖️', title: 'BMI',            subtitle: 'Body Mass Index' },
  { id: 'gcs',     icon: '🧠', title: 'GCS',            subtitle: 'Glasgow Coma Scale' },
]

type CalcId = typeof CALCS[number]['id']

export default function CalcScreen() {
  const [activeCalc, setActiveCalc] = useState<CalcId | null>(null)

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Clinical Calculators</Text>
          <Text style={styles.headerSub}>100% offline · No internet needed</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Grid of calculators */}
        {activeCalc === null && (
          <>
            <Text style={styles.tip}>Results are for clinical guidance only — verify with clinical judgment.</Text>
            <View style={styles.grid}>
              {CALCS.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.calcCard}
                  onPress={() => c.id === 'antibiotics' ? router.push('/(app)/calculators/antibiotics' as any) : setActiveCalc(c.id as CalcId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.calcIconCircle}>
                    <Text style={styles.calcIcon}>{c.icon}</Text>
                  </View>
                  <Text style={styles.calcTitle}>{c.title}</Text>
                  <Text style={styles.calcSub}>{c.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Individual calculators */}
        {activeCalc === 'crcl' && <CrClCalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'egfr' && <EGFRCalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'ca' && <CorrectedCaCalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'curb65' && <CURB65Calc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'wells_dvt' && <WellsDVTCalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'fluids' && <FluidsCalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'bmi' && <BMICalc onBack={() => setActiveCalc(null)} />}
        {activeCalc === 'gcs' && <GCSCalc onBack={() => setActiveCalc(null)} />}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────
function CalcHeader({ title, icon, onBack }: { title: string; icon: string; onBack: () => void }) {
  return (
    <TouchableOpacity style={ch.row} onPress={onBack} activeOpacity={0.8}>
      <Text style={ch.backArrow}>{'<'}</Text>
      <Text style={ch.icon}>{icon}</Text>
      <Text style={ch.title}>{title}</Text>
    </TouchableOpacity>
  )
}
const ch = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  backArrow: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  icon: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
})

function NumInput({ label, value, onChange, unit, hint }: { label: string; value: string; onChange: (v: string) => void; unit?: string; hint?: string }) {
  return (
    <View style={ni.wrap}>
      <Text style={ni.label}>{label}{unit ? <Text style={ni.unit}> ({unit})</Text> : null}</Text>
      {hint ? <Text style={ni.hint}>{hint}</Text> : null}
      <TextInput
        style={ni.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.gray300}
      />
    </View>
  )
}
const ni = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs },
  unit: { color: colors.gray400, textTransform: 'none', letterSpacing: 0 },
  hint: { fontSize: 12, color: colors.gray400, marginBottom: spacing.xs },
  input: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gray200, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 20, fontWeight: '700', color: colors.gray900, ...shadow.sm },
})

function ResultBox({ result, interpretation, color }: { result: string; interpretation: string; color?: string }) {
  const bg = color ?? colors.primary
  return (
    <View style={[rb.box, { borderColor: bg }]}>
      <Text style={[rb.result, { color: bg }]}>{result}</Text>
      <Text style={rb.interp}>{interpretation}</Text>
    </View>
  )
}
const rb = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginTop: spacing.lg, backgroundColor: colors.white, ...shadow.sm },
  result: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: spacing.sm },
  interp: { fontSize: 14, color: colors.gray700, textAlign: 'center', lineHeight: 20 },
})

function GenderPicker({ value, onChange }: { value: 'M' | 'F'; onChange: (v: 'M' | 'F') => void }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.label, { marginBottom: spacing.xs }]}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['M', 'F'] as const).map(g => (
          <TouchableOpacity key={g} style={[gp.btn, value === g && gp.btnActive]} onPress={() => onChange(g)} activeOpacity={0.8}>
            <Text style={[gp.text, value === g && gp.textActive]}>{g === 'M' ? '♂ Male' : '♀ Female'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
const gp = StyleSheet.create({
  btn: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gray200, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.white },
  btnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 14, fontWeight: '700', color: colors.gray500 },
  textActive: { color: colors.white },
})

function CheckRow({ label, checked, onToggle, sublabel }: { label: string; checked: boolean; onToggle: () => void; sublabel?: string }) {
  return (
    <TouchableOpacity style={cr.row} onPress={onToggle} activeOpacity={0.8}>
      <View style={[cr.box, checked && cr.boxChecked]}>
        {checked && <Text style={cr.check}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cr.label}>{label}</Text>
        {sublabel ? <Text style={cr.sub}>{sublabel}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}
const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200 },
  box: { width: 26, height: 26, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.white, fontWeight: '800', fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  sub: { fontSize: 12, color: colors.gray500, marginTop: 2 },
})

// ─── CrCl Calculator ──────────────────────────────────────────────────────────
function CrClCalc({ onBack }: { onBack: () => void }) {
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [creatinine, setCreatinine] = useState('')
  const [gender, setGender] = useState<'M' | 'F'>('M')

  const a = parseFloat(age), w = parseFloat(weight), cr = parseFloat(creatinine)
  const valid = a > 0 && w > 0 && cr > 0
  let crcl = 0
  if (valid) {
    crcl = ((140 - a) * w) / (72 * cr)
    if (gender === 'F') crcl *= 0.85
  }

  function interp(v: number) {
    if (v >= 90) return { text: 'Normal renal function\nNo dose adjustment needed', color: colors.success }
    if (v >= 60) return { text: 'Mild reduction (CKD 2)\nCheck drug-specific dosing', color: colors.success }
    if (v >= 30) return { text: 'Moderate reduction (CKD 3)\nDose adjustment required for many drugs', color: colors.warning }
    if (v >= 15) return { text: 'Severe reduction (CKD 4)\nSignificant dose adjustments needed\nNephrology review recommended', color: colors.danger }
    return { text: 'Kidney failure (CKD 5)\nDialysis consideration\nUrgent nephrology review', color: colors.danger }
  }
  const result = valid ? interp(crcl) : null

  return (
    <View>
      <CalcHeader title="Creatinine Clearance" icon="🩺" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>Cockcroft-Gault: (140-age) × weight / (72 × Cr) × 0.85 if female</Text>
        <NumInput label="Age" value={age} onChange={setAge} unit="years" />
        <NumInput label="Weight" value={weight} onChange={setWeight} unit="kg" hint="Use actual body weight (or IBW if obese)" />
        <NumInput label="Serum Creatinine" value={creatinine} onChange={setCreatinine} unit="mg/dL" hint="1 mg/dL ≈ 88.4 µmol/L" />
        <GenderPicker value={gender} onChange={setGender} />
        {result && <ResultBox result={`${crcl.toFixed(1)} mL/min`} interpretation={result.text} color={result.color} />}
        {!valid && <Text style={styles.calcHint}>Fill in all fields to calculate</Text>}
      </View>
    </View>
  )
}

// ─── eGFR Calculator ──────────────────────────────────────────────────────────
function EGFRCalc({ onBack }: { onBack: () => void }) {
  const [age, setAge] = useState('')
  const [creatinine, setCreatinine] = useState('')
  const [gender, setGender] = useState<'M' | 'F'>('M')

  const a = parseFloat(age), cr = parseFloat(creatinine)
  const valid = a > 0 && cr > 0
  let egfr = 0
  if (valid) {
    // CKD-EPI simplified
    const kappa = gender === 'F' ? 0.7 : 0.9
    const alpha = gender === 'F' ? -0.241 : -0.302
    const crR = cr / kappa
    egfr = 142 * Math.pow(Math.min(crR, 1), alpha) * Math.pow(Math.max(crR, 1), -1.200) * Math.pow(0.9938, a)
    if (gender === 'F') egfr *= 1.012
  }

  function interp(v: number) {
    if (v >= 90) return { text: 'CKD Stage 1 (if structural damage)\nNormal or high', color: colors.success }
    if (v >= 60) return { text: 'CKD Stage 2\nMildly decreased', color: colors.success }
    if (v >= 45) return { text: 'CKD Stage 3a\nMild-moderate decrease', color: colors.warning }
    if (v >= 30) return { text: 'CKD Stage 3b\nModerate-severe decrease\nAdjust drug doses', color: colors.warning }
    if (v >= 15) return { text: 'CKD Stage 4 — SEVERE\nPrepare for renal replacement therapy', color: colors.danger }
    return { text: 'CKD Stage 5 — KIDNEY FAILURE\nRRT / Dialysis', color: colors.danger }
  }
  const result = valid ? interp(egfr) : null

  return (
    <View>
      <CalcHeader title="eGFR (CKD-EPI)" icon="🫘" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>CKD-EPI equation (2021 race-free)</Text>
        <NumInput label="Age" value={age} onChange={setAge} unit="years" />
        <NumInput label="Serum Creatinine" value={creatinine} onChange={setCreatinine} unit="mg/dL" />
        <GenderPicker value={gender} onChange={setGender} />
        {result && <ResultBox result={`${egfr.toFixed(0)} mL/min/1.73m²`} interpretation={result.text} color={result.color} />}
        {!valid && <Text style={styles.calcHint}>Fill in all fields to calculate</Text>}
      </View>
    </View>
  )
}

// ─── Corrected Calcium ────────────────────────────────────────────────────────
function CorrectedCaCalc({ onBack }: { onBack: () => void }) {
  const [ca, setCa] = useState('')
  const [albumin, setAlbumin] = useState('')

  const caV = parseFloat(ca), albV = parseFloat(albumin)
  const valid = caV > 0 && albV > 0
  const corrCa = valid ? caV + 0.8 * (4.0 - albV) : 0

  function interp(v: number) {
    if (v < 8.5) return { text: 'HYPOCALCAEMIA\nCheck Mg²⁺, Vit D, PTH\nSymptoms: tetany, Chvostek sign', color: colors.danger }
    if (v <= 10.5) return { text: 'Normal range (8.5–10.5 mg/dL)', color: colors.success }
    if (v <= 12) return { text: 'MILD HYPERCALCAEMIA\nIV fluids, investigate cause\nCheck PTH, malignancy screen', color: colors.warning }
    if (v <= 14) return { text: 'MODERATE HYPERCALCAEMIA\nIV fluids, bisphosphonates\nAdmit for monitoring', color: colors.danger }
    return { text: 'SEVERE HYPERCALCAEMIA — EMERGENCY\nAggressive IV fluids, calcitonin\nICU consideration', color: colors.danger }
  }
  const result = valid ? interp(corrCa) : null

  return (
    <View>
      <CalcHeader title="Corrected Calcium" icon="🦴" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>Corrected Ca = Measured Ca + 0.8 × (4.0 − Albumin)</Text>
        <NumInput label="Measured Calcium" value={ca} onChange={setCa} unit="mg/dL" hint="Normal: 8.5–10.5 mg/dL" />
        <NumInput label="Serum Albumin" value={albumin} onChange={setAlbumin} unit="g/dL" hint="Normal: 3.5–5.0 g/dL" />
        {result && <ResultBox result={`${corrCa.toFixed(1)} mg/dL`} interpretation={result.text} color={result.color} />}
        {!valid && <Text style={styles.calcHint}>Fill in both values to calculate</Text>}
      </View>
    </View>
  )
}

// ─── CURB-65 ──────────────────────────────────────────────────────────────────
function CURB65Calc({ onBack }: { onBack: () => void }) {
  const [confusion, setConfusion] = useState(false)
  const [bun, setBun] = useState(false)
  const [rr, setRr] = useState(false)
  const [bp, setBp] = useState(false)
  const [age, setAge] = useState(false)

  const score = [confusion, bun, rr, bp, age].filter(Boolean).length

  const results = [
    { label: 'Score 0–1', text: 'LOW risk — Treat as outpatient', color: colors.success, action: 'Consider home treatment' },
    { label: 'Score 2', text: 'MODERATE risk — Short stay / Inpatient', color: colors.warning, action: 'Admit for monitoring' },
    { label: 'Score 3–5', text: 'HIGH risk — Admit ± ICU', color: colors.danger, action: 'Consider ICU if score 4–5' },
  ]
  const result = score <= 1 ? results[0] : score === 2 ? results[1] : results[2]

  return (
    <View>
      <CalcHeader title="CURB-65 — Pneumonia" icon="🫁" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>Each criterion = 1 point (max 5)</Text>
        <CheckRow label="Confusion" sublabel="New onset, oriented to person/place/time?" checked={confusion} onToggle={() => setConfusion(!confusion)} />
        <CheckRow label="BUN > 19 mg/dL" sublabel="(or Urea > 7 mmol/L)" checked={bun} onToggle={() => setBun(!bun)} />
        <CheckRow label="Respiratory Rate ≥ 30/min" checked={rr} onToggle={() => setRr(!rr)} />
        <CheckRow label="Blood Pressure" sublabel="Systolic < 90 OR Diastolic ≤ 60 mmHg" checked={bp} onToggle={() => setBp(!bp)} />
        <CheckRow label="Age ≥ 65 years" checked={age} onToggle={() => setAge(!age)} />
        <ResultBox
          result={`Score: ${score}/5 — ${result.label}`}
          interpretation={`${result.text}\n\n📋 Action: ${result.action}`}
          color={result.color}
        />
      </View>
    </View>
  )
}

// ─── Wells DVT ────────────────────────────────────────────────────────────────
function WellsDVTCalc({ onBack }: { onBack: () => void }) {
  const criteria = [
    { label: 'Active cancer', sublabel: 'Treatment within 6 months or palliative', points: 1, key: 'cancer' },
    { label: 'Paralysis/paresis/plaster cast', sublabel: 'Of lower extremity', points: 1, key: 'paralysis' },
    { label: 'Bedridden ≥ 3 days / Major surgery < 12 weeks', points: 1, key: 'bedrest' },
    { label: 'Localised tenderness along deep veins', points: 1, key: 'tenderness' },
    { label: 'Entire leg swollen', points: 1, key: 'legswollen' },
    { label: 'Calf swelling > 3 cm vs other leg', points: 1, key: 'calf' },
    { label: 'Pitting oedema (symptomatic leg only)', points: 1, key: 'oedema' },
    { label: 'Collateral superficial veins', sublabel: '(Non-varicose)', points: 1, key: 'collateral' },
    { label: 'Alternative diagnosis as likely', sublabel: 'Subtract 2 points', points: -2, key: 'alternative' },
  ]
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const score = criteria.reduce((sum, c) => checked[c.key] ? sum + c.points : sum, 0)

  function interp(s: number) {
    if (s <= 0) return { text: 'LOW probability\nDVT unlikely\nD-dimer to exclude', color: colors.success }
    if (s <= 2) return { text: 'MODERATE probability\nUltrasound required', color: colors.warning }
    return { text: 'HIGH probability\nTreat empirically while awaiting USS\nConsider anticoagulation', color: colors.danger }
  }
  const result = interp(score)

  return (
    <View>
      <CalcHeader title="Wells DVT Score" icon="🦵" onBack={onBack} />
      <View style={styles.calcForm}>
        {criteria.map(c => (
          <CheckRow
            key={c.key}
            label={`${c.label} (${c.points > 0 ? '+' : ''}${c.points})`}
            sublabel={c.sublabel}
            checked={!!checked[c.key]}
            onToggle={() => setChecked(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
          />
        ))}
        <ResultBox result={`Score: ${score} — ${score <= 0 ? 'Low' : score <= 2 ? 'Moderate' : 'High'}`} interpretation={result.text} color={result.color} />
      </View>
    </View>
  )
}

// ─── IV Maintenance Fluids ────────────────────────────────────────────────────
function FluidsCalc({ onBack }: { onBack: () => void }) {
  const [weight, setWeight] = useState('')
  const w = parseFloat(weight)
  const valid = w > 0

  let mlPerDay = 0
  if (valid) {
    if (w <= 10) mlPerDay = w * 100
    else if (w <= 20) mlPerDay = 1000 + (w - 10) * 50
    else mlPerDay = 1500 + (w - 20) * 20
  }
  const mlPerHr = mlPerDay / 24

  return (
    <View>
      <CalcHeader title="IV Maintenance Fluids" icon="💧" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>Holliday-Segar: 100/50/20 rule</Text>
        <NumInput label="Body Weight" value={weight} onChange={setWeight} unit="kg" />
        {valid && (
          <>
            <ResultBox
              result={`${mlPerHr.toFixed(0)} mL/hr`}
              interpretation={`Total: ${mlPerDay.toFixed(0)} mL/day\n\nHolliday-Segar breakdown:\n• First 10 kg: 100 mL/kg/day\n• Next 10 kg: 50 mL/kg/day\n• Each kg above 20: 20 mL/kg/day\n\n⚠️ Adjust for fluid status, renal function, and clinical condition`}
              color={colors.primary}
            />
          </>
        )}
        {!valid && <Text style={styles.calcHint}>Enter weight to calculate</Text>}
      </View>
    </View>
  )
}

// ─── BMI ──────────────────────────────────────────────────────────────────────
function BMICalc({ onBack }: { onBack: () => void }) {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const w = parseFloat(weight), h = parseFloat(height) / 100
  const valid = w > 0 && h > 0
  const bmi = valid ? w / (h * h) : 0

  function interp(v: number) {
    if (v < 18.5) return { text: 'Underweight\nNutritional assessment recommended', color: colors.warning }
    if (v < 25) return { text: 'Normal weight\nHealthy range', color: colors.success }
    if (v < 30) return { text: 'Overweight\nLifestyle advice', color: colors.warning }
    if (v < 35) return { text: 'Obese Class I\nWeight management', color: colors.danger }
    if (v < 40) return { text: 'Obese Class II\nIntensive intervention', color: colors.danger }
    return { text: 'Obese Class III (Morbid)\nBariatric referral consideration', color: colors.danger }
  }
  const result = valid ? interp(bmi) : null

  return (
    <View>
      <CalcHeader title="BMI" icon="⚖️" onBack={onBack} />
      <View style={styles.calcForm}>
        <Text style={styles.formula}>BMI = Weight (kg) / Height² (m²)</Text>
        <NumInput label="Weight" value={weight} onChange={setWeight} unit="kg" />
        <NumInput label="Height" value={height} onChange={setHeight} unit="cm" />
        {result && <ResultBox result={`BMI: ${bmi.toFixed(1)} kg/m²`} interpretation={result.text} color={result.color} />}
        {!valid && <Text style={styles.calcHint}>Enter weight and height</Text>}
      </View>
    </View>
  )
}

// ─── GCS ──────────────────────────────────────────────────────────────────────
function GCSCalc({ onBack }: { onBack: () => void }) {
  const eyes = [
    { score: 4, label: 'Spontaneously' },
    { score: 3, label: 'To voice' },
    { score: 2, label: 'To pain' },
    { score: 1, label: 'No response' },
  ]
  const verbal = [
    { score: 5, label: 'Oriented' },
    { score: 4, label: 'Confused' },
    { score: 3, label: 'Inappropriate words' },
    { score: 2, label: 'Incomprehensible sounds' },
    { score: 1, label: 'No response' },
  ]
  const motor = [
    { score: 6, label: 'Obeys commands' },
    { score: 5, label: 'Localises pain' },
    { score: 4, label: 'Withdraws to pain' },
    { score: 3, label: 'Abnormal flexion (decorticate)' },
    { score: 2, label: 'Extension (decerebrate)' },
    { score: 1, label: 'No response' },
  ]
  const [e, setE] = useState(4)
  const [v, setV] = useState(5)
  const [m, setM] = useState(6)
  const total = e + v + m

  function interp(s: number) {
    if (s >= 13) return { text: 'Mild brain injury (13–15)\nObserve closely', color: colors.success }
    if (s >= 9) return { text: 'Moderate brain injury (9–12)\nClose monitoring, consider CT', color: colors.warning }
    return { text: 'SEVERE brain injury (≤8)\nEndotracheal intubation may be needed\nICU referral', color: colors.danger }
  }
  const result = interp(total)

  function SegmentPicker({ label, options, value, onChange }: { label: string; options: typeof eyes; value: number; onChange: (v: number) => void }) {
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>{label}</Text>
        {options.map(o => (
          <TouchableOpacity key={o.score} style={[seg.row, value === o.score && seg.rowActive]} onPress={() => onChange(o.score)} activeOpacity={0.8}>
            <View style={[seg.badge, value === o.score && seg.badgeActive]}>
              <Text style={[seg.badgeText, value === o.score && seg.badgeTextActive]}>{o.score}</Text>
            </View>
            <Text style={[seg.label, value === o.score && seg.labelActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }
  const seg = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
    rowActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    badge: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
    badgeActive: { backgroundColor: colors.primary },
    badgeText: { fontSize: 13, fontWeight: '800', color: colors.gray500 },
    badgeTextActive: { color: colors.white },
    label: { fontSize: 14, color: colors.gray700 },
    labelActive: { color: colors.primary, fontWeight: '600' },
  })

  return (
    <View>
      <CalcHeader title="Glasgow Coma Scale" icon="🧠" onBack={onBack} />
      <View style={styles.calcForm}>
        <SegmentPicker label="👁 Eye Opening (E)" options={eyes} value={e} onChange={setE} />
        <SegmentPicker label="💬 Verbal Response (V)" options={verbal} value={v} onChange={setV} />
        <SegmentPicker label="✋ Motor Response (M)" options={motor} value={m} onChange={setM} />
        <ResultBox
          result={`GCS ${total}/15  (E${e}V${v}M${m})`}
          interpretation={result.text}
          color={result.color}
        />
      </View>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: spacing.lg, paddingHorizontal: spacing.xl,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  body: { padding: spacing.xl },
  tip: { fontSize: 12, color: colors.gray400, textAlign: 'center', marginBottom: spacing.lg, fontStyle: 'italic' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  calcCard: {
    width: '47%', backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'flex-start', ...shadow.md,
    borderWidth: 1.5, borderColor: colors.line,
  },
  calcIconCircle: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  calcIcon: { fontSize: 24 },
  calcTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 3, letterSpacing: -0.2 },
  calcSub: { fontSize: 11, color: colors.textSoft, lineHeight: 16 },

  calcForm: { backgroundColor: colors.screenBg },
  formula: { fontSize: 12, color: colors.gray500, fontStyle: 'italic', marginBottom: spacing.xl, backgroundColor: colors.gray100, padding: spacing.md, borderRadius: radius.md },
  calcHint: { textAlign: 'center', color: colors.gray400, marginTop: spacing.lg, fontStyle: 'italic', fontSize: 13 },
})
