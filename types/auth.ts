export type AccountRole = "USER" | "CLINIC";

export interface AuthAccount {
  id: string;
  email: string;
  role: AccountRole;
  emailVerifiedAt?: string | null;
  profile: Record<string, unknown> | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  account: AuthAccount;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleLoginPayload {
  idToken: string;
}

export interface RegisterUserPayload {
  fullName: string;
  email: string;
  phone: string;
  birthDate?: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterClinicPayload {
  clinicName: string;
  nip: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface ProfileResponse {
  profile: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
    birthDate: string | null;
    emailVerifiedAt?: string | null;
  };
}
