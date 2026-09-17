export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 10) return digits;
  throw new Error("Invalid mobile number");
}

export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}
