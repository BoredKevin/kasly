export const DEFAULT_WA_TEMPLATE =
  "{regLink}\n\nKlik link diatas untuk masuk {orgName} di platform Kasly. Dari platform ini, kamu bisa melihat tunggakan kas, serta buku besar/histori pengeluaran kas kelas melalui Ledger.\n\nDaftar dengan mengisi NISN, tahun lahir, serta nomor handphone, lalu masukkan email dan password, jangan dilupakan ya!";

export const SHORT_WA_TEMPLATE =
  "Halo {name}! Silakan klaim akun kamu di {orgName} melalui tautan pendaftaran berikut: {regLink}\n\nMasukkan NISN, tahun lahir, dan no. HP untuk verifikasi.";

export const ENGLISH_WA_TEMPLATE =
  "Hello {name}! Claim your account in {orgName} on Kasly: {regLink}\n\nVerify with your NISN, birth year, and phone number to activate your account.";

export function getRegistrationUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/claim?token=${token}`;
  }
  return `/claim?token=${token}`;
}

export function normalizePhoneNumberClient(phone?: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "").trim();
  if (digits.startsWith("08")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  } else if (digits.startsWith("6208")) {
    digits = "62" + digits.slice(3);
  }
  return digits;
}

export function formatWhatsAppMessage({
  studentName,
  token,
  orgName,
  templateText,
}: {
  studentName: string;
  token: string;
  orgName: string;
  templateText: string;
}): string {
  const regUrl = getRegistrationUrl(token);
  return templateText
    .replace(/{name}/g, studentName)
    .replace(/{orgName}/g, orgName)
    .replace(/{regLink}/g, regUrl);
}
