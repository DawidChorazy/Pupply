import { API_BASE_URL } from "@/constants/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, saveAuthTokens } from "./auth-storage";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiRequestOptions extends RequestInit {
  token?: string;
  skipAuthRefresh?: boolean;
}

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  account: { id: string };
};

let refreshPromise: Promise<string | null> | null = null;

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() : null;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        await clearAuthTokens();
        return null;
      }

      const payload = (await response.json()) as RefreshResponse;
      await saveAuthTokens(payload.accessToken, payload.refreshToken, payload.account.id);
      return payload.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const { token, skipAuthRefresh, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(url, {
    ...fetchOptions,
    headers
  });

  if (response.status === 401 && token && !skipAuthRefresh) {
    const renewedAccessToken = await refreshAccessToken();
    if (renewedAccessToken) {
      headers.set("Authorization", `Bearer ${renewedAccessToken}`);
      response = await fetch(url, { ...fetchOptions, headers });
    }
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "Request failed";

    const code = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : undefined;

    throw new ApiError(message, response.status, code, payload);
  }

  return payload as T;
}

export async function authenticatedApiRequest<T>(path: string, options: Omit<ApiRequestOptions, "token"> = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ApiError("Zaloguj się ponownie", 401, "AUTH_REQUIRED");
  return apiRequest<T>(path, { ...options, token: accessToken });
}
