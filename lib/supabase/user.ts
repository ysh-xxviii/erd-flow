import { cache } from "react";
import { createClient } from "./server";

/**
 * Returns the authenticated user, deduped per request via React cache.
 * The layout and page both call this, but only one network validation runs.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
