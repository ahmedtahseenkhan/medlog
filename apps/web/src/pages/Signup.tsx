import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Eye, EyeOff, CheckCircle, Mail, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

type Role = 'CONSULTANT' | 'RESIDENT' | 'INTERN'

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'CONSULTANT', label: 'Consultant', description: 'Senior doctor, full access' },
  { value: 'RESIDENT', label: 'Resident', description: 'Registrar/resident, standard access' },
  { value: 'INTERN', label: 'Intern / HO', description: 'House officer, supervised access' },
]

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: '', color: '', width: '0%' }
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  const score = [password.length >= 8, password.length >= 12, hasLower && hasUpper, hasNumber, hasSpecial].filter(Boolean).length
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' }
  if (score <= 3) return { label: 'Fair', color: 'bg-amber-500', width: '66%' }
  return { label: 'Strong', color: 'bg-emerald-500', width: '100%' }
}

export default function SignupPage() {
  // Step 1 fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('INTERN')
  const [agreed, setAgreed] = useState(false)

  const [verifyCode, setVerifyCode] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!agreed) { setError('You must agree to the data policy to continue.'); return }
    setLoading(true)
    try {
      await api.post('/auth/signup', { name, email, password, role, verifyCode })
      setStep(2)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Activity className="text-brand-500 w-6 h-6" />
          <span className="text-lg font-semibold">MedLog AI</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h1>
            <p className="text-sm text-gray-500 mb-6">Join MedLog AI — Clinical Documentation Platform</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Dr. Jane Smith"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="you@hospital.org"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-gray-500">
                      Password strength: <span className="font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className="space-y-2">
                  {ROLES.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        role === r.value
                          ? 'border-brand-500 bg-sky-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                        className="mt-0.5 accent-sky-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.label}</p>
                        <p className="text-xs text-gray-500">{r.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Verification code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="Enter code (use 0000)"
                  maxLength={10}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 tracking-widest text-center font-mono text-lg"
                />
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mt-1">
                  Dev mode: enter <strong>0000</strong> to create your account instantly.
                </p>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-sky-500 flex-shrink-0"
                />
                <span className="text-xs text-gray-600">
                  I agree to use this system in compliance with hospital data policies and applicable patient privacy regulations.
                </span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p className="text-sm text-center text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          /* Step 2 — Check your email */
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-brand-500" />
              </div>
            </div>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2 text-center">Account created!</h1>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Your MedLog AI account is ready. Sign in to get started.
            </p>
            <Link
              to="/login"
              className="block w-full bg-brand-500 hover:bg-brand-600 text-white text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
