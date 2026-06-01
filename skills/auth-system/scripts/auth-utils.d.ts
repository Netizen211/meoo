export interface AuthResult {
  user: any | null;
  session: any | null;
  profile: any | null;
  error: any | null;
}

export function registerUser(email: string, password: string, metadata?: Record<string, any>): Promise<{ user: any | null; error: any | null }>;
export function loginUser(email: string, password: string): Promise<{ session: any | null; error: any | null }>;
export function logoutUser(): Promise<{ error: any | null }>;
export function getCurrentUser(): Promise<{ user: any | null; profile: any | null; error: any | null }>;
export function updateUserProfile(userId: string, updates: Record<string, any>): Promise<{ profile: any | null; error: any | null }>;
export function resetPassword(email: string): Promise<{ error: any | null }>;
export function updatePassword(newPassword: string): Promise<{ error: any | null }>;
