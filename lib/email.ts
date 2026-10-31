/** Domain email kantor yang wajib diganti ke alamat pribadi. */
export const COMPANY_EMAIL_DOMAIN = "bmbi.my.id";

/** Client-safe: deteksi email pada domain kantor, termasuk subdomainnya. */
export function isCompanyEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  const at = value.lastIndexOf("@");
  if (at < 1) return false;
  const domain = value.slice(at + 1);
  return (
    domain === COMPANY_EMAIL_DOMAIN ||
    domain.endsWith(`.${COMPANY_EMAIL_DOMAIN}`)
  );
}
