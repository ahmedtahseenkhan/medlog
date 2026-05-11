import { appSchema, tableSchema } from '@nozbe/watermelondb'
import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations'

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'vitals',
          columns: [
            { name: 'patient_id', type: 'string', isIndexed: true },
            { name: 'bp_systolic', type: 'number', isOptional: true },
            { name: 'bp_diastolic', type: 'number', isOptional: true },
            { name: 'heart_rate', type: 'number', isOptional: true },
            { name: 'temperature', type: 'number', isOptional: true },
            { name: 'spo2', type: 'number', isOptional: true },
            { name: 'respiratory_rate', type: 'number', isOptional: true },
            { name: 'recorded_at', type: 'number' },
            { name: 'notes', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'patients',
          columns: [
            { name: 'name', type: 'string', isOptional: true },
            { name: 'phone', type: 'string', isOptional: true },
            { name: 'follow_up_date', type: 'number', isOptional: true },
            { name: 'follow_up_notes', type: 'string', isOptional: true },
            { name: 'follow_up_notif_id', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'notification_id', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'lab_reports',
          columns: [
            { name: 'notification_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
})

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'patients',
      columns: [
        { name: 'mr_number', type: 'string' },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'ward_id', type: 'string', isOptional: true },
        { name: 'bed_number', type: 'string', isOptional: true },
        { name: 'admission_date', type: 'number', isOptional: true },
        { name: 'admission_diagnosis', type: 'string', isOptional: true },
        { name: 'team_id', type: 'string', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'follow_up_date', type: 'number', isOptional: true },
        { name: 'follow_up_notes', type: 'string', isOptional: true },
        { name: 'follow_up_notif_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'clinical_notes',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'content_json', type: 'string' },
        { name: 'is_draft', type: 'boolean' },
        { name: 'author_id', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'local_only', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'priority', type: 'string' },
        { name: 'due_at', type: 'number', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'local_only', type: 'boolean' },
        { name: 'notification_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'lab_reports',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true },
        { name: 'test_name', type: 'string' },
        { name: 'value', type: 'string' },
        { name: 'unit', type: 'string' },
        { name: 'reference_range_low', type: 'number', isOptional: true },
        { name: 'reference_range_high', type: 'number', isOptional: true },
        { name: 'is_abnormal', type: 'boolean' },
        { name: 'is_critical', type: 'boolean' },
        { name: 'reported_at', type: 'number' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'local_only', type: 'boolean' },
        { name: 'notification_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'vitals',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true },
        { name: 'bp_systolic', type: 'number', isOptional: true },
        { name: 'bp_diastolic', type: 'number', isOptional: true },
        { name: 'heart_rate', type: 'number', isOptional: true },
        { name: 'temperature', type: 'number', isOptional: true },
        { name: 'spo2', type: 'number', isOptional: true },
        { name: 'respiratory_rate', type: 'number', isOptional: true },
        { name: 'recorded_at', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
      ],
    }),
  ],
})
