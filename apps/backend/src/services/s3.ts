import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  // In dev with LocalStack, override the endpoint:
  ...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT, forcePathStyle: true } : {}),
})

const BUCKET = process.env.AWS_S3_BUCKET ?? 'medlog-uploads-dev'

export async function generateUploadPresignedUrl(opts: {
  patientId: string
  modality: string
  contentType: string
  filename: string
}) {
  const key = `radiology/${opts.patientId}/${randomUUID()}-${opts.filename}`

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: opts.contentType,
    Metadata: {
      patientId: opts.patientId,
      modality: opts.modality,
    },
    // Enforce max 50MB upload
    ContentLength: undefined,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 300 }) // 5 min
  return { url, key, bucket: BUCKET }
}

export async function generateViewPresignedUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour
}

export async function deleteS3Object(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
