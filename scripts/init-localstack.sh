#!/usr/bin/env bash
# Run once after `docker compose up localstack` to create dev S3 buckets.
set -e

ENDPOINT=http://localhost:4566
AWS="aws --endpoint-url=$ENDPOINT --region us-east-1"

echo "Creating S3 buckets in LocalStack…"
$AWS s3 mb s3://medlog-uploads-dev    2>/dev/null || true
$AWS s3 mb s3://medlog-transcripts-dev 2>/dev/null || true

echo "Setting CORS on upload bucket…"
$AWS s3api put-bucket-cors --bucket medlog-uploads-dev --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["GET","PUT","HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'

echo "LocalStack buckets ready."
