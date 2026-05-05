import {
  TranscribeClient,
  StartMedicalTranscriptionJobCommand,
  GetMedicalTranscriptionJobCommand,
  type MedicalTranscriptionJobStatus,
  type StartMedicalTranscriptionJobCommandInput,
} from '@aws-sdk/client-transcribe'
import { s3 } from './s3Helper.js'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const transcribe = new TranscribeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

const OUTPUT_BUCKET = process.env.AWS_TRANSCRIBE_OUTPUT_BUCKET ?? process.env.AWS_S3_BUCKET ?? 'medlog-uploads-dev'
const MEDICAL_SPECIALTY = 'PRIMARYCARE' as const

export interface TranscribeResult {
  jobName: string
  transcript: string
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS'
}

/**
 * Starts an asynchronous AWS Transcribe Medical job.
 * The audio file must already be in S3.
 */
export async function startTranscriptionJob(s3Key: string, s3Bucket: string): Promise<string> {
  const jobName = `medlog-voice-${Date.now()}`

  const params: StartMedicalTranscriptionJobCommandInput = {
    MedicalTranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    MediaFormat: 'm4a',
    Media: { MediaFileUri: `s3://${s3Bucket}/${s3Key}` },
    OutputBucketName: OUTPUT_BUCKET,
    OutputKey: `transcripts/${jobName}.json`,
    Specialty: MEDICAL_SPECIALTY,
    Type: 'DICTATION',
    Settings: {
      ShowSpeakerLabels: false,
      ChannelIdentification: false,
      ShowAlternatives: false,
    },
  }

  await transcribe.send(new StartMedicalTranscriptionJobCommand(params))
  return jobName
}

/**
 * Polls the Transcribe Medical job until done (max ~2 min) then returns transcript.
 * In production, use an SNS/SQS callback instead of polling.
 */
export async function getTranscriptionResult(jobName: string, maxWaitMs = 120_000): Promise<TranscribeResult> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const { MedicalTranscriptionJob: job } = await transcribe.send(
      new GetMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: jobName })
    )

    const status = job?.TranscriptionJobStatus as string | undefined

    if (status === 'COMPLETED') {
      const outputKey = job?.Transcript?.MedicalTranscriptFileUri?.split('.amazonaws.com/')[1] ?? ''
      const transcript = await fetchTranscriptFromS3(OUTPUT_BUCKET, outputKey)
      return { jobName, transcript, status: 'COMPLETED' }
    }

    if (status === 'FAILED') {
      return { jobName, transcript: '', status: 'FAILED' }
    }

    await delay(4000)
  }

  return { jobName, transcript: '', status: 'IN_PROGRESS' }
}

async function fetchTranscriptFromS3(bucket: string, key: string): Promise<string> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const body = await obj.Body!.transformToString('utf-8')
  const parsed = JSON.parse(body)
  return parsed?.results?.transcripts?.[0]?.transcript ?? ''
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
