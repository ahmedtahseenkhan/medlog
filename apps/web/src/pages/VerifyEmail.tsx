import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the link.')
      return
    }

    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success')
        setMessage('Email verified successfully. Redirecting to login…')
        setTimeout(() => navigate('/login'), 3000)
      })
      .catch((err: any) => {
        setStatus('error')
        const msg =
          err?.response?.data?.message ??
          'This verification link is invalid or has expired. Please request a new one.'
        setMessage(msg)
      })
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="text-brand-500 w-6 h-6" />
          <span className="text-lg font-semibold">MedLog AI</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email…</h1>
            <p className="text-sm text-gray-500">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Email verified!</h1>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full animate-[progress_3s_linear_forwards]" />
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Verification failed</h1>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <a
              href="/signup"
              className="block w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-sm font-medium transition-colors text-center mb-3"
            >
              Back to Sign Up
            </a>
            <a
              href="/login"
              className="block text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              Go to Login
            </a>
          </>
        )}
      </div>
    </div>
  )
}
