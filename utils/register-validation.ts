import { polishDateToIso } from "@/utils/input-masks";

export function validateForm(form: any, type: "user" | "clinic") {
  if (!form.email.trim()) return "Email wymagany";

  if (form.password.length < 8)
    return "Hasło musi mieć min. 8 znaków";

  if (form.password !== form.confirmPassword)
    return "Hasła nie są takie same";

  if (type === "user" && !form.fullName.trim())
    return "Imię i nazwisko wymagane";

  if (type === "user" && form.birthDate.trim()) {
    const isoDate = polishDateToIso(form.birthDate);
    if (!isoDate) return "Podaj prawidłową datę urodzenia w formacie DD.MM.RRRR";
    if (new Date(`${isoDate}T00:00:00`) > new Date()) return "Data urodzenia nie może być w przyszłości";
  }

  if (type === "clinic") {
    if (!form.clinicName.trim()) return "Nazwa kliniki wymagana";
    if (!/^\d{10}$/.test(form.nip)) return "Zły NIP";
  }

  return null;
}
