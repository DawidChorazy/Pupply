import { ApiError } from "@/services/api-client";
import { registerClinic, registerUser } from "@/services/auth-service";
import { saveAuthTokens } from "@/services/auth-storage";
import { useState } from "react";
import { validateForm } from "./validation";

function normalizeBirthDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = /^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/.exec(trimmed);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

function formatApiError(error: ApiError) {
  const payload = error.details;

  if (payload && typeof payload === "object") {
    const details = (payload as { details?: Record<string, string[]> }).details;
    if (details) {
      const firstKey = Object.keys(details)[0];
      const firstMessage = firstKey ? details[firstKey]?.[0] : undefined;

      if (firstMessage) {
        return firstMessage;
      }
    }
  }

  return error.message || "Rejestracja nie powiodła się";
}

export function useRegisterForm() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phonePrefix: "+48",
    phone: "",
    birthDate: "",
    password: "",
    confirmPassword: "",
    clinicName: "",
    nip: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationType, setRegistrationType] = useState<"user" | "clinic">("user");

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setError("");
    setSuccess("");

    const validationError = validateForm(form, registrationType);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedPhone = form.phone.startsWith("+")
        ? form.phone
        : `${form.phonePrefix}${form.phone}`;
      const normalizedBirthDate = normalizeBirthDate(form.birthDate);

      const response =
        registrationType === "user"
          ? await registerUser({
              fullName: form.fullName.trim(),
              email: form.email.trim().toLowerCase(),
              phone: normalizedPhone,
              birthDate: normalizedBirthDate,
              password: form.password,
              confirmPassword: form.confirmPassword
            })
          : await registerClinic({
              clinicName: form.clinicName.trim(),
              nip: form.nip.trim(),
              email: form.email.trim().toLowerCase(),
              phone: normalizedPhone,
              password: form.password,
              confirmPassword: form.confirmPassword
            });

      await saveAuthTokens(response.accessToken, response.refreshToken);
      setSuccess("Konto utworzone");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(formatApiError(e));
      } else {
        setError("Rejestracja nie powiodła się");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    error,
    success,
    isSubmitting,
    handleChange,
    handleSubmit,
    registrationType,
    setRegistrationType
  };
}