import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PENALTY_MOTIFS,
  computeStats,
  type MatchEvent,
  type MatchPlayer,
} from "@/lib/rugby";

export const Route = createFileRoute("/_authenticated/matchs_/$id_/analyse")({
  component: AnalysePage,
  notFoundComponent: () => <div className="p-6">Match introuvable.</div>,
});

function AnalysePage() {
  const { id } = Route.useParams();

  const matchQ = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const playersQ = useQuery({
    queryKey: ["match-players", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_players")
        .select("id, number, last_name, first_name, nickname")
        .eq("match_id", id)
        .order("number");
      if (error) throw error;
      return (data ?? []) as MatchPlayer[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["match-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  const match = matchQ.data;
  const players = playersQ.data ?? [];
  const events = eventsQ.data ?? [];
  const stats = useMemo(() => computeStats(events), [events]);
  const penaltyBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "penalite" || e.team_side !== "meudon") continue;
      const motif = String(e.payload?.["motif"] ?? "autre");
      counts[motif] = (counts[motif] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([motif, count]) => ({ motif, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  if (matchQ.isLoading) return <AppShell><p className="text-sm text-muted-foreground">Chargement…</p></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/matchs/$id" params={{ id }}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <p className="label-kicker">Analyse du match</p>
          <h1 className="text-2xl font-bold uppercase">
            AS Meudon — {match?.opponent ?? "…"}
          </h1>
        </div>
      </div>

      <Tabs defaultValue="general" className="mt-6">
        <TabsList className="flex w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="general" className="shrink-0">Général</TabsTrigger>
          <TabsTrigger value="avants" className="shrink-0">Focus avants</TabsTrigger>
          <TabsTrigger value="trois-quarts" className="shrink-0">Focus 3/4</TabsTrigger>
          <TabsTrigger value="joueurs" className="shrink-0">Détail joueur</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {stats.sides.meudon.points} – {stats.sides.adversaire.points}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">AS Meudon · Adversaire</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Cartons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p>Meudon : {stats.sides.meudon.cartons.blanc}B {stats.sides.meudon.cartons.jaune}J {stats.sides.meudon.cartons.rouge}R</p>
                <p>Adv : {stats.sides.adversaire.cartons.blanc}B {stats.sides.adversaire.cartons.jaune}J {stats.sides.adversaire.cartons.rouge}R</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">En-avants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p>Meudon : {stats.sides.meudon.enAvants}</p>
                <p>Adv : {stats.sides.adversaire.enAvants}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Pénalités</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p>Meudon : {stats.sides.meudon.penalitesConcedees}</p>
                <p>Adv : {stats.sides.adversaire.penalitesConcedees}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase">Motifs des pénalités AS Meudon</CardTitle>
            </CardHeader>
            <CardContent>
              {penaltyBreakdown.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucune pénalité enregistrée
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Motif</th>
                      <th className="py-2 text-right">Nb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penaltyBreakdown.map(({ motif, count }) => (
                      <tr key={motif} className="border-b last:border-0">
                        <td className="py-1.5">
                          {PENALTY_MOTIFS.find((m) => m.value === motif)?.label ?? motif}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-medium">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">
                  Entrées dans les 22 — AS Meudon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{stats.sides.meudon.entrees22}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Efficaces : {stats.sides.meudon.entrees22Efficaces}
                  {stats.sides.meudon.entrees22 > 0
                    ? ` (${Math.round((stats.sides.meudon.entrees22Efficaces / stats.sides.meudon.entrees22) * 100)} %)`
                    : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">
                  Entrées dans les 22 — Adversaire
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{stats.sides.adversaire.entrees22}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Efficaces : {stats.sides.adversaire.entrees22Efficaces}
                  {stats.sides.adversaire.entrees22 > 0
                    ? ` (${Math.round((stats.sides.adversaire.entrees22Efficaces / stats.sides.adversaire.entrees22) * 100)} %)`
                    : ""}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="avants">
          <p className="py-12 text-center text-sm text-muted-foreground">À venir</p>
        </TabsContent>
        <TabsContent value="trois-quarts">
          <p className="py-12 text-center text-sm text-muted-foreground">À venir</p>
        </TabsContent>
        <TabsContent value="joueurs">
          <p className="py-12 text-center text-sm text-muted-foreground">À venir</p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
