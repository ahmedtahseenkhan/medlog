export type UserRole = 'CONSULTANT' | 'RESIDENT' | 'INTERN' | 'ADMIN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  teamId?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  userId: string
  role: UserRole
  teamId?: string
  expiresAt: string
}
