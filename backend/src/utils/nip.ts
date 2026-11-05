export function normalizeNip(value: string): string {
  return value.trim().replace(/[\s-]/g, "");
}

export function isValidNip(value: string): boolean {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const checksum = weights.reduce((sum, weight, index) => sum + weight * Number(value[index]), 0) % 11;
  return checksum !== 10 && checksum === Number(value[9]);
}
