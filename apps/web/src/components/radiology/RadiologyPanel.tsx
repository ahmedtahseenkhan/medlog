import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Eye, Trash2, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import type { ApiResponse } from '@medlog/types'

interface RadiologyImage {
  id: string
  modality: string
  bodyPart?: string
  uploadedAt: string
  metadata?: { filename?: string; contentType?: string; status?: string }
}

const MODALITIES = ['X-RAY', 'CT', 'MRI', 'ULTRASOUND', 'OTHER']
const modalityColor: Record<string, 'blue' | 'purple' | 'amber' | 'green' | 'gray'> = {
  'X-RAY': 'blue', CT: 'purple', MRI: 'amber', ULTRASOUND: 'green', OTHER: 'gray',
}

export function RadiologyPanel({ patientId }: { patientId: string }) {
  const [showUpload, setShowUpload] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['radiology', patientId],
    queryFn: () => api.get<ApiResponse<RadiologyImage[]>>(`/radiology/patient/${patientId}`).then((r) => r.data),
  })

  const deleteImage = useMutation({
    mutationFn: (id: string) => api.delete(`/radiology/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radiology', patientId] }),
  })

  const images = (data?.data ?? []).filter((img) => img.metadata?.status === 'confirmed')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Radiology</h3>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="w-3.5 h-3.5" /> Upload
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-400">No images uploaded</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img) => (
            <div key={img.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={modalityColor[img.modality] ?? 'gray'}>{img.modality}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => setViewingId(img.id)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteImage.mutate(img.id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs truncate">{img.metadata?.filename ?? 'Image'}</span>
              </div>
              {img.bodyPart && <p className="text-xs text-gray-400 mt-0.5">{img.bodyPart}</p>}
              <p className="text-xs text-gray-300 mt-1">{format(new Date(img.uploadedAt), 'dd MMM yyyy')}</p>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          patientId={patientId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['radiology', patientId] }) }}
        />
      )}
      {viewingId && <ImageViewerModal imageId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  )
}

function UploadModal({ patientId, onClose, onSuccess }: { patientId: string; onClose: () => void; onSuccess: () => void }) {
  const [modality, setModality] = useState('X-RAY')
  const [bodyPart, setBodyPart] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'confirming' | 'done'>('idle')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setProgress('uploading')
    setError('')
    try {
      // 1. Get presigned URL
      const { data } = await api.post<{ data: { uploadUrl: string; imageId: string } }>('/radiology/upload-url', {
        patientId,
        modality,
        contentType: file.type || 'image/jpeg',
        filename: file.name,
        bodyPart: bodyPart || undefined,
      })

      // 2. PUT directly to S3
      await fetch(data.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      })

      // 3. Confirm
      setProgress('confirming')
      await api.post(`/radiology/${data.data.imageId}/confirm`)
      setProgress('done')
      onSuccess()
    } catch (e) {
      setError('Upload failed — check file type and size (max 50MB)')
      setProgress('idle')
    }
  }

  return (
    <Modal title="Upload radiology image" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Modality</label>
          <select value={modality} onChange={(e) => setModality(e.target.value)} className={inputCls}>
            {MODALITIES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Body part</label>
          <input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} className={inputCls} placeholder="e.g. Chest, Abdomen" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">File</label>
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            {file ? (
              <p className="text-sm text-gray-700 font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-400">Click to select image (JPEG, PNG, DICOM)</p>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/dicom,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={!file || progress !== 'idle'}
            loading={progress === 'uploading' || progress === 'confirming'}
            onClick={handleUpload}
          >
            {progress === 'uploading' ? 'Uploading…' : progress === 'confirming' ? 'Saving…' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ImageViewerModal({ imageId, onClose }: { imageId: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)

  const { data, isLoading } = useQuery({
    queryKey: ['radiology-url', imageId],
    queryFn: () => api.get<{ data: { viewUrl: string } }>(`/radiology/${imageId}/view-url`).then((r) => r.data),
    staleTime: 50 * 60 * 1000, // 50 min — URL valid for 1h
  })

  return (
    <Modal title="Image viewer" onClose={onClose} size="xl">
      <div className="space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
          <label className="flex items-center gap-2 text-xs text-gray-600 min-w-0 flex-1">
            Zoom
            <input type="range" min="0.5" max="3" step="0.1" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right">{scale.toFixed(1)}×</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 min-w-0 flex-1">
            Brightness
            <input type="range" min="50" max="200" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="flex-1" />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 min-w-0 flex-1">
            Contrast
            <input type="range" min="50" max="200" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="flex-1" />
          </label>
        </div>

        {/* Viewer */}
        <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 360 }}>
          {isLoading ? (
            <div className="text-white text-sm">Loading image…</div>
          ) : data?.data.viewUrl ? (
            <div className="overflow-auto max-h-96 cursor-crosshair">
              <img
                src={data.data.viewUrl}
                alt="Radiology"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center top',
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  display: 'block',
                  maxWidth: '100%',
                  transition: 'transform 0.1s',
                }}
              />
            </div>
          ) : (
            <div className="text-gray-400 text-sm">Image unavailable</div>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center">
          For diagnostic DICOM viewing, open in a dedicated DICOM workstation.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { setScale(1); setBrightness(100); setContrast(100) }}>Reset</Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
