import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PENALTY_MOTIFS,
  TURNOVER_NATURES,
  computeStats,
  playerName,
  pointsValue,
  teamLabel,
  type MatchEvent,
  type MatchPlayer,
} from "@/lib/rugby";

const ZONE_ORDER = [
  "Nos 5m", "Nos 22m", "Notre moitié", "Milieu de terrain", "Leur moitié", "Leurs 22m", "Leurs 5m",
] as const;

const ZONE_COLORS = [
  "#0369a1", "#0ea5e9", "#7dd3fc",
  "#34d399",
  "#fcd34d", "#f97316", "#ef4444",
];

const ZONE_SHORT = ["Nos 5m", "Nos 22m", "Nôtre ½", "Milieu", "Leur ½", "Leurs 22m", "Leurs 5m"];

function FieldZoneBar({
  meudon,
  adversaire,
}: {
  meudon: Record<string, number>;
  adversaire: Record<string, number>;
}) {
  return (
    <div className="space-y-4">
      {(["meudon", "adversaire"] as const).map((side) => {
        const counts = side === "meudon" ? meudon : adversaire;
        const total = ZONE_ORDER.reduce((s, z) => s + (counts[z] ?? 0), 0);
        if (total === 0) return null;
        return (
          <div key={side}>
            <p className="mb-1 text-xs text-muted-foreground">
              {side === "meudon" ? "AS Meudon" : "Adversaire"} · {total}
            </p>
            <div style={{ display: "flex", height: 28, width: "100%", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb" }}>
              {ZONE_ORDER.map((zone, i) => {
                const count = counts[zone] ?? 0;
                return (
                  <div
                    key={zone}
                    title={`${zone} : ${count}`}
                    style={{
                      flex: "1 1 0%",
                      minWidth: 0,
                      backgroundColor: count > 0 ? ZONE_COLORS[i] : "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: count > 0 ? "#fff" : "#d1d5db",
                      borderRight: i < 6 ? "1px solid #e5e7eb" : undefined,
                    }}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", marginTop: 4 }}>
              {ZONE_SHORT.map((label, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 8,
                    color: (counts[ZONE_ORDER[i]] ?? 0) > 0 ? ZONE_COLORS[i] : "#9ca3af",
                    fontWeight: (counts[ZONE_ORDER[i]] ?? 0) > 0 ? 700 : 400,
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/matchs_/$id_/analyse")({
  component: AnalysePage,
  notFoundComponent: () => <div className="p-6">Match introuvable.</div>,
});

type IndivSortKey = "name" | "points" | "blanc" | "jaune" | "bleu" | "rouge";

function AnalysePage() {
  const { id } = Route.useParams();
  const [indivSortKey, setIndivSortKey] = useState<IndivSortKey>("name");
  const [indivSortDir, setIndivSortDir] = useState<"asc" | "desc">("asc");

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

  const turnoverBreakdown = useMemo(() => {
    const byNature: Record<string, number> = {};
    const byPlayer: Record<string, number> = {};
    for (const e of events) {
      if (e.deleted_at || e.team_side !== "meudon") continue;
      if (e.event_type !== "turnover" && e.event_type !== "en_avant") continue;
      const nature =
        e.event_type === "en_avant"
          ? "En-avant"
          : (TURNOVER_NATURES.find((n) => n.value === String(e.payload?.["nature"] ?? ""))?.label ??
             String(e.payload?.["nature"] ?? "autre"));
      byNature[nature] = (byNature[nature] ?? 0) + 1;
      if (e.player_number) {
        const name = playerName(players, e.player_number) ?? `n°${e.player_number}`;
        byPlayer[name] = (byPlayer[name] ?? 0) + 1;
      }
    }
    return {
      byNature: Object.entries(byNature).sort((a, b) => b[1] - a[1]),
      byPlayer: Object.entries(byPlayer).sort((a, b) => b[1] - a[1]),
    };
  }, [events, players]);

  const penaltoucheStats = useMemo(() => {
    let tentees = 0, trouvees = 0;
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "penalite" || e.team_side !== "adversaire") continue;
      if (String(e.payload?.["choix"] ?? "") !== "penaltouche") continue;
      tentees += 1;
      if (e.payload?.["penaltouche_trouvee"] === true) trouvees += 1;
    }
    return { tentees, trouvees };
  }, [events]);

  const toucheAvants = useMemo(() => {
    const r = {
      meudon: { total: 0, gagnees: 0, parBloc: {} as Record<string, number>, parSuite: {} as Record<string, number>, parZone: {} as Record<string, number>, parPeriode: { mt1: 0, mt2: 0 } },
      adversaire: { total: 0, gagnees: 0, parBloc: {} as Record<string, number>, parZone: {} as Record<string, number>, parPeriode: { mt1: 0, mt2: 0 } },
    };
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "touche") continue;
      const pos = String(e.payload?.["possession"] ?? "") === "adversaire" ? "adversaire" : "meudon";
      const gain = String(e.payload?.["gain"] ?? "");
      const bloc = String(e.payload?.["bloc"] ?? "0");
      const suite = String(e.payload?.["suite"] ?? "");
      const zone = String(e.payload?.["zone"] ?? "");
      r[pos].total += 1;
      if (gain === pos) r[pos].gagnees += 1;
      r[pos].parBloc[bloc] = (r[pos].parBloc[bloc] ?? 0) + 1;
      if (zone) r[pos].parZone[zone] = (r[pos].parZone[zone] ?? 0) + 1;
      if (pos === "meudon" && gain === "meudon" && suite) r.meudon.parSuite[suite] = (r.meudon.parSuite[suite] ?? 0) + 1;
      if (e.period === "mt1") r[pos].parPeriode.mt1 += 1;
      else if (e.period === "mt2") r[pos].parPeriode.mt2 += 1;
    }
    return r;
  }, [events]);

  const meleeAvants = useMemo(() => {
    const r = {
      meudon: { total: 0, gagnees: 0, parSortie: {} as Record<string, number>, parZone: {} as Record<string, number>, parPeriode: { mt1: 0, mt2: 0 } },
      adversaire: { total: 0, gagnees: 0, parZone: {} as Record<string, number>, parPeriode: { mt1: 0, mt2: 0 } },
    };
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "melee") continue;
      const pos = String(e.payload?.["possession"] ?? "") === "adversaire" ? "adversaire" : "meudon";
      const gain = String(e.payload?.["gain"] ?? "");
      const sortie = String(e.payload?.["sortie"] ?? "");
      const zone = String(e.payload?.["zone"] ?? "");
      r[pos].total += 1;
      if (gain === pos) r[pos].gagnees += 1;
      if (zone) r[pos].parZone[zone] = (r[pos].parZone[zone] ?? 0) + 1;
      if (pos === "meudon" && gain === "meudon" && sortie) r.meudon.parSortie[sortie] = (r.meudon.parSortie[sortie] ?? 0) + 1;
      if (e.period === "mt1") r[pos].parPeriode.mt1 += 1;
      else if (e.period === "mt2") r[pos].parPeriode.mt2 += 1;
    }
    return r;
  }, [events]);

  const japTroisQuarts = useMemo(() => {
    const r = {
      engagement: { total: 0, recupere: 0, plaquageImmédiat: 0, moins10m: 0, directTouche: 0, autre: 0 },
      degagement: { total: 0, touche: 0, toucheDirecte: 0, gainTerrain: 0, parZone: {} as Record<string, number> },
      chandelle: { total: 0, recupere: 0, parZone: {} as Record<string, number> },
      rasantRenvoi: { total: 0, gainTerrain: 0 },
      pressionKick: { total: 0, recupere: 0, recupereBase: 0, gainTerrain: 0, gainTerrainBase: 0, parZone: {} as Record<string, number> },
      renvoi: { total: 0, recupere: 0, gainTerrain: 0 },
    };
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "jeu_au_pied" || e.team_side !== "meudon") continue;
      const p = e.payload as Record<string, unknown>;
      const kind = String(p?.["kind"] ?? "");
      if (kind === "engagement") {
        r.engagement.total += 1;
        const flags = [p["recupere"], p["plaquage_immediat"], p["moins_10m"], p["direct_touche"]];
        if (p["recupere"] === true) r.engagement.recupere += 1;
        else if (p["plaquage_immediat"] === true) r.engagement.plaquageImmédiat += 1;
        else if (p["moins_10m"] === true) r.engagement.moins10m += 1;
        else if (p["direct_touche"] === true) r.engagement.directTouche += 1;
        else if (!flags.some((f) => f === true)) r.engagement.autre += 1;
      } else if (kind === "degagement") {
        r.degagement.total += 1;
        if (p["touche"] === true) {
          r.degagement.touche += 1;
          if (p["touche_directe"] === true) r.degagement.toucheDirecte += 1;
        }
        if (p["gain_terrain"] === true) r.degagement.gainTerrain += 1;
        const zone = String(p["zone"] ?? "");
        if (zone) r.degagement.parZone[zone] = (r.degagement.parZone[zone] ?? 0) + 1;
      } else if (kind === "chandelle" || kind === "box_kick") {
        r.chandelle.total += 1;
        if (p["recupere"] === true) r.chandelle.recupere += 1;
        const zone = String(p["zone"] ?? "");
        if (zone) r.chandelle.parZone[zone] = (r.chandelle.parZone[zone] ?? 0) + 1;
      } else if (kind === "rasant" || kind === "renvoi_22" || kind === "renvoi_enbut") {
        r.rasantRenvoi.total += 1;
        if (p["gain_terrain"] === true) r.rasantRenvoi.gainTerrain += 1;
        if (kind === "renvoi_22" || kind === "renvoi_enbut") {
          r.renvoi.total += 1;
          if (p["recupere"] === true) r.renvoi.recupere += 1;
          if (p["gain_terrain"] === true) r.renvoi.gainTerrain += 1;
        }
      }
      if (["chandelle", "box_kick", "par_dessus", "rasant", "renvoi_22", "renvoi_enbut"].includes(kind)) {
        r.pressionKick.total += 1;
        const zone = String(p["zone"] ?? "");
        if (zone) r.pressionKick.parZone[zone] = (r.pressionKick.parZone[zone] ?? 0) + 1;
        if (["chandelle", "box_kick", "par_dessus"].includes(kind)) {
          r.pressionKick.recupereBase += 1;
          if (p["recupere"] === true) r.pressionKick.recupere += 1;
        }
        r.pressionKick.gainTerrainBase += 1;
        if (p["gain_terrain"] === true) r.pressionKick.gainTerrain += 1;
      }
    }
    return r;
  }, [events]);

  const penButGrid = useMemo(() => {
    type Cell = { tentees: number; reussies: number };
    const grid: Record<string, Record<string, Cell>> = Object.fromEntries(
      ["22m", "40m", "50m"].map((d) => [
        d,
        Object.fromEntries(
          ["gauche", "milieu", "droite"].map((c) => [c, { tentees: 0, reussies: 0 }])
        ),
      ])
    );
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "points" || e.team_side !== "meudon") continue;
      const p = e.payload as Record<string, unknown>;
      if (String(p?.["kind"] ?? "") !== "penalite_but") continue;
      const distance = String(p?.["position_distance"] ?? "");
      const cote = String(p?.["position_cote"] ?? "");
      if (!distance || !cote || !grid[distance]?.[cote]) continue;
      grid[distance][cote].tentees += 1;
      if (p?.["reussi"] !== false) grid[distance][cote].reussies += 1;
    }
    return grid;
  }, [events]);

  const transfoGrid = useMemo(() => {
    type Cell = { tentees: number; reussies: number };
    const grid: Record<string, Record<string, Cell>> = Object.fromEntries(
      ["22m", "40m", "50m"].map((d) => [
        d,
        Object.fromEntries(
          ["gauche", "milieu", "droite"].map((c) => [c, { tentees: 0, reussies: 0 }])
        ),
      ])
    );
    for (const e of events) {
      if (e.deleted_at || e.event_type !== "points" || e.team_side !== "meudon") continue;
      const p = e.payload as Record<string, unknown>;
      if (String(p?.["kind"] ?? "") !== "transformation") continue;
      const distance = String(p?.["position_distance"] ?? "");
      const cote = String(p?.["position_cote"] ?? "");
      if (!distance || !cote || !grid[distance]?.[cote]) continue;
      grid[distance][cote].tentees += 1;
      if (p?.["reussi"] !== false) grid[distance][cote].reussies += 1;
    }
    return grid;
  }, [events]);

  const generalParPeriode = useMemo(() => {
    const r = {
      meudon: { enAvants: { mt1: 0, mt2: 0 }, penalites: { mt1: 0, mt2: 0 } },
      adversaire: { enAvants: { mt1: 0, mt2: 0 }, penalites: { mt1: 0, mt2: 0 } },
    };
    for (const e of events) {
      if (e.deleted_at) continue;
      const side = e.team_side === "adversaire" ? "adversaire" : "meudon";
      if (e.event_type === "en_avant") {
        if (e.period === "mt1") r[side].enAvants.mt1 += 1;
        else if (e.period === "mt2") r[side].enAvants.mt2 += 1;
      } else if (e.event_type === "penalite") {
        if (e.period === "mt1") r[side].penalites.mt1 += 1;
        else if (e.period === "mt2") r[side].penalites.mt2 += 1;
      }
    }
    return r;
  }, [events]);

  const scoreMiTemps = useMemo(() => {
    const r = { meudon: 0, adversaire: 0 };
    for (const e of events) {
      if (e.deleted_at || e.period !== "mt1") continue;
      const pts = pointsValue(e);
      if (pts === 0) continue;
      const side = e.team_side === "adversaire" ? "adversaire" : "meudon";
      r[side] += pts;
    }
    return r;
  }, [events]);

  const pct = (n: number, total: number) =>
    total === 0 ? "—" : `${Math.round((n / total) * 100)} %`;

  const blocLabel = (k: string) => {
    if (k === "true") return "Bloc 1";
    if (k === "false" || k === "" ) return "Bloc 0";
    return `Bloc ${k}`;
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
      <div className="mb-2 flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/matchs/$id" params={{ id }}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="label-kicker">Analyse du match</p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => window.print()}
        >
          <Printer className="size-4" /> Exporter PDF
        </Button>
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
          <p className="mt-2 text-xs text-sidebar-foreground/60">
            Mi-temps : {scoreMiTemps.meudon} – {scoreMiTemps.adversaire}
          </p>
        </div>
      </Card>

      <div className="mt-6 space-y-10">

        <section className="analyse-section space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-wide">Général</h2>
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
                    <td className="py-1.5">Pénalités <span className="text-xs text-muted-foreground">(×3)</span></td>
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
              <CardContent className="space-y-1.5 text-sm">
                <div>
                  <p>AS Meudon : <span className="font-semibold tabular-nums">{stats.sides.meudon.enAvants}</span></p>
                  <p className="text-xs text-muted-foreground">1re MT : {generalParPeriode.meudon.enAvants.mt1} · 2e MT : {generalParPeriode.meudon.enAvants.mt2}</p>
                </div>
                <div>
                  <p>Adversaire : <span className="font-semibold tabular-nums">{stats.sides.adversaire.enAvants}</span></p>
                  <p className="text-xs text-muted-foreground">1re MT : {generalParPeriode.adversaire.enAvants.mt1} · 2e MT : {generalParPeriode.adversaire.enAvants.mt2}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase text-muted-foreground">Pénalités concédées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div>
                  <p>AS Meudon : <span className="font-semibold tabular-nums">{stats.sides.meudon.penalitesConcedees}</span></p>
                  <p className="text-xs text-muted-foreground">1re MT : {generalParPeriode.meudon.penalites.mt1} · 2e MT : {generalParPeriode.meudon.penalites.mt2}</p>
                </div>
                <div>
                  <p>Adversaire : <span className="font-semibold tabular-nums">{stats.sides.adversaire.penalitesConcedees}</span></p>
                  <p className="text-xs text-muted-foreground">1re MT : {generalParPeriode.adversaire.penalites.mt1} · 2e MT : {generalParPeriode.adversaire.penalites.mt2}</p>
                </div>
                {penaltoucheStats.tentees > 0 && (
                  <div className="border-t pt-1.5">
                    <p className="text-xs text-muted-foreground">Pénaltouches trouvées</p>
                    <p className="font-semibold tabular-nums">{penaltoucheStats.trouvees}/{penaltoucheStats.tentees} <span className="text-xs font-normal text-muted-foreground">({pct(penaltoucheStats.trouvees, penaltoucheStats.tentees)})</span></p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Turnovers */}
          {(turnoverBreakdown.byNature.length > 0 || turnoverBreakdown.byPlayer.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase">Turnovers AS Meudon — par raison</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Raison</th>
                        <th className="py-2 text-right">Nb</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnoverBreakdown.byNature.map(([nature, count]) => (
                        <tr key={nature} className="border-b last:border-0">
                          <td className="py-1.5">{nature}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase">Turnovers AS Meudon — par joueur</CardTitle>
                </CardHeader>
                <CardContent>
                  {turnoverBreakdown.byPlayer.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">Aucun joueur renseigné</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                          <th className="py-2">Joueur</th>
                          <th className="py-2 text-right">Nb</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnoverBreakdown.byPlayer.map(([name, count]) => (
                          <tr key={name} className="border-b last:border-0">
                            <td className="py-1.5">{name}</td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

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
        </section>

        <section className="analyse-section space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide">Conquête</h2>

          {/* ── TOUCHE ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Touche</h3>

            {/* Totaux */}
            <div className="grid grid-cols-2 gap-3">
              {(["meudon", "adversaire"] as const).map((side) => {
                const t = toucheAvants[side];
                const perdues = t.total - t.gagnees;
                return (
                  <Card key={side}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase text-muted-foreground">
                        {side === "meudon" ? "AS Meudon" : "Adversaire"}
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

            {/* Par bloc — AS Meudon uniquement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase">Par bloc — AS Meudon</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(toucheAvants.meudon.parBloc).length === 0 ? (
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
                      {["0", "1", "2", "3"].map((k) => {
                        const m = toucheAvants.meudon.parBloc[k] ?? 0;
                        if (m === 0) return null;
                        return (
                          <tr key={k} className="border-b last:border-0">
                            <td className="py-1.5">{blocLabel(k)}</td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{m}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Par zone */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase">Par zone de terrain</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldZoneBar meudon={toucheAvants.meudon.parZone} adversaire={toucheAvants.adversaire.parZone} />
              </CardContent>
            </Card>

            {/* Suite de jeu */}
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
          </div>

          {/* ── MÊLÉE ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mêlée</h3>

            {/* Totaux */}
            <div className="grid grid-cols-2 gap-3">
              {(["meudon", "adversaire"] as const).map((side) => {
                const m = meleeAvants[side];
                const perdues = m.total - m.gagnees;
                return (
                  <Card key={side}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase text-muted-foreground">
                        {side === "meudon" ? "AS Meudon" : "Adversaire"}
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

            {/* Par zone */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase">Par zone de terrain</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldZoneBar meudon={meleeAvants.meudon.parZone} adversaire={meleeAvants.adversaire.parZone} />
              </CardContent>
            </Card>

            {/* Sorties */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase">Sorties — AS Meudon</CardTitle>
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
                            <td className="py-1.5">
                              {k === "8" ? "Sortie du 8" : k === "9" ? "Sortie du 9" : k === "bras_casse" ? "Bras cassé" : k}
                            </td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{v}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="analyse-section space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wide">Jeu au pied</h2>

          {/* ── PÉNALITÉS AU BUT (grille côté × distance) ── */}
          {stats.sides.meudon.penalitesButTentees > 0 && (() => {
            const distances = ["22m", "40m", "50m"] as const;
            const cotes = ["gauche", "milieu", "droite"] as const;
            const coteLabel = { gauche: "Gauche", milieu: "Milieu", droite: "Droite" };
            const hasPositionData = distances.some((d) => cotes.some((c) => penButGrid[d][c].tentees > 0));
            if (!hasPositionData) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase">Pénalités au but — AS Meudon</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-1.5 text-left"></th>
                        {cotes.map((c) => (
                          <th key={c} className="py-1.5 text-right">{coteLabel[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {distances.map((d) => (
                        <tr key={d} className="border-b last:border-0">
                          <td className="py-1.5 font-medium">{d}</td>
                          {cotes.map((c) => {
                            const cell = penButGrid[d][c];
                            if (cell.tentees === 0) return <td key={c} className="py-1.5 text-right text-muted-foreground">—</td>;
                            const pct = Math.round((cell.reussies / cell.tentees) * 100);
                            return (
                              <td key={c} className="py-1.5 text-right tabular-nums">
                                {cell.reussies} <span className="text-xs text-muted-foreground">({pct} %)</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── TRANSFORMATIONS (grille côté × distance) ── */}
          {stats.sides.meudon.transformationsTentees > 0 && (() => {
            const distances = ["22m", "40m", "50m"] as const;
            const cotes = ["gauche", "milieu", "droite"] as const;
            const coteLabel = { gauche: "Gauche", milieu: "Milieu", droite: "Droite" };
            const hasPositionData = distances.some((d) => cotes.some((c) => transfoGrid[d][c].tentees > 0));
            if (!hasPositionData) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase">Transformations — AS Meudon</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-1.5 text-left"></th>
                        {cotes.map((c) => (
                          <th key={c} className="py-1.5 text-right">{coteLabel[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {distances.map((d) => (
                        <tr key={d} className="border-b last:border-0">
                          <td className="py-1.5 font-medium">{d}</td>
                          {cotes.map((c) => {
                            const cell = transfoGrid[d][c];
                            if (cell.tentees === 0) return <td key={c} className="py-1.5 text-right text-muted-foreground">—</td>;
                            const pct = Math.round((cell.reussies / cell.tentees) * 100);
                            return (
                              <td key={c} className="py-1.5 text-right tabular-nums">
                                {cell.reussies} <span className="text-xs text-muted-foreground">({pct} %)</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── ENGAGEMENT ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Engagement — AS Meudon</h3>
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: "Récupéré", value: japTroisQuarts.engagement.recupere },
                      { label: "Plaquage immédiat", value: japTroisQuarts.engagement.plaquageImmédiat },
                      { label: "Moins de 10m", value: japTroisQuarts.engagement.moins10m },
                      { label: "Direct en touche", value: japTroisQuarts.engagement.directTouche },
                      { label: "Autre", value: japTroisQuarts.engagement.autre },
                    ].filter(({ value }) => value > 0).map(({ label, value }) => (
                      <tr key={label} className="border-b last:border-0">
                        <td className="py-1.5">{label}</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold">{value}</td>
                      </tr>
                    ))}
                    {japTroisQuarts.engagement.total === 0 && (
                      <tr><td colSpan={2} className="py-2 text-muted-foreground">Aucune donnée</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── DÉGAGEMENT ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dégagement — AS Meudon</h3>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold tabular-nums">{japTroisQuarts.degagement.total}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm uppercase">Par zone de terrain</CardTitle></CardHeader>
              <CardContent>
                <FieldZoneBar meudon={japTroisQuarts.degagement.parZone} adversaire={{}} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1.5">En touche</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{japTroisQuarts.degagement.touche}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5">Direct en touche</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{japTroisQuarts.degagement.toucheDirecte}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Gain de terrain</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{pct(japTroisQuarts.degagement.gainTerrain, japTroisQuarts.degagement.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── CHANDELLE / BOX KICK ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Jeu au pied de pression — AS Meudon</h3>
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1.5">Volume</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{japTroisQuarts.pressionKick.total}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5">Récupéré</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{pct(japTroisQuarts.pressionKick.recupere, japTroisQuarts.pressionKick.recupereBase)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Gain de terrain</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{pct(japTroisQuarts.pressionKick.gainTerrain, japTroisQuarts.pressionKick.gainTerrainBase)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm uppercase">Par zone de terrain</CardTitle></CardHeader>
              <CardContent>
                <FieldZoneBar meudon={japTroisQuarts.pressionKick.parZone} adversaire={{}} />
              </CardContent>
            </Card>
          </div>

          {/* ── RENVOI ── */}
          {japTroisQuarts.renvoi.total > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Renvoi — AS Meudon</h3>
              <Card>
                <CardContent className="pt-4">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1.5">Volume</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold">{japTroisQuarts.renvoi.total}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1.5">Récupéré</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold">{pct(japTroisQuarts.renvoi.recupere, japTroisQuarts.renvoi.total)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">Gain de terrain</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold">{pct(japTroisQuarts.renvoi.gainTerrain, japTroisQuarts.renvoi.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── PÉNALITÉ AU BUT ── */}
          {stats.sides.meudon.penalitesButTentees > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pénalité — AS Meudon</h3>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold tabular-nums">
                    {stats.sides.meudon.penalitesBut}<span className="text-base text-muted-foreground">/{stats.sides.meudon.penalitesButTentees}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pct(stats.sides.meudon.penalitesBut, stats.sides.meudon.penalitesButTentees)} de réussite</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── TRANSFORMATION ── */}
          {stats.sides.meudon.transformationsTentees > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Transformation — AS Meudon</h3>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold tabular-nums">
                    {stats.sides.meudon.transformations}<span className="text-base text-muted-foreground">/{stats.sides.meudon.transformationsTentees}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pct(stats.sides.meudon.transformations, stats.sides.meudon.transformationsTentees)} de réussite</p>
                </CardContent>
              </Card>
            </div>
          )}

        </section>

        <section className="analyse-section">
          <h2 className="text-xl font-bold uppercase tracking-wide mb-4">Stats indiv</h2>
          {(() => {
            const toggleIndivSort = (key: IndivSortKey) => {
              if (indivSortKey === key) setIndivSortDir((d) => (d === "asc" ? "desc" : "asc"));
              else { setIndivSortKey(key); setIndivSortDir(key === "name" ? "asc" : "desc"); }
            };

            const statsMap = new Map(stats.players.map((p) => [p.number, p]));
            const rows = [...players]
              .map((pl) => {
                const s = statsMap.get(pl.number);
                return {
                  number: pl.number,
                  name: [pl.first_name, pl.last_name].filter(Boolean).join(" ") || `n°${pl.number}`,
                  points: s?.points ?? 0,
                  blanc: s?.cartonsBlanc ?? 0,
                  jaune: s?.cartonsJaune ?? 0,
                  bleu: s?.cartonsBleu ?? 0,
                  rouge: s?.cartonsRouge ?? 0,
                };
              })
              .filter((r) => r.points > 0 || r.blanc > 0 || r.jaune > 0 || r.bleu > 0 || r.rouge > 0)
              .sort((a, b) => {
                const dir = indivSortDir === "asc" ? 1 : -1;
                if (indivSortKey === "name") return dir * a.name.localeCompare(b.name);
                return dir * (a[indivSortKey] - b[indivSortKey]);
              });

            const Th = ({ k, label }: { k: IndivSortKey; label: string }) => (
              <th
                className="cursor-pointer select-none py-2 pr-4 text-left text-xs uppercase text-muted-foreground hover:text-foreground whitespace-nowrap"
                onClick={() => toggleIndivSort(k)}
              >
                {label}{indivSortKey === k ? (indivSortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            );

            return (
              <Card>
                <CardHeader><CardTitle className="uppercase">Bilan individuel</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  {!players.length ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Aucun joueur dans la feuille de match.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <Th k="name" label="Joueur" />
                          <Th k="points" label="Pts" />
                          <Th k="blanc" label="Blanc" />
                          <Th k="jaune" label="Jaune" />
                          <Th k="bleu" label="Bleu" />
                          <Th k="rouge" label="Rouge" />
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {rows.map((r) => (
                          <tr key={r.number} className="border-b last:border-0">
                            <td className="py-1.5 font-medium">
                              <span className="mr-1.5 text-xs text-muted-foreground">n°{r.number}</span>{r.name}
                            </td>
                            <td className="pr-4">{r.points || "—"}</td>
                            <td className="pr-4">{r.blanc || "—"}</td>
                            <td className="pr-4">{r.jaune || "—"}</td>
                            <td className="pr-4">{r.bleu || "—"}</td>
                            <td className="pr-4">{r.rouge || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </section>
      </div>
    </AppShell>
  );
}
