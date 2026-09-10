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
import { logAudit, useAuth, type Role } from "@/lib/useAuth";

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

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "lecteur", label: "Lecteur" },
  { value: "editeur", label: "Éditeur" },
  { value: "admin", label: "Administrateur" },
];

function AdminPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState(false);

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
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

  if (!isAdmin) {
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

  return (
    <AppShell>
      <h1 className="text-3xl font-bold uppercase">Administration</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="uppercase">Utilisateurs et rôles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(usersQ.data ?? []).map((u) => {
            const current: Role = u.roles.includes("admin")
              ? "admin"
              : u.roles.includes("editeur")
                ? "editeur"
                : "lecteur";
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                {u.id === user?.id && <Badge variant="secondary">Vous</Badge>}
                <Select value={current} onValueChange={(v) => setRole(u.id, v as Role)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
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
    </AppShell>
  );
}
