import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PENALTY_MOTIFS,
  computeStats,
  teamLabel,
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

  const toucheAvants = useMemo(() => {
    const r = {
      meudon: { total: 0, gagnees: 0, parBloc: {} as Record<string, number>, parSuite: {} as Record<string, number> },
      adversaire: { total: 0, gagnees: 0, parBloc: {} as Record<string, number> },
    };
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "touche") continue;
      const pos = String(e.payload?.["possession"] ?? "") === "adversaire" ? "adversaire" : "meudon";
      const gain = String(e.payload?.["gain"] ?? "");
      const bloc = String(e.payload?.["bloc"] ?? "0");
      const suite = String(e.payload?.["suite"] ?? "");
      r[pos].total += 1;
      if (gain === pos) r[pos].gagnees += 1;
      r[pos].parBloc[bloc] = (r[pos].parBloc[bloc] ?? 0) + 1;
      if (pos === "meudon" && suite) r.meudon.parSuite[suite] = (r.meudon.parSuite[suite] ?? 0) + 1;
    }
    return r;
  }, [events]);

  const meleeAvants = useMemo(() => {
    const r = {
      meudon: { total: 0, gagnees: 0, parSortie: {} as Record<string, number> },
      adversaire: { total: 0, gagnees: 0 },
    };
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "melee") continue;
      const pos = String(e.payload?.["possession"] ?? "") === "adversaire" ? "adversaire" : "meudon";
      const gain = String(e.payload?.["gain"] ?? "");
      const sortie = String(e.payload?.["sortie"] ?? "");
      r[pos].total += 1;
      if (gain === pos) r[pos].gagnees += 1;
      if (pos === "meudon" && sortie) r.meudon.parSortie[sortie] = (r.meudon.parSortie[sortie] ?? 0) + 1;
    }
    return r;
  }, [events]);

  const blocLabel = (k: string) => {
    if (k === "true") return "Avec bloc";
    if (k === "false" || k === "0" || k === "") return "Sans bloc";
    return `${k} ligne${k !== "1" ? "s" : ""}`;
  };

  const meudonPts = stats.sides.meudon.points;
  const advPts = stats.sides.adversaire.points;
  const meudonEssais = stats.sides.meudon.essais;
  const advEssais = stats.sides.adversaire.essais;
  const ptsDiff = Math.abs(meudonPts - advPts);
  const meudonBD = meudonPts < advPts && ptsDiff < 8;
  const adversaireBD = advPts < meudonPts && ptsDiff < 8;
  const meudonBO = meudonEssais - advEssais >= 3;
  const adversaireBO = advEssais - meudonEssais >= 3;

  if (matchQ.isLoading) return <AppShell><p className="text-sm text-muted-foreground">Chargement…</p></AppShell>;

  return (
    <AppShell>
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/matchs/$id" params={{ id }}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="label-kicker">Analyse du match</p>
      </div>
      <Card className="overflow-hidden">
        <div className="pitch-gradient px-5 py-5 text-sidebar-foreground">
          <div className="flex flex-wrap items-center gap-3">
            {match && <Badge variant="secondary">{teamLabel(match.team)}</Badge>}
            {match && (
              <span className="text-xs text-sidebar-foreground/70">
                {new Date(match.match_date).toLocaleDateString("fr-FR")} · {match.competition_type} ·{" "}
                {match.location}{match.pitch_type ? ` · ${match.pitch_type}` : ""}{match.weather ? ` · ${match.weather}` : ""}{match.wind ? ` · vent ${match.wind}` : ""} · rugby à {match.format}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-3xl font-bold uppercase">AS Meudon — {match?.opponent ?? "…"}</h1>
            <div className="flex items-center gap-3 font-display font-bold tabular-nums">
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5 text-xs font-normal">
                  <span className="text-sidebar-foreground/70">{meudonEssais} ess.</span>
                  {meudonBO && <span className="rounded bg-emerald-500/80 px-1 text-white">BO</span>}
                  {meudonBD && <span className="rounded bg-amber-500/80 px-1 text-white">BD</span>}
                </div>
                <span className="text-5xl">{meudonPts}</span>
              </div>
              <span className="text-4xl text-sidebar-foreground/50">–</span>
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-1.5 text-xs font-normal">
                  {adversaireBD && <span className="rounded bg-amber-500/80 px-1 text-white">BD</span>}
                  {adversaireBO && <span className="rounded bg-emerald-500/80 px-1 text-white">BO</span>}
                  <span className="text-sidebar-foreground/70">{advEssais} ess.</span>
                </div>
                <span className="text-5xl">{advPts}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

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

        <TabsContent value="avants" className="mt-4 space-y-6">
          {/* Touche */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Touche</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["meudon", "adversaire"] as const).map((side) => {
                const t = toucheAvants[side];
                const perdues = t.total - t.gagnees;
                return (
                  <Card key={side}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase text-muted-foreground">
                        Touches — {side === "meudon" ? "AS Meudon" : "Adversaire"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tabular-nums">{t.total}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Perdues : {perdues}{t.total > 0 ? ` (${Math.round(perdues / t.total * 100)} %)` : ""}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["meudon", "adversaire"] as const).map((side) => (
                <Card key={side}>
                  <CardHeader>
                    <CardTitle className="text-sm uppercase">
                      Par bloc — {side === "meudon" ? "AS Meudon" : "Adversaire"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(toucheAvants[side].parBloc).length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">Aucune donnée</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs uppercase text-muted-foreground">
                            <th className="py-1.5 text-left">Bloc</th>
                            <th className="py-1.5 text-right">Nb</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(toucheAvants[side].parBloc)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([k, v]) => (
                              <tr key={k} className="border-b last:border-0">
                                <td className="py-1.5">{blocLabel(k)}</td>
                                <td className="py-1.5 text-right tabular-nums font-medium">{v}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase">Suite de jeu — AS Meudon</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(toucheAvants.meudon.parSuite).length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">Aucune donnée</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-muted-foreground">
                          <th className="py-1.5 text-left">Suite</th>
                          <th className="py-1.5 text-right">Nb</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(toucheAvants.meudon.parSuite)
                          .sort((a, b) => b[1] - a[1])
                          .map(([suite, count]) => (
                            <tr key={suite} className="border-b last:border-0">
                              <td className="py-1.5">{suite || "—"}</td>
                              <td className="py-1.5 text-right tabular-nums font-medium">{count}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
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
            </div>
          </div>

          {/* Mêlée */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mêlée</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["meudon", "adversaire"] as const).map((side) => {
                const m = meleeAvants[side];
                const perdues = m.total - m.gagnees;
                return (
                  <Card key={side}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase text-muted-foreground">
                        Mêlées — {side === "meudon" ? "AS Meudon" : "Adversaire"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tabular-nums">{m.total}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Perdues : {perdues}{m.total > 0 ? ` (${Math.round(perdues / m.total * 100)} %)` : ""}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase">Sorties de mêlée — AS Meudon</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(meleeAvants.meudon.parSortie).length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Aucune donnée</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-1.5 text-left">Type</th>
                        <th className="py-1.5 text-right">Nb</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(meleeAvants.meudon.parSortie)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <tr key={k} className="border-b last:border-0">
                            <td className="py-1.5">{k === "8" ? "Sortie du 8" : k === "9" ? "Sortie du 9" : k}</td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{v}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
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
