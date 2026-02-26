export interface User {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'member'
}

export interface AuthResponse {
  token: string
  user: User
}

export interface AuthStatus {
  setupRequired: boolean
}

export interface InviteCode {
  code: string
  created_by: number
  used_by: number | null
  created_at: string
  used_at: string | null
}
