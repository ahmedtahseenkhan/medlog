import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ─── Antibiotic database ───────────────────────────────────────────────────────
interface AntibioticEntry {
  infection: string
  severity: string
  firstLine: string
  dose: string
  duration: string
  notes?: string
}

const DATA: { system: string; icon: string; entries: AntibioticEntry[] }[] = [
  {
    system: 'Respiratory', icon: '🫁',
    entries: [
      { infection: 'CAP — Mild (outpatient)', severity: 'mild', firstLine: 'Amoxicillin', dose: '500 mg TDS PO', duration: '5 days', notes: 'Add azithromycin 500mg OD if atypical suspected' },
      { infection: 'CAP — Moderate (inpatient)', severity: 'moderate', firstLine: 'Co-amoxiclav + Azithromycin', dose: '1.2g IV TDS + 500mg OD PO', duration: '7 days', notes: 'Step down to PO when tolerating' },
      { infection: 'CAP — Severe (HDU/ICU)', severity: 'severe', firstLine: 'Pip-tazo + Azithromycin', dose: '4.5g IV TDS + 500mg OD', duration: '7–10 days', notes: 'Add oseltamivir if influenza possible. Consider legionella/pneumococcal antigen' },
      { infection: 'HAP / VAP', severity: 'severe', firstLine: 'Pip-tazo ± Vancomycin', dose: '4.5g IV QDS ± 15mg/kg IV BD', duration: '7–8 days', notes: 'Add anti-MRSA if risk factors. Guided by local sensitivities' },
      { infection: 'Acute exacerbation COPD', severity: 'mild', firstLine: 'Amoxicillin OR Doxycycline', dose: '500mg TDS PO / 200mg OD PO', duration: '5 days' },
      { infection: 'Acute bronchitis', severity: 'mild', firstLine: 'Usually no antibiotics', dose: '—', duration: '—', notes: 'Viral in most cases. Antibiotics only if purulent sputum + systemic features' },
    ],
  },
  {
    system: 'Urinary Tract', icon: '🫧',
    entries: [
      { infection: 'Uncomplicated UTI (female)', severity: 'mild', firstLine: 'Nitrofurantoin', dose: '100mg BD PO (MR)', duration: '5 days', notes: 'Avoid if eGFR <30. Alternative: trimethoprim 200mg BD x3d' },
      { infection: 'Uncomplicated UTI (male)', severity: 'mild', firstLine: 'Trimethoprim', dose: '200mg BD PO', duration: '7 days', notes: 'Longer course than female. Exclude prostatitis' },
      { infection: 'Catheter-associated UTI', severity: 'mild', firstLine: 'Co-amoxiclav', dose: '625mg TDS PO', duration: '7 days', notes: 'Change catheter if possible. Culture-guided' },
      { infection: 'Pyelonephritis — Mild', severity: 'moderate', firstLine: 'Co-amoxiclav', dose: '625mg TDS PO', duration: '14 days', notes: 'PO if not vomiting and clinically stable' },
      { infection: 'Pyelonephritis — Severe', severity: 'severe', firstLine: 'Ceftriaxone', dose: '2g IV OD', duration: '14 days total', notes: 'Step down to PO co-amoxiclav when afebrile 24–48h' },
      { infection: 'Urosepsis', severity: 'severe', firstLine: 'Pip-tazo', dose: '4.5g IV QDS', duration: '14 days', notes: 'Blood cultures before antibiotics. Add gentamicin if shocked' },
    ],
  },
  {
    system: 'Skin & Soft Tissue', icon: '🩹',
    entries: [
      { infection: 'Cellulitis (non-purulent)', severity: 'mild', firstLine: 'Flucloxacillin', dose: '500mg QDS PO', duration: '5–7 days', notes: 'Elevate limb, mark borders. IV if systemically unwell' },
      { infection: 'Cellulitis (severe / IV)', severity: 'moderate', firstLine: 'Flucloxacillin IV', dose: '2g QDS IV', duration: '5–7 days then step down', notes: 'If penicillin allergy: clarithromycin 500mg BD' },
      { infection: 'Cellulitis (MRSA suspected)', severity: 'severe', firstLine: 'Vancomycin', dose: '15–20 mg/kg IV BD', duration: 'Guided by culture', notes: 'Send wound swab. Add pip-tazo if polymicrobial' },
      { infection: 'Abscess', severity: 'mild', firstLine: 'Incision & drainage', dose: '—', duration: '—', notes: 'Antibiotics only if systemic features or cellulitis around. Culture pus.' },
      { infection: 'Necrotising fasciitis', severity: 'severe', firstLine: 'Pip-tazo + Clindamycin + Vancomycin', dose: '4.5g IV QDS + 600mg IV TDS + 15mg/kg BD', duration: 'Until surgical source control', notes: '🔴 SURGICAL EMERGENCY — immediate surgical consult. Do not delay for antibiotics' },
      { infection: 'Diabetic foot infection', severity: 'moderate', firstLine: 'Co-amoxiclav', dose: '1.2g IV TDS', duration: '2–4 weeks', notes: 'Add metronidazole if anaerobes suspected. Vascular + ortho assessment' },
    ],
  },
  {
    system: 'Abdominal / GI', icon: '🫀',
    entries: [
      { infection: 'Cholecystitis', severity: 'moderate', firstLine: 'Co-amoxiclav', dose: '1.2g IV TDS', duration: '5–7 days', notes: 'Surgical consult. Cholecystectomy preferred' },
      { infection: 'Cholangitis', severity: 'severe', firstLine: 'Pip-tazo', dose: '4.5g IV QDS', duration: '7–14 days', notes: '🔴 ERCP / biliary decompression urgent. Blood cultures × 2' },
      { infection: 'Community appendicitis', severity: 'moderate', firstLine: 'Co-amoxiclav', dose: '1.2g IV TDS', duration: 'Perioperative', notes: 'Surgical management is definitive. Antibiotics perioperative' },
      { infection: 'Secondary peritonitis', severity: 'severe', firstLine: 'Pip-tazo + Metronidazole', dose: '4.5g IV QDS + 500mg IV TDS', duration: '5–7 days post-source control', notes: 'Surgical source control essential' },
      { infection: 'C. difficile (mild-moderate)', severity: 'mild', firstLine: 'Metronidazole PO', dose: '400mg TDS PO', duration: '10 days', notes: 'STOP causative antibiotics. Avoid loperamide' },
      { infection: 'C. difficile (severe)', severity: 'severe', firstLine: 'Vancomycin PO', dose: '125mg QDS PO', duration: '10 days', notes: 'Severe: WBC >15, Cr ×1.5 baseline, temp >38.5. ID consult' },
    ],
  },
  {
    system: 'CNS', icon: '🧠',
    entries: [
      { infection: 'Bacterial meningitis (adult)', severity: 'severe', firstLine: 'Ceftriaxone + Dexamethasone', dose: '2g IV BD + 0.15mg/kg IV QDS', duration: '10–14 days (dex x4d)', notes: '🔴 EMERGENCY — give immediately after LP (or before if LP delayed). Add ampicillin if >55y or immunocompromised for Listeria' },
      { infection: 'Bacterial meningitis (if penicillin allergy)', severity: 'severe', firstLine: 'Chloramphenicol', dose: '25mg/kg IV QDS', duration: '10–14 days', notes: 'Discuss with ID' },
      { infection: 'HSV encephalitis', severity: 'severe', firstLine: 'Aciclovir IV', dose: '10mg/kg IV TDS', duration: '14–21 days', notes: 'Start empirically if encephalitis suspected. MRI + EEG + LP' },
      { infection: 'Brain abscess', severity: 'severe', firstLine: 'Ceftriaxone + Metronidazole', dose: '2g IV BD + 500mg IV TDS', duration: '6–8 weeks', notes: 'Neurosurgical drainage essential if >2.5cm' },
    ],
  },
  {
    system: 'Bone & Joint', icon: '🦴',
    entries: [
      { infection: 'Septic arthritis', severity: 'severe', firstLine: 'Flucloxacillin IV', dose: '2g QDS IV', duration: '6 weeks total (2 IV + 4 PO)', notes: 'Joint washout essential. MRSA: vancomycin. Gonococcal: ceftriaxone' },
      { infection: 'Osteomyelitis (acute)', severity: 'severe', firstLine: 'Flucloxacillin IV', dose: '2g QDS IV', duration: '6 weeks (guided by culture)', notes: 'MRI is investigation of choice. Bone biopsy for culture if possible' },
    ],
  },
  {
    system: 'Sepsis', icon: '🚨',
    entries: [
      { infection: 'Sepsis (source unknown)', severity: 'severe', firstLine: 'Pip-tazo', dose: '4.5g IV QDS', duration: 'Guided by culture, 7–10 days', notes: '🔴 Hour-1 Bundle: blood cultures × 2, lactate, urine output, IV fluids 30ml/kg, antibiotics within 1 hour of recognition' },
      { infection: 'Septic shock', severity: 'severe', firstLine: 'Pip-tazo + Vancomycin', dose: '4.5g IV QDS + 15-20mg/kg IV BD', duration: 'Guided by culture', notes: '🔴 ICU referral. Noradrenaline if MAP <65. Consider hydrocortisone 200mg/day if refractory shock' },
      { infection: 'Neutropenic sepsis', severity: 'severe', firstLine: 'Pip-tazo', dose: '4.5g IV QDS', duration: 'Until ANC >0.5', notes: '🔴 ONCOLOGICAL EMERGENCY — start within 1 hour. Add amikacin if shocked or resistant organisms suspected' },
    ],
  },
]

const SEVERITY_CONFIG = {
  mild:     { color: colors.success,  label: 'Mild',     bg: colors.successLight },
  moderate: { color: colors.warning,  label: 'Moderate', bg: colors.warningLight },
  severe:   { color: colors.danger,   label: 'Severe',   bg: colors.dangerLight },
}

export default function AntibioticsScreen() {
  const [search, setSearch] = useState('')
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null)

  const query = search.toLowerCase()
  const filtered = DATA.map(sys => ({
    ...sys,
    entries: sys.entries.filter(e =>
      !query ||
      e.infection.toLowerCase().includes(query) ||
      e.firstLine.toLowerCase().includes(query) ||
      sys.system.toLowerCase().includes(query)
    ),
  })).filter(sys => sys.entries.length > 0)

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Antibiotic Guide</Text>
          <Text style={styles.headerSub}>Offline · General guidance only · Check local formulary</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="Search infection, antibiotic…"
          placeholderTextColor={colors.gray400}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {filtered.map(sys => (
          <View key={sys.system} style={styles.systemCard}>
            <TouchableOpacity
              style={styles.systemHeader}
              onPress={() => setExpandedSystem(expandedSystem === sys.system ? null : sys.system)}
              activeOpacity={0.75}
            >
              <Text style={styles.systemIcon}>{sys.icon}</Text>
              <Text style={styles.systemTitle}>{sys.system}</Text>
              <Text style={styles.systemCount}>{sys.entries.length}</Text>
              <Text style={styles.systemChevron}>{expandedSystem === sys.system ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {(expandedSystem === sys.system || !!query) && sys.entries.map((e, i) => {
              const sev = SEVERITY_CONFIG[e.severity as keyof typeof SEVERITY_CONFIG]
              return (
                <View key={i} style={[styles.entry, i < sys.entries.length - 1 && styles.entryBorder]}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.infectionName}>{e.infection}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                  </View>

                  <View style={styles.abxRow}>
                    <View style={styles.abxPill}>
                      <Text style={styles.abxPillText}>💊 {e.firstLine}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>DOSE</Text>
                      <Text style={styles.detailValue}>{e.dose}</Text>
                    </View>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>DURATION</Text>
                      <Text style={styles.detailValue}>{e.duration}</Text>
                    </View>
                  </View>

                  {e.notes && (
                    <View style={[styles.notesBox, e.notes.startsWith('🔴') && styles.notesBoxCritical]}>
                      <Text style={[styles.notesText, e.notes.startsWith('🔴') && styles.notesTextCritical]}>
                        {e.notes}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This guide is for general reference only. Always follow your institution's local antibiotic formulary and microbiology guidance. Adjust doses for renal/hepatic impairment. Culture before antibiotics where possible.
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

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
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, margin: spacing.lg, borderRadius: radius.full, paddingHorizontal: spacing.lg, height: 44, ...shadow.sm },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.gray900 },

  body: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  systemCard: { backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden', ...shadow.sm },
  systemHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.gray50 },
  systemIcon: { fontSize: 22 },
  systemTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.gray900 },
  systemCount: { fontSize: 13, fontWeight: '700', color: colors.gray500, backgroundColor: colors.gray200, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  systemChevron: { fontSize: 12, color: colors.gray400 },

  entry: { padding: spacing.lg },
  entryBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray100 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  infectionName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, lineHeight: 20 },
  severityBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  severityText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  abxRow: { marginBottom: spacing.sm },
  abxPill: { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  abxPillText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },

  detailRow: { flexDirection: 'row', backgroundColor: colors.gray50, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  detailItem: { flex: 1, padding: spacing.md },
  detailDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.gray200 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: colors.gray400, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.gray900, lineHeight: 18 },

  notesBox: { backgroundColor: colors.warningLight + '80', borderRadius: radius.sm, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning },
  notesBoxCritical: { backgroundColor: colors.dangerLight, borderLeftColor: colors.danger },
  notesText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  notesTextCritical: { color: '#991B1B', fontWeight: '600' },

  disclaimer: { backgroundColor: colors.gray100, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  disclaimerText: { fontSize: 12, color: colors.gray500, lineHeight: 18, textAlign: 'center' },
})
