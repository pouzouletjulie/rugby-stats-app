import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logAudit, useAuth, type Role, type UserClub } from "@/lib/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Championship, COMPETITION_TYPES, TEAMS, teamLabel } from "@/lib/rugby";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — AS Meudon Rugby Stats" },
      {
        name: "description",
        content: "Gestion des utilisateurs, des rôles et consultation de l'historique global du club.",
      },
      { property: "og:title", content: "Administration — AS Meudon Rugby Stats" },
      { property: "og:description", content: "Rôles Lecteur, Éditeur, Administrateur et audit." },
    ],
  }),
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Introuvable.</div>,
});

type Club = { id: string; name: string; home_pitch_type: string | null };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "lecteur", label: "Lecteur" },
  { value: "coach", label: "Coach" },
  { value: "editeur", label: "Éditeur" },
  { value: "admin_club", label: "Admin club" },
  { value: "admin", label: "Super Admin" },
];

function AdminPage() {
  const { isAdmin, isAdminClub, user, userClub } = useAuth();
  const canAdmin = isAdmin || isAdminClub;
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [champDialogOpen, setChampDialogOpen] = useState(false);
  const [editingChamp, setEditingChamp] = useState<Championship | null>(null);
  const [champForm, setChampForm] = useState<{
    name: string;
    season: string;
    competition_type: string | null;
    team: string | null;
    active: boolean;
  }>({ name: "", season: "", competition_type: null, team: null, active: true });

  const champsQ = useQuery({
    queryKey: ["championships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Championship[];
    },
  });

  const saveChamp = async () => {
    if (!champForm.name || !champForm.season) return;
    if (editingChamp) {
      const { error } = await supabase
        .from("championships")
        .update({
          name: champForm.name,
          season: champForm.season,
          competition_type: champForm.competition_type,
          team: champForm.team,
          active: champForm.active,
        })
        .eq("id", editingChamp.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Championnat mis à jour");
    } else {
      const { error } = await supabase
        .from("championships")
        .insert({
          name: champForm.name,
          season: champForm.season,
          competition_type: champForm.competition_type,
          team: champForm.team,
          active: champForm.active,
        });
      if (error) { toast.error(error.message); return; }
      toast.success("Championnat créé");
    }
    setChampDialogOpen(false);
    void qc.invalidateQueries({ queryKey: ["championships"] });
  };

  const deleteChamp = async (champId: string) => {
    const { error } = await supabase.from("championships").delete().eq("id", champId);
    if (error) { toast.error(error.message); return; }
    toast.success("Championnat supprimé");
    void qc.invalidateQueries({ queryKey: ["championships"] });
  };

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [
        { data: profiles, error },
        { data: roles },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { data: coachCats },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { data: clubs },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("coach_categories") as any).select("user_id, team_code"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("clubs") as any).select("id, name, home_pitch_type"),
      ]);
      if (error) throw error;
      return {
        users: (profiles ?? []).map((p) => ({
          ...p,
          roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
          coachCategories: (coachCats ?? [])
            .filter((c: { user_id: string }) => c.user_id === p.id)
            .map((c: { team_code: string }) => c.team_code) as string[],
        })),
        clubs: (clubs ?? []) as Club[],
      };
    },
  });

  const auditQ = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setRole = async (userId: string, role: Role) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const rows: { user_id: string; role: Role }[] = [{ user_id: userId, role }];
    if (role === "admin") rows.push({ user_id: userId, role: "editeur" });
    if (role === "admin_club") rows.push({ user_id: userId, role: "editeur" });
    if (role !== "coach") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("coach_categories") as any).delete().eq("user_id", userId);
    }
    const { error } = await supabase.from("user_roles").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "changement de rôle",
      entity: "user_roles",
      entityId: userId,
      details: { role },
    });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["admin-audit"] });
    toast.success("Rôle mis à jour");
  };

  const saveCoachCats = async (userId: string, categories: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("coach_categories") as any).delete().eq("user_id", userId);
    if (categories.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("coach_categories") as any).insert(
        categories.map((c) => ({ user_id: userId, team_code: c })),
      );
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Catégories mises à jour");
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const setClub = async (userId: string, clubId: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ club_id: clubId === "__none__" ? null : clubId })
      .eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Club mis à jour");
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const claimFirstAdmin = async () => {
    setClaiming(true);
    const { error } = await supabase.rpc("claim_first_admin");
    setClaiming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vous êtes maintenant administrateur.");
    window.location.reload();
  };

  if (!canAdmin) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Cette section est réservée aux administrateurs.
            </p>
            <Button onClick={claimFirstAdmin} disabled={claiming} variant="default">
              {claiming ? "En cours…" : "Devenir premier administrateur"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Ce bouton ne fonctionne que si aucun administrateur n'existe encore.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const allUsers = usersQ.data?.users ?? [];
  const clubs = usersQ.data?.clubs ?? [];

  // Admin club voit uniquement les utilisateurs de son club
  const visibleUsers = isAdmin
    ? allUsers
    : allUsers.filter((u) => (u as { club_id?: string | null }).club_id === (userClub as UserClub | null)?.id);

  const pendingUsers = visibleUsers.filter((u) => u.roles.length === 0);
  const activeUsers = visibleUsers.filter((u) => u.roles.length > 0);

  // Admin club ne peut pas assigner super admin
  const availableRoles = isAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r.value !== "admin");

  return (
    <AppShell>
      <h1 className="text-3xl font-bold uppercase">Administration</h1>

      {pendingUsers.length > 0 && (
        <Card className="mt-6 border-amber-300">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              Inscriptions en attente
              <Badge variant="default" className="bg-amber-500">{pendingUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" onClick={() => setRole(u.id, "lecteur")}>
                  Lecteur
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRole(u.id, "coach")}>
                  Coach
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRole(u.id, "editeur")}>
                  Éditeur
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setRole(u.id, "admin_club")}>
                    Admin club
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="uppercase">Utilisateurs et rôles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeUsers.map((u) => {
            const current: Role = u.roles.includes("admin")
              ? "admin"
              : u.roles.includes("admin_club")
                ? "admin_club"
                : u.roles.includes("editeur")
                  ? "editeur"
                  : u.roles.includes("coach")
                    ? "coach"
                    : "lecteur";
            const isCoachUser = current === "coach";
            return (
              <div key={u.id} className="rounded-md border px-3 py-2 space-y-2">
                {/* Ligne 1 : identité + rôle */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-48 flex-1">
                    <p className="text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.id === user?.id && <Badge variant="secondary">Vous</Badge>}
                  <Select value={current} onValueChange={(v) => setRole(u.id, v as Role)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Ligne 2 : club */}
                <div className="flex items-center gap-2 border-t pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                    Club
                  </span>
                  <Select
                    value={(u as { club_id?: string | null }).club_id ?? "__none__"}
                    onValueChange={(v) => setClub(u.id, v)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Aucun club" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucun club —</SelectItem>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Ligne 3 : catégories coach */}
                {isCoachUser && (
                  <div className="pl-1 pt-1 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Catégories gérées
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TEAMS.map((t) => {
                        const checked = u.coachCategories.includes(t.value);
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? u.coachCategories.filter((c) => c !== t.value)
                                : [...u.coachCategories, t.value];
                              void saveCoachCats(u.id, next);
                            }}
                            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent/10"
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {activeUsers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun utilisateur actif.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="uppercase">Championnats</CardTitle>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setChampForm({ name: "", season: "", competition_type: null, team: null, active: true });
                setEditingChamp(null);
                setChampDialogOpen(true);
              }}
            >
              Ajouter un championnat
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {champsQ.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!(champsQ.data ?? []).length && !champsQ.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun championnat.</p>
          )}
          {(champsQ.data ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">
                  {c.name}{" "}
                  <span className="text-muted-foreground">({c.season})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.competition_type, c.team ? teamLabel(c.team) : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              {c.active ? (
                <Badge variant="default">Actif</Badge>
              ) : (
                <Badge variant="secondary">Inactif</Badge>
              )}
              {isAdmin && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setChampForm({
                        name: c.name,
                        season: c.season,
                        competition_type: c.competition_type,
                        team: c.team,
                        active: c.active,
                      });
                      setEditingChamp(c);
                      setChampDialogOpen(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteChamp(c.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="uppercase">Historique global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {!(auditQ.data ?? []).length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune entrée.</p>
          )}
          {(auditQ.data ?? []).map((a) => (
            <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{a.action}</span>{" "}
              <span className="text-muted-foreground">
                · {a.entity} · {new Date(a.created_at).toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={champDialogOpen} onOpenChange={(o) => !o && setChampDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingChamp ? "Modifier le championnat" : "Ajouter un championnat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="champ-name">Nom *</Label>
              <Input
                id="champ-name"
                placeholder="Fédérale 3"
                required
                value={champForm.name}
                onChange={(e) => setChampForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="champ-season">Saison *</Label>
              <Input
                id="champ-season"
                placeholder="2026-2027"
                required
                value={champForm.season}
                onChange={(e) => setChampForm((f) => ({ ...f, season: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type de compétition</Label>
              <Select
                value={champForm.competition_type ?? "__none__"}
                onValueChange={(v) =>
                  setChampForm((f) => ({ ...f, competition_type: v === "__none__" ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {COMPETITION_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Équipe</Label>
              <Select
                value={champForm.team ?? "__none__"}
                onValueChange={(v) =>
                  setChampForm((f) => ({ ...f, team: v === "__none__" ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucune —</SelectItem>
                  {TEAMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="champ-active"
                checked={champForm.active}
                onCheckedChange={(v) => setChampForm((f) => ({ ...f, active: v }))}
              />
              <Label htmlFor="champ-active">Actif</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setChampDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={saveChamp}
              disabled={!champForm.name || !champForm.season}
            >
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
