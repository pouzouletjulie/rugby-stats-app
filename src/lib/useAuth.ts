import { useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "lecteur" | "editeur" | "admin";

const PREVIEW_KEY = "rugby_preview_lecteur";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewModeState] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(PREVIEW_KEY) === "true",
  );

  const setPreviewMode = (val: boolean) => {
    localStorage.setItem(PREVIEW_KEY, String(val));
    setPreviewModeState(val);
  };

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as Role));
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchRoles(s.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchRoles(s.user.id);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const realIsAdmin = roles.includes("admin");
  const isAdmin = realIsAdmin && !previewMode;
  const canEdit = (roles.includes("editeur") || realIsAdmin) && !previewMode;
  const highestRole: Role = isAdmin ? "admin" : canEdit ? "editeur" : "lecteur";
  const isPending = !loading && !!user && roles.length === 0;

  return {
    session, user, roles, loading,
    isAdmin, canEdit, highestRole,
    isPending, previewMode, setPreviewMode, realIsAdmin,
  };
}

export async function logAudit(params: {
  action: string;
  entity: string;
  entityId?: string | null;
  matchId?: string | null;
  details?: Record<string, unknown>;
}) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({
    actor_id: data.user.id,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    match_id: params.matchId ?? null,
    details: (params.details ?? {}) as never,
  });
}
