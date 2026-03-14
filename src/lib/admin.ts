function parseAdminEmails(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!email) return false;
  return admins.includes(email.trim().toLowerCase());
}
