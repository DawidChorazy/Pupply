function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function formatPolishDateInput(value: string) {
  const digits = digitsOnly(value, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function formatPolishDateTimeInput(value: string) {
  const digits = digitsOnly(value, 12);
  const date = formatPolishDateInput(digits.slice(0, 8));
  if (digits.length <= 8) return date;
  if (digits.length <= 10) return `${date} ${digits.slice(8)}`;
  return `${date} ${digits.slice(8, 10)}:${digits.slice(10)}`;
}

function parseDateParts(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

export function polishDateToIso(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function polishDateTimeToIso(value: string) {
  const match = /^(\d{2}\.\d{2}\.\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const parts = parseDateParts(match[1]);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (!parts || hours > 23 || minutes > 59) return null;

  const date = new Date(parts.year, parts.month - 1, parts.day, hours, minutes);
  return date.toISOString();
}
