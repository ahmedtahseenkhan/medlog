import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema, migrations } from './schema'
import { Patient } from './models/Patient'
import { ClinicalNote } from './models/ClinicalNote'
import { Task } from './models/Task'
import { LabReport } from './models/LabReport'
import { Vitals } from './models/Vitals'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'medlog',
  // jsi: true requires a native dev build — omit for Expo Go compatibility
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Patient, ClinicalNote, Task, LabReport, Vitals],
})
