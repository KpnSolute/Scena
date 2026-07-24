// Read-only listing for the Layout tile editor. There is no Scene-creation
// flow anywhere in this app yet (no page, no domain function beyond this
// listing) — public.scenes may legitimately be empty for a Location. This
// function only reads what already exists; it never fabricates a Scene.

import { requireSupabase } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";
import { requireUuid } from "../shared/validation";
import type { Tables } from "../shared/database.types";

export type Scene = Tables<"scenes">;

export async function listScenes(orgId: string, locationId: string): Promise<Scene[]> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .order("name");
  if (error) throw mapPostgresError(error);
  return data ?? [];
}
