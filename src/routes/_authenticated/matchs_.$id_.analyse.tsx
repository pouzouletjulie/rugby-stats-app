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
          {/* Points détaillés */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase">Points marqués</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left">Type</th>
                    <th className="py-2 text-right">AS Meudon</th>
                    <th className="py-2 text-right">Adversaire</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr className="border-b">
                    <td className="py-1.5">Essais <span className="text-xs text-muted-foreground">(×5)</span></td>
                    <td className="py-1.5 text-right">{stats.sides.meudon.essais}</td>
                    <td className="py-1.5 text-right">{stats.sides.adversaire.essais}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5">Transformations <span className="text-xs text-muted-foreground">(×2)</span></td>
                    <td className="py-1.5 text-right">{stats.sides.meudon.transformations}</td>
                    <td className="py-1.5 text-right">{stats.sides.adversaire.transformations}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5">Pénalités au but <span className="text-xs text-muted-foreground">(×3)</span></td>
                    <td className="py-1.5 text-right">{stats.sides.meudon.penalitesBut}</td>
                    <td className="py-1.5 text-right">{stats.sides.adversaire.penalitesBut}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5">Drops <span className="text-xs text-muted-foreground">(×3)</span></td>
                    <td className="py-1.5 text-right">{stats.sides.meudon.drops}</td>
                    <td className="py-1.5 text-right">{stats.sides.adversaire.drops}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5">Essais de pénalité <span className="text-xs text-muted-foreground">(×7)</span></td>
                    <td className="py-1.5 text-right">{stats.sides.meudon.essaisPenalite}</td>
                    <td className="py-1.5 text-right">{stats.sides.adversaire.essaisPenalite}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right text-base">{stats.sides.meudon.points}</td>
                    <td className="py-2 text-right text-base">{stats.sides.adversaire.points}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Cartons + En-avants + Pénalités */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Cartons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(["meudon", "adversaire"] as const).map((side) => (
                  <div key={side}>
                    <p className="mb-1 text-xs text-muted-foreground">{side === "meudon" ? "AS Meudon" : "Adversaire"}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-border bg-white" />
                      <span className="tabular-nums">{stats.sides[side].cartons.blanc}</span>
                      <span className="inline-block h-4 w-4 shrink-0 rounded-sm bg-yellow-400" />
                      <span className="tabular-nums">{stats.sides[side].cartons.jaune}</span>
                      <span className="inline-block h-4 w-4 shrink-0 rounded-sm bg-blue-500" />
                      <span className="tabular-nums">{stats.sides[side].cartons.bleu}</span>
                      <span className="inline-block h-4 w-4 shrink-0 rounded-sm bg-red-600" />
                      <span className="tabular-nums">{stats.sides[side].cartons.rouge}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">En-avants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p>AS Meudon : <span className="font-semibold tabular-nums">{stats.sides.meudon.enAvants}</span></p>
                <p>Adversaire : <span className="font-semibold tabular-nums">{stats.sides.adversaire.enAvants}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Pénalités concédées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                <p>AS Meudon : <span className="font-semibold tabular-nums">{stats.sides.meudon.penalitesConcedees}</span></p>
                <p>Adversaire : <span className="font-semibold tabular-nums">{stats.sides.adversaire.penalitesConcedees}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Motifs pénalités */}
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

          {/* Entrées 22 Meudon uniquement */}
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
