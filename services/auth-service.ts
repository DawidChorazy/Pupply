import { API_ENDPOINTS } from "@/constants/api";
import {
  AuthResponse,
  GoogleLoginPayload,
  LoginPayload,
  ProfileResponse,
  RefreshPayload,
  RegisterClinicPayload,
  RegisterUserPayload
} from "@/types/auth";

import { apiRequest } from "./api-client";

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
