import { authenticatedApiRequest, apiRequest } from "./api-client";
export function changePassword(currentPassword: string, password: string) {
  return authenticatedApiRequest<void>("/account/password", { method: "POST", body: JSON.stringify({ currentPassword, password }) });
}
export function changeEmail(email: string, password: string) {
  return authenticatedApiRequest<{ accepted: boolean; debugToken?: string }>("/account/email", { method: "POST", body: JSON.stringify({ email, password }) });
}
export function confirmEmailChange(token: string) {
  return apiRequest<void>("/auth/email-change/confirm", { method: "POST", body: JSON.stringify({ token }) });
}
export function deactivateAccount() {
  return authenticatedApiRequest<void>("/account/deactivate", { method: "POST", body: JSON.stringify({ confirmation: "DEACTIVATE" }) });
}
export function getPreferences() { return authenticatedApiRequest<{ emailNotifications: boolean }>("/account/preferences"); }
export function setEmailNotifications(emailNotifications: boolean) {
  return authenticatedApiRequest<{ emailNotifications: boolean }>("/account/preferences", { method: "PATCH", body: JSON.stringify({ emailNotifications }) });
}
