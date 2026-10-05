import { useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "lecteur" | "editeur" | "admin" | "admin_club" | "coach";

export type UserClub = {
  id: string;
  name: string;
  home_pitch_type: string | null;
};

export type ImpersonatedUser = {
  userId: string;
  name: string;
  roles: Role[];
  coachCategories: string[];
  userClub: UserClub | null;
};

const PREVIEW_KEY = "rugby_preview_lecteur";
const IMPERSONATE_KEY = "rugby_impersonate_user";

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
  const [impersonatedUser, setImpersonatedUserState] = useState<ImpersonatedUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const s = localStorage.getItem(IMPERSONATE_KEY);
      return s ? (JSON.parse(s) as ImpersonatedUser) : null;
    } catch { return null; }
  });

  const setPreviewMode = (val: boolean) => {
    localStorage.setItem(PREVIEW_KEY, String(val));
    setPreviewModeState(val);
  };

  const startImpersonation = (data: ImpersonatedUser) => {
    localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(data));
    setImpersonatedUserState(data);
  };

  const stopImpersonation = () => {
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedUserState(null);
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
  const realIsAdminClub = roles.includes("admin_club");

  // Quand le super admin usurpe un utilisateur, on utilise ses droits
  const isImpersonating = realIsAdmin && impersonatedUser !== null;
  const activeRoles: Role[] = isImpersonating ? impersonatedUser!.roles : roles;
  const activeCoachCategories = isImpersonating ? impersonatedUser!.coachCategories : coachCategories;
  const activeUserClub = isImpersonating ? impersonatedUser!.userClub : userClub;
  const activePreviewMode = isImpersonating ? false : previewMode;

  const isAdmin = activeRoles.includes("admin") && !activePreviewMode;
  const isAdminClub = activeRoles.includes("admin_club") && !activePreviewMode;
  const isCoach = activeRoles.includes("coach") && !activePreviewMode;

  const canEdit = (activeRoles.includes("editeur") || activeRoles.includes("admin") || activeRoles.includes("admin_club")) && !activePreviewMode;

  const canEditTeam = (teamCode: string): boolean => {
    if (activePreviewMode) return false;
    if (activeRoles.includes("editeur") || activeRoles.includes("admin") || activeRoles.includes("admin_club")) return true;
    if (activeRoles.includes("coach")) return activeCoachCategories.includes(teamCode);
    return false;
  };

  const highestRole: Role = isAdmin
    ? "admin"
    : isAdminClub
      ? "admin_club"
      : activeRoles.includes("editeur")
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
    isAdminClub,
    canEdit,
    canEditTeam,
    highestRole,
    isPending,
    previewMode: activePreviewMode,
    setPreviewMode,
    realIsAdmin,
    realIsAdminClub,
    isCoach,
    coachCategories: activeCoachCategories,
    userClub: activeUserClub,
    impersonatedUser,
    startImpersonation,
    stopImpersonation,
    isImpersonating,
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
