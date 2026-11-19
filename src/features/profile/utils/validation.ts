export function validateProfileForm(
  form: { fullName: string; phone: string; birthDate: string },
  now = new Date()
) {
  const name = form.fullName.trim();
  if (name.length < 2 || name.length > 120)
    return "Imię i nazwisko musi mieć od 2 do 120 znaków.";
  if (!/^\+?[0-9]{9,15}$/.test(form.phone.trim()))
    return "Telefon musi zawierać od 9 do 15 cyfr i może zaczynać się od +.";
  const date = form.birthDate.trim();
  if (date) {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      return "Podaj poprawną datę urodzenia w formacie RRRR-MM-DD.";
    if (parsed > now) return "Data urodzenia nie może być w przyszłości.";
  }
  return "";
}
