import { useNavigate } from 'react-router-dom'
import { useInactivityLock } from '../../hooks/useInactivityLock'

/**
 * Drop this inside the authenticated route tree.
 * It watches for 5 min inactivity and redirects to /login.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  useInactivityLock(() => {
    navigate('/login?reason=timeout', { replace: true })
  })

  return <>{children}</>
}
