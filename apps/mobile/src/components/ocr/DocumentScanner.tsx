import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../../lib/api'

interface Props {
  patientId: string
  onResult: (data: { imageId: string; fields: object[]; overallConfidence: number; needsReview: boolean; rawText: string }) => void
  onClose: () => void
}

export function DocumentScanner({ patientId, onResult, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'capture' | 'preview'>('capture')
  const [capturedUri, setCapturedUri] = useState<string | null>(null)
  const cameraRef = useRef<CameraView>(null)

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is required to scan documents</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  async function capture() {
    if (!cameraRef.current) return
    const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false })!

    // Pre-process: auto-crop to document bounds, enhance contrast, normalise brightness
    const processed = await ImageManipulator.manipulateAsync(
      photo.uri,
      [
        { resize: { width: 2048 } }, // cap resolution for Textract
        { crop: deriveDocumentCrop(photo.width, photo.height) },
      ],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    )

    setCapturedUri(processed.uri)
    setStep('preview')
  }

  async function analyse() {
    if (!capturedUri) return
    setProcessing(true)
    try {
      // 1. Upload to S3 via presigned URL
      const { data: urlData } = await api.post<{ data: { uploadUrl: string; imageId: string } }>('/radiology/upload-url', {
        patientId,
        modality: 'OTHER',
        contentType: 'image/jpeg',
        filename: `scan-${Date.now()}.jpg`,
        bodyPart: 'Document',
      })

      const blob = await (await fetch(capturedUri)).blob()
      await fetch(urlData.data.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })
      await api.post(`/radiology/${urlData.data.imageId}/confirm`)

      // 2. Run OCR
      const { data: ocrData } = await api.post<{ data: object }>('/ocr/analyse', {
        imageId: urlData.data.imageId,
        patientId,
      })

      onResult(ocrData.data as Parameters<typeof onResult>[0])
    } catch {
      Alert.alert('Error', 'Failed to analyse document. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (step === 'preview' && capturedUri) {
    const { Image } = require('react-native')
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Review capture</Text>
        <Image source={{ uri: capturedUri }} style={styles.preview} resizeMode="contain" />
        <Text style={styles.hint}>Make sure the document is flat, well-lit, and text is legible</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('capture')}>
            <Text style={styles.secondaryText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, processing && styles.btnDisabled]} onPress={analyse} disabled={processing}>
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Extract data</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.hint}>Align the document within the frame</Text>
        </View>
      </CameraView>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shutter} onPress={capture}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        <View style={{ width: 80 }} />
      </View>
    </View>
  )
}

function deriveDocumentCrop(w: number, h: number) {
  // Conservative 5% inset — real apps use edge detection (OpenCV / VisionKit)
  const margin = 0.05
  return { originX: w * margin, originY: h * margin, width: w * (1 - 2 * margin), height: h * (1 - 2 * margin) }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#111' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: '85%', aspectRatio: 1.414, borderWidth: 2, borderColor: '#1D9E75', borderRadius: 8 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: '#000' },
  shutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  preview: { flex: 1, margin: 16, borderRadius: 12 },
  hint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', margin: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', paddingTop: 16 },
  row: { flexDirection: 'row', gap: 12, padding: 20 },
  btn: { flex: 1, backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: '#374151', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#9CA3AF', fontSize: 15 },
  permText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
})
