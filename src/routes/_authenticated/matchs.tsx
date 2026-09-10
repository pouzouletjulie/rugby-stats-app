import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POINT_KINDS, TEAMS, teamLabel } from "@/lib/rugby";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/matchs")({
  head: () => ({
    meta: [
      { title: "Matchs — AS Meudon Rugby Stats" },
      {
        name: "description",
        content: "Liste des matchs de l'AS Meudon avec scores calculés, filtres par équipe et statut.",
      },
      { property: "og:title", content: "Matchs — AS Meudon Rugby Stats" },
      { property: "og:description", content: "Consultez et filtrez tous les matchs du club." },
    ],
  }),
  component: MatchesPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Aucun match trouvé.</div>,
});

const STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  finalise: "Finalisé",
};

function MatchesPage() {
  const { canEdit } = useAuth();
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const [{ data: matches, error }, { data: points }] = await Promise.all([
        supabase.from("matches").select("*").order("match_date", { ascending: false }),
        supabase
          .from("match_events")
          .select("match_id, team_side, payload")
          .eq("event_type", "points")
          .is("deleted_at", null),
      ]);
      if (error) throw error;
      const scores = new Map<string, { meudon: number; adversaire: number }>();
      for (const ev of points ?? []) {
        const kind = (ev.payload as { kind?: string } | null)?.kind ?? "";
        const value = POINT_KINDS.find((k) => k.value === kind)?.points ?? 0;
        const entry = scores.get(ev.match_id) ?? { meudon: 0, adversaire: 0 };
        if (ev.team_side === "adversaire") entry.adversaire += value;
        else entry.meudon += value;
        scores.set(ev.match_id, entry);
      }
      return (matches ?? []).map((m) => ({
        ...m,
        score: scores.get(m.id) ?? { meudon: 0, adversaire: 0 },
      }));
    },
  });

  const filtered = (data ?? []).filter(
    (m) =>
      (team === "all" || m.team === team) &&
      (status === "all" || m.status === status) &&
      (!search || m.opponent.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-kicker">Saison en cours</p>
          <h1 className="text-3xl font-bold uppercase">Matchs</h1>
        </div>
        {canEdit && (
          <Button asChild>
            <Link to="/matchs/nouveau">
              <Plus className="size-4" /> Nouveau match
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un adversaire"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger>
            <SelectValue placeholder="Équipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les équipes</SelectItem>
            {TEAMS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="finalise">Finalisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && !filtered.length && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun match ne correspond aux filtres.
            </CardContent>
          </Card>
        )}
        {filtered.map((m) => (
          <Link key={m.id} to="/matchs/$id" params={{ id: m.id }} className="block">
            <Card className="transition-colors hover:border-accent">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{teamLabel(m.team)}</Badge>
                    <Badge variant={m.status === "finalise" ? "default" : "outline"}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </Badge>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">AS Meudon — {m.opponent}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {new Date(m.match_date).toLocaleDateString("fr-FR")} · {m.competition_type} ·{" "}
                    {m.location} · {m.format}
                  </p>
                </div>
                <div className="font-display text-3xl font-bold tabular-nums">
                  <span className="text-home">{m.score.meudon}</span>
                  <span className="mx-2 text-muted-foreground">–</span>
                  <span className="text-away">{m.score.adversaire}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
