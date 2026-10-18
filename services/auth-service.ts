import { API_ENDPOINTS } from "@/constants/api";
import {
  AuthResponse,
  UpdateUserProfilePayload,
  GoogleLoginPayload,
  LoginPayload,
  ProfileResponse,
  RefreshPayload,
  RegisterClinicPayload,
  RegisterUserPayload
} from "@/types/auth";

import { apiRequest, authenticatedApiRequest } from "./api-client";

export function loginUser(payload: LoginPayload) {
  return apiRequest<AuthResponse>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loginWithGoogle(payload: GoogleLoginPayload) {
  return apiRequest<AuthResponse>(API_ENDPOINTS.auth.google, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function registerUser(payload: RegisterUserPayload) {
  return apiRequest<AuthResponse>(API_ENDPOINTS.auth.registerUser, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function registerClinic(payload: RegisterClinicPayload) {
  return apiRequest<AuthResponse>(API_ENDPOINTS.auth.registerClinic, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function refreshSession(payload: RefreshPayload) {
  return apiRequest<AuthResponse>(API_ENDPOINTS.auth.refresh, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMyProfile(accessToken: string) {
  return apiRequest<ProfileResponse>(API_ENDPOINTS.users.me, {
    method: "GET",
    token: accessToken
  });
}

export function logout(refreshToken: string) {
  return apiRequest<void>(API_ENDPOINTS.auth.logout, {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    skipAuthRefresh: true
  });
}

export function logoutAll() {
  return authenticatedApiRequest<void>(API_ENDPOINTS.auth.logoutAll, { method: "POST" });
}

export function updateMyProfile(payload: UpdateUserProfilePayload) {
  return authenticatedApiRequest<ProfileResponse>(API_ENDPOINTS.users.me, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

type ActionResponse = { accepted: boolean; debugToken?: string; delivered?: boolean };
export function requestPasswordReset(email: string) {
  return apiRequest<ActionResponse>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
}
export function resetPassword(token: string, password: string, confirmPassword: string) {
  return apiRequest<void>("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password, confirmPassword }) });
}
export function requestEmailVerification() {
  return authenticatedApiRequest<ActionResponse>("/auth/email-verification/request", { method: "POST" });
}
export function confirmEmailVerification(token: string) {
  return apiRequest<void>("/auth/email-verification/confirm", { method: "POST", body: JSON.stringify({ token }) });
}
