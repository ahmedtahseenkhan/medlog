import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Activity, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import type { User } from '@medlog/types'

export default function LoginPage({ timeoutMessage }: { timeoutMessage?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState(timeoutMessage ?? '')
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEmailNotVerified(false)
    setResendMessage('')
    setLoading(true)
    try {
      const { data } = await api.post<
        | { mfaRequired: true; mfaToken: string }
        | { accessToken: string; refreshToken: string; user: User }
      >('/auth/login', { email, password })

      if ('mfaRequired' in data && data.mfaRequired) {
        setMfaToken(data.mfaToken)
        setMfaRequired(true)
        return
      }

      if ('accessToken' in data) {
        setAuth(data.accessToken, data.refreshToken, data.user)
        navigate('/')
      }
    } catch (err: any) {
      const responseData = err?.response?.data
      if (responseData?.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true)
        setError(responseData.message)
      } else {
        setError('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        '/mfa/challenge',
        { mfaToken, totpCode }
      )
      setAuth(data.accessToken, data.refreshToken, data.user)
      navigate('/')
    } catch {
      setError('Invalid authentication code')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    setResendLoading(true)
    setResendMessage('')
    try {
      await api.post('/auth/resend-verification', { email })
      setResendMessage('Verification email resent. Please check your inbox.')
    } catch {
      setResendMessage('Could not resend at this time. Please try again shortly.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-8">
          <Activity className="text-brand-500 w-6 h-6" />
          <span className="text-lg font-semibold">MedLog AI</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">
          {mfaRequired ? 'Two-factor authentication' : 'Sign in'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {mfaRequired ? 'Enter the 6-digit code from your authenticator app' : 'Clinical documentation platform'}
        </p>

        {mfaRequired ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setMfaRequired(false); setMfaToken(''); setTotpCode('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="you@hospital.org"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className={`text-sm px-3 py-2 rounded-lg ${error.includes('expired') ? 'text-amber-700 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
                {error}
              </p>
            )}

            {/* Resend verification prompt */}
            {emailNotVerified && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="flex items-center justify-center gap-2 w-full border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </button>
                {resendMessage && (
                  <p className="text-xs text-center text-gray-600">{resendMessage}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {!mfaRequired && (
          <p className="text-sm text-center text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-500 hover:text-brand-600 font-medium">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
