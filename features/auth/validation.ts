export function validateForm(form: any, type: "user" | "clinic") {
  if (!form.email.trim()) return "Email wymagany";

  if (form.password.length < 8)
    return "Hasło musi mieć min. 8 znaków";

  if (form.password !== form.confirmPassword)
    return "Hasła nie są takie same";

  if (type === "user" && !form.fullName.trim())
    return "Imię i nazwisko wymagane";

  if (type === "user" && form.birthDate.trim()) {
    const value = form.birthDate.trim();
    const isDotFormat = /^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/.test(value);
    const isIsoFormat = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);

    if (!isDotFormat && !isIsoFormat) {
      return "Data urodzenia musi mieć format DD.MM.RRRR";
    }
  }

  if (type === "clinic") {
    if (!form.clinicName.trim()) return "Nazwa kliniki wymagana";
    if (!/^\d{10}$/.test(form.nip)) return "Zły NIP";
  }

  return null;
}