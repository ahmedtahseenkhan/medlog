import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native'
import { Audio } from 'expo-av'
import { api } from '../../lib/api'

type RecordState = 'idle' | 'recording' | 'stopped' | 'transcribing' | 'done'

interface Props {
  patientId: string
  soapField?: 'subjective' | 'objective' | 'assessment' | 'plan'
  onTranscript: (text: string) => void
  onClose: () => void
}

export function VoiceRecorder({ patientId, soapField, onTranscript, onClose }: Props) {
  const [state, setState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [transcript, setTranscript] = useState('')
  const recordingRef = useRef<Audio.Recording | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Pulse animation when recording
  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [state, pulseAnim])

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) { Alert.alert('Microphone access required'); return }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      setState('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch {
      Alert.alert('Error', 'Could not start recording')
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return
    if (timerRef.current) clearInterval(timerRef.current)

    await recordingRef.current.stopAndUnloadAsync()
    const uri = recordingRef.current.getURI()
    recordingRef.current = null
    setState('stopped')

    if (!uri) return
    await transcribeAudio(uri)
  }

  async function transcribeAudio(uri: string) {
    setState('transcribing')
    try {
      // 1. Get presigned upload URL
      const { data: urlData } = await api.post<{ data: { uploadUrl: string; s3Key: string; s3Bucket: string } }>(
        '/voice/upload-url', { patientId }
      )

      // 2. Upload audio to S3
      const blob = await (await fetch(uri)).blob()
      await fetch(urlData.data.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'audio/m4a' } })

      // 3. Start transcription
      const { data: jobData } = await api.post<{ data: { jobName: string } }>('/voice/transcribe', {
        s3Key: urlData.data.s3Key,
        s3Bucket: urlData.data.s3Bucket,
        patientId,
      })

      // 4. Poll until done (simple approach — use WebSocket in production)
      let attempts = 0
      let resultText = ''
      while (attempts < 30) {
        await delay(4000)
        const { data: result } = await api.get<{ data: { status: string; transcript: string } }>(
          `/voice/result/${jobData.data.jobName}`
        )
        if (result.data.status === 'COMPLETED') { resultText = result.data.transcript; break }
        if (result.data.status === 'FAILED') break
        attempts++
      }

      setTranscript(resultText || '')
      setState('done')
    } catch {
      Alert.alert('Transcription failed', 'Please try again or type manually')
      setState('idle')
    }
  }

  function confirm() {
    onTranscript(transcript)
    onClose()
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {soapField ? `Recording — ${soapField}` : 'Voice note'}
      </Text>

      {/* Waveform / status visual */}
      <View style={styles.visualArea}>
        {state === 'recording' ? (
          <Animated.View style={[styles.pulse, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.mic} />
          </Animated.View>
        ) : state === 'transcribing' ? (
          <Text style={styles.statusText}>Transcribing with AWS Medical AI…</Text>
        ) : state === 'done' ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Transcript</Text>
            <Text style={styles.transcriptText}>{transcript || '(No speech detected)'}</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>Tap record to start</Text>
        )}
      </View>

      {state === 'recording' && (
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {(state === 'idle' || state === 'done') && state !== 'done' && (
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <View style={styles.recordDot} />
          </TouchableOpacity>
        )}

        {state === 'recording' && (
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
            <View style={styles.stopSquare} />
          </TouchableOpacity>
        )}

        {state === 'done' && (
          <>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setState('idle')}>
              <Text style={styles.retryText}>Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={!transcript}>
              <Text style={styles.confirmText}>Use transcript</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 24, justifyContent: 'space-between' },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: '600', textAlign: 'center', paddingTop: 8 },
  visualArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pulse: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1D9E7540', justifyContent: 'center', alignItems: 'center' },
  mic: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D9E75' },
  statusText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
  timer: { color: '#1D9E75', fontSize: 32, fontFamily: 'monospace', textAlign: 'center', marginBottom: 12 },
  transcriptBox: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, width: '100%' },
  transcriptLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  transcriptText: { color: '#F3F4F6', fontSize: 15, lineHeight: 22 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  cancelText: { color: '#6B7280', fontSize: 14 },
  recordBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  recordDot: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#EF4444' },
  stopBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  stopSquare: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EF4444' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#374151' },
  retryText: { color: '#9CA3AF', fontSize: 14 },
  confirmBtn: { backgroundColor: '#1D9E75', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
