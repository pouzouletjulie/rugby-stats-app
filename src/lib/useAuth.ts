import { useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "lecteur" | "editeur" | "admin" | "coach";

export type UserClub = {
  id: string;
  name: string;
  home_pitch_type: string | null;
};

const PREVIEW_KEY = "rugby_preview_lecteur";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachCategories, setCoachCategories] = useState<string[]>([]);
  const [userClub, setUserClub] = useState<UserClub | null>(null);
  const [previewMode, setPreviewModeState] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(PREVIEW_KEY) === "true",
  );

  const setPreviewMode = (val: boolean) => {
    localStorage.setItem(PREVIEW_KEY, String(val));
    setPreviewModeState(val);
  };

  async function fetchUserData(userId: string) {
    const [{ data: rolesData }, { data: profileData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("profiles") as any).select("club_id").eq("id", userId).single(),
    ]);

    const userRoles = (rolesData ?? []).map((r) => r.role as Role);
    setRoles(userRoles);

    const clubId = profileData?.club_id as string | null | undefined;
    if (clubId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: clubData } = await (supabase.from("clubs") as any)
        .select("id, name, home_pitch_type")
        .eq("id", clubId)
        .single();
      if (clubData) setUserClub(clubData as UserClub);
    }

    if (userRoles.includes("coach")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cats } = await (supabase.from("coach_categories") as any)
        .select("team_code")
        .eq("user_id", userId);
      setCoachCategories((cats ?? []).map((c: { team_code: string }) => c.team_code));
    }

    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchUserData(s.user.id);
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
        void fetchUserData(s.user.id);
      } else {
        setRoles([]);
        setCoachCategories([]);
        setUserClub(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const realIsAdmin = roles.includes("admin");
  const isAdmin = realIsAdmin && !previewMode;
  const isCoach = roles.includes("coach") && !previewMode;
  const canEdit = (roles.includes("editeur") || realIsAdmin) && !previewMode;

  const canEditTeam = (teamCode: string): boolean => {
    if (previewMode) return false;
    if (roles.includes("editeur") || realIsAdmin) return true;
    if (roles.includes("coach")) return coachCategories.includes(teamCode);
    return false;
  };

  const highestRole: Role = isAdmin
    ? "admin"
    : roles.includes("editeur")
      ? "editeur"
      : isCoach
        ? "coach"
        : "lecteur";
  const isPending = !loading && !!user && roles.length === 0;

  return {
    session,
    user,
    roles,
    loading,
    isAdmin,
    canEdit,
    canEditTeam,
    highestRole,
    isPending,
    previewMode,
    setPreviewMode,
    realIsAdmin,
    isCoach,
    coachCategories,
    userClub,
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
