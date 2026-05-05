import * as Notifications from 'expo-notifications'

// Abnormal lab reference ranges with clinical guidance
const LAB_GUIDANCE: Record<string, { low?: string; high?: string; critical?: string }> = {
  Haemoglobin: {
    low: 'Anaemia — consider iron studies, reticulocyte count, B12/folate. Transfuse if symptomatic or Hb < 7.',
    high: 'Polycythaemia — check O2 sat, JAK2 mutation. Hydrate and review.',
  },
  WBC: {
    low: 'Leucopenia — risk of infection. Isolate if neutrophils < 0.5. Review medications.',
    high: 'Leucocytosis — infection/inflammation likely. Blood cultures if febrile. Consider haematology referral if very high.',
    critical: 'CRITICAL leucocytosis — rule out leukaemia. Urgent haematology review.',
  },
  Platelets: {
    low: 'Thrombocytopaenia — bleeding risk. Hold antiplatelets. Transfuse if < 10k or active bleeding.',
    high: 'Thrombocytosis — reactive vs essential. If > 1000k, risk of thrombosis.',
  },
  Potassium: {
    low: 'Hypokalaemia — ECG for arrhythmia. Replete IV/PO. Target > 3.5.',
    high: 'Hyperkalaemia — stop K+ sources, ECG urgently. Calcium gluconate if > 6.5 or ECG changes.',
    critical: 'CRITICAL hyperkalaemia — cardiac arrest risk. Calcium gluconate IV NOW. Urgent treatment required.',
  },
  Sodium: {
    low: 'Hyponatraemia — assess fluid status. Correct slowly (max 8-10 mmol/day). Watch for osmotic demyelination.',
    high: 'Hypernatraemia — free water deficit. Replace slowly. Identify cause (DI, dehydration).',
  },
  Creatinine: {
    high: 'AKI — check urine output, fluid balance. STOP nephrotoxins. Consider renal referral if worsening.',
    critical: 'CRITICAL AKI — urgent renal referral. Consider dialysis indications.',
  },
  Urea: {
    high: 'Elevated urea — dehydration, GI bleed, or renal failure. Fluid resuscitate and reassess.',
  },
  ALT: {
    high: 'Hepatocellular injury — stop hepatotoxic drugs. Check hepatitis screen, USS abdomen.',
  },
  AST: {
    high: 'Hepatocellular injury — correlate with ALT, bilirubin. Liver function panel.',
  },
  Bilirubin: {
    high: 'Jaundice — conjugated vs unconjugated. USS for biliary obstruction. LFT pattern.',
  },
  CRP: {
    high: 'Inflammation/infection — correlate with clinical picture. Blood cultures if febrile.',
  },
  'Blood Glucose': {
    low: 'Hypoglycaemia — give 15g glucose (dextrose/juice). Recheck in 15 min. Find cause.',
    high: 'Hyperglycaemia — check ketones if DM1. Sliding scale or insulin adjustment.',
    critical: 'CRITICAL hyperglycaemia — consider DKA/HHS. Urgent management protocol.',
  },
  HbA1c: {
    high: 'Poor glycaemic control — review medications, diet. Refer diabetes team if > 10%.',
  },
  eGFR: {
    low: 'Reduced renal function — stop nephrotoxins, adjust drug doses. Monitor trend.',
    critical: 'CRITICAL eGFR — severe renal impairment. Urgent renal referral.',
  },
}

function getLabGuidance(testName: string, isHigh: boolean, isCritical: boolean): string {
  const guidance = LAB_GUIDANCE[testName]
  if (!guidance) return 'Review result with clinical team and take appropriate action.'
  if (isCritical && guidance.critical) return guidance.critical
  if (isHigh && guidance.high) return guidance.high
  if (!isHigh && guidance.low) return guidance.low
  return 'Review result with clinical team and take appropriate action.'
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
} catch {
  // Expo Go may restrict notification handler setup — safe to ignore
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

export async function scheduleFollowUpReminder(
  mrNumber: string,
  name: string | null,
  followUpDate: Date,
): Promise<string | null> {
  try {
    const patientLabel = name ? `${name} (MR# ${mrNumber})` : `MR# ${mrNumber}`
    const trigger = new Date(followUpDate)
    trigger.setHours(8, 0, 0, 0)
    const now = new Date()
    // If already past 8am on follow-up day, fire 5 min from now so doctor still sees it
    const scheduledDate = trigger <= now ? new Date(now.getTime() + 5 * 60 * 1000) : trigger

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Patient Follow-up Due',
        body: `${patientLabel} has a follow-up scheduled for today. Check if they have arrived.`,
        data: { type: 'FOLLOW_UP', mrNumber },
        sound: true,
      },
      trigger: { date: scheduledDate } as any,
    })
    return id
  } catch {
    return null
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    // ignore
  }
}

export async function fireAbnormalLabAlert(
  testName: string,
  value: string,
  unit: string,
  refLow: number | null,
  refHigh: number | null,
  mrNumber: string,
  name: string | null,
): Promise<string | null> {
  try {
    const patientLabel = name ? `${name} (MR# ${mrNumber})` : `MR# ${mrNumber}`
    const numValue = parseFloat(value)
    const isHigh = refHigh !== null && numValue > refHigh
    const isCritical =
      (refHigh !== null && numValue > refHigh * 1.5) ||
      (refLow !== null && numValue < refLow * 0.6)

    const rangeText =
      refLow != null && refHigh != null
        ? ` (Normal: ${refLow}–${refHigh} ${unit})`
        : ''

    const guidance = getLabGuidance(testName, isHigh, isCritical)

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: isCritical
          ? `CRITICAL: ${testName} — Action Required`
          : `Abnormal Lab: ${testName}`,
        body: `${patientLabel}: ${testName} = ${value} ${unit}${rangeText}.\n${guidance}`,
        data: { type: isCritical ? 'CRITICAL_LAB' : 'ABNORMAL_LAB', mrNumber, testName, value },
        sound: true,
      },
      trigger: null, // fire immediately
    })
    return id
  } catch {
    return null
  }
}

export async function scheduleTaskReminder(
  taskTitle: string,
  patientMrNumber: string,
  dueAt: Date,
): Promise<string | null> {
  try {
    // Remind 1 hour before due
    const reminderTime = new Date(dueAt.getTime() - 60 * 60 * 1000)
    const now = new Date()
    if (reminderTime <= now) return null

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Due in 1 Hour',
        body: `"${taskTitle}" for MR# ${patientMrNumber} is due soon.`,
        data: { type: 'TASK_DUE', taskTitle, mrNumber: patientMrNumber },
        sound: true,
      },
      trigger: { date: reminderTime } as any,
    })
    return id
  } catch {
    return null
  }
}
