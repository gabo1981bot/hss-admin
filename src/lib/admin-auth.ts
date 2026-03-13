import { createClient } from "@/lib/supabase/server";

function parseAdminEmails(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const email = (user.email || "").trim().toLowerCase();
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS);

  if (!email || admins.length === 0 || !admins.includes(email)) {
    throw new Error("FORBIDDEN");
  }

  return { user, email };
}
