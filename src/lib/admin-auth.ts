import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const email = (user.email || "").trim().toLowerCase();

  if (!isAdminEmail(email)) {
    throw new Error("FORBIDDEN");
  }

  return { user, email };
}
