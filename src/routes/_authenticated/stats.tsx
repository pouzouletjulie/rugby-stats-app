import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPETITION_TYPES,
  TEAMS,
  computeStats,
  teamLabel,
  type MatchEvent,
} from "@/lib/rugby";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

// ── Constantes ────────────────────────────────────────────────
const PRESSION_KINDS = new Set([
  "chandelle", "box_kick", "par_dessus", "rasant", "renvoi_22", "renvoi_enbut",
]);

const BAR_COLOR = "#2563eb";
const AVG_COLOR = "#dc2626";
const BAR_COLOR_ACCENT = "#ea580c";

// ── Types ─────────────────────────────────────────────────────
type MatchRow = {
  id: string;
  match_date: string;
  opponent: string;
  competition_type: string | null;
  team: string;
  status: string;
};

type MatchMetrics = {
  matchId: string;
  date: string;
  opponent: string;
  label: string;
  toucheReussite: number | null;
  touchesTotal: number;
  meleeReussite: number | null;
  meleesTotal: number;
  essais: number;
  points: number;
  cartonsTotal: number;
  plaquages: number;
  turnovers: number;
  japPression: number;
  japPressionGainPct: number | null;
};

function computeMatchMetrics(match: MatchRow, events: MatchEvent[]): MatchMetrics {
  const stats = computeStats(events);
  const m = stats.sides.meudon;

  // Plaquages : tous les events plaquage côté Meudon (avec ou sans kind)
  const plaquages = events.filter(
    (e) => !e.deleted_at && e.event_type === "plaquage" && e.team_side !== "adversaire",
  ).length;

  // Turnovers gagnés par Meudon : turnover meudon + en_avant adversaire
  const turnovers = events.filter(
    (e) =>
      !e.deleted_at &&
      ((e.event_type === "turnover" && e.team_side === "meudon") ||
        (e.event_type === "en_avant" && e.team_side === "adversaire")),
  ).length;

  // JAP pression
  let japPression = 0;
  let japGain = 0;
  for (const e of events) {
    if (e.deleted_at || e.event_type !== "jeu_au_pied" || e.team_side === "adversaire") continue;
    const kind = String(e.payload?.["kind"] ?? "");
    if (!PRESSION_KINDS.has(kind)) continue;
    japPression += 1;
    if (e.payload?.["gain_terrain"] === true) japGain += 1;
  }

  const d = new Date(match.match_date);
  const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${match.opponent.slice(0, 10)}`;

  return {
    matchId: match.id,
    date: match.match_date,
    opponent: match.opponent,
    label,
    toucheReussite: m.touches > 0 ? Math.round((m.touchesGagnees / m.touches) * 100) : null,
    touchesTotal: m.touches,
    meleeReussite: m.melees > 0 ? Math.round((m.meleesGagnees / m.melees) * 100) : null,
    meleesTotal: m.melees,
    essais: m.essais,
    points: m.points,
    cartonsTotal: m.cartons.blanc + m.cartons.jaune + m.cartons.bleu + m.cartons.rouge,
    plaquages,
    turnovers,
    japPression,
    japPressionGainPct: japPression > 0 ? Math.round((japGain / japPression) * 100) : null,
  };
}

// ── Composant carte métrique ──────────────────────────────────
type ChartPoint = {
  label: string;
  value: number | null;
  opponent: string;
  date: string;
};

function avg(data: ChartPoint[]) {
  const valid = data.filter((d) => d.value !== null);
  if (!valid.length) return null;
  return valid.reduce((s, d) => s + (d.value ?? 0), 0) / valid.length;
}

function MetricBar({
  title,
  data,
  color = BAR_COLOR,
  isPercent = false,
  unit = "",
  note,
}: {
  title: string;
  data: ChartPoint[];
  color?: string;
  isPercent?: boolean;
  unit?: string;
  note?: string;
}) {
  const mean = avg(data);
  const validCount = data.filter((d) => d.value !== null).length;
  if (validCount === 0) return null;

  const fmtValue = (v: number | null) =>
    v === null ? "—" : isPercent ? `${v} %` : `${v}${unit}`;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            {title}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Moy.{" "}
            <span className="font-bold tabular-nums text-foreground">
              {mean === null ? "—" : isPercent ? `${mean.toFixed(0)} %` : mean.toFixed(1)}
            </span>
            {note && (
              <span className="ml-1.5 text-muted-foreground/70">{note}</span>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={data} margin={{ top: 10, right: 4, bottom: 36, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#6b7280" }}
              domain={isPercent ? [0, 100] : [0, "auto"]}
              tickCount={4}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ChartPoint;
                return (
                  <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
                    <p className="font-semibold">{d.opponent}</p>
                    <p className="text-muted-foreground">
                      {new Date(d.date).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="mt-1 font-bold tabular-nums">{fmtValue(d.value)}</p>
                  </div>
                );
              }}
            />
            {mean !== null && (
              <ReferenceLine
                y={mean}
                stroke={AVG_COLOR}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            )}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.value === null ? "#e5e7eb" : color}
                  fillOpacity={d.value === null ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Carte spéciale : volume + % sur le même graphe (barres + ligne)
function JapComboCard({ data }: { data: Array<{ label: string; volume: number; pct: number | null; opponent: string; date: string }> }) {
  const validPct = data.filter((d) => d.pct !== null);
  const meanPct = validPct.length > 0
    ? validPct.reduce((s, d) => s + (d.pct ?? 0), 0) / validPct.length
    : null;
  const meanVol = data.reduce((s, d) => s + d.volume, 0) / (data.length || 1);

  if (!data.some((d) => d.volume > 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            JAP pression
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Moy.{" "}
            <span className="font-bold tabular-nums text-foreground">
              {meanVol.toFixed(1)}
            </span>{" "}
            kicks ·{" "}
            <span className="font-bold tabular-nums text-foreground">
              {meanPct !== null ? `${meanPct.toFixed(0)} %` : "—"}
            </span>{" "}
            terrain
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <ResponsiveContainer width="100%" height={170}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 36, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              domain={[0, "auto"]}
              tickCount={4}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              domain={[0, 100]}
              tickCount={5}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as typeof data[number];
                return (
                  <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
                    <p className="font-semibold">{d.opponent}</p>
                    <p className="text-muted-foreground">
                      {new Date(d.date).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="mt-1">Volume : <span className="font-bold">{d.volume}</span></p>
                    <p>Terrain : <span className="font-bold">{d.pct !== null ? `${d.pct} %` : "—"}</span></p>
                  </div>
                );
              }}
            />
            {meanPct !== null && (
              <ReferenceLine yAxisId="right" y={meanPct} stroke={AVG_COLOR} strokeDasharray="4 3" strokeWidth={1.5} />
            )}
            <Bar yAxisId="left" dataKey="volume" fill={BAR_COLOR_ACCENT} radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="right"
              dataKey="pct"
              stroke="#16a34a"
              strokeWidth={2}
              dot={{ r: 3, fill: "#16a34a" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-center text-[10px] text-muted-foreground">
          Barres = volume · Ligne verte = % gain terrain (axe droit)
        </p>
      </CardContent>
    </Card>
  );
}

// ── Page principale ───────────────────────────────────────────
function StatsPage() {
  const { isCoach, coachCategories } = useAuth();

  const defaultTeam = isCoach && coachCategories.length > 0 ? coachCategories[0] : TEAMS[0].value;
  const [team, setTeam] = useState<string>(defaultTeam);
  const [competition, setCompetition] = useState<string>("all");

  // Chargement des matchs pour l'équipe choisie
  const matchesQ = useQuery({
    queryKey: ["stats-matches", team],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, opponent, competition_type, team, status")
        .eq("team", team)
        .order("match_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });

  const matches = useMemo(() => {
    const all = matchesQ.data ?? [];
    return competition === "all"
      ? all
      : all.filter((m) => m.competition_type === competition);
  }, [matchesQ.data, competition]);

  const matchIds = useMemo(() => matches.map((m) => m.id), [matches]);

  // Chargement des events en batch
  const eventsQ = useQuery({
    queryKey: ["stats-events", matchIds],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("*")
        .in("match_id", matchIds);
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  // Calcul des métriques par match
  const metrics = useMemo((): MatchMetrics[] => {
    if (!eventsQ.data || !matches.length) return [];
    const byMatch = new Map<string, MatchEvent[]>();
    for (const e of eventsQ.data) {
      const list = byMatch.get(e.match_id) ?? [];
      list.push(e);
      byMatch.set(e.match_id, list);
    }
    return matches.map((m) =>
      computeMatchMetrics(m, byMatch.get(m.id) ?? []),
    );
  }, [matches, eventsQ.data]);

  // Listes de compétitions disponibles
  const availableCompetitions = useMemo(() => {
    const seen = new Set<string>();
    for (const m of matchesQ.data ?? []) {
      if (m.competition_type) seen.add(m.competition_type);
    }
    return [...seen].sort();
  }, [matchesQ.data]);

  const isLoading = matchesQ.isLoading || (matchIds.length > 0 && eventsQ.isLoading);

  // Helpers pour construire les données chart
  const pts = <K extends keyof MatchMetrics>(key: K): ChartPoint[] =>
    metrics.map((m) => ({
      label: m.label,
      value: m[key] as number | null,
      opponent: m.opponent,
      date: m.date,
    }));

  const japData = metrics.map((m) => ({
    label: m.label,
    volume: m.japPression,
    pct: m.japPressionGainPct,
    opponent: m.opponent,
    date: m.date,
  }));

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Statistiques
        </h1>
        {/* Filtres */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={team}
            onValueChange={(v) => {
              setTeam(v);
              setCompetition("all");
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAMS.filter((t) => !isCoach || coachCategories.includes(t.value)).map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={competition} onValueChange={setCompetition}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes compétitions</SelectItem>
              {availableCompetitions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
      )}

      {!isLoading && metrics.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun match trouvé pour ces critères.
        </p>
      )}

      {!isLoading && metrics.length > 0 && (
        <div className="space-y-6">
          {/* ── Conquête ── */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">
              Conquête
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricBar
                title="Réussite touche — Meudon"
                data={pts("toucheReussite").filter((d) =>
                  metrics[metrics.findIndex((m) => m.label === d.label)]?.touchesTotal > 0,
                )}
                isPercent
                color="#2563eb"
                note={`${metrics.filter((m) => m.touchesTotal > 0).length} matchs`}
              />
              <MetricBar
                title="Réussite mêlée — Meudon"
                data={pts("meleeReussite").filter((d) =>
                  metrics[metrics.findIndex((m) => m.label === d.label)]?.meleesTotal > 0,
                )}
                isPercent
                color="#7c3aed"
                note={`${metrics.filter((m) => m.meleesTotal > 0).length} matchs`}
              />
            </div>
          </section>

          {/* ── Score ── */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">
              Score — Meudon
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricBar title="Essais marqués" data={pts("essais")} color="#16a34a" />
              <MetricBar title="Points marqués" data={pts("points")} color="#0891b2" />
            </div>
          </section>

          {/* ── Jeu ── */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">
              Jeu — Meudon
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricBar title="Plaquages" data={pts("plaquages")} color="#2563eb" />
              <MetricBar
                title="Turnovers / Grattages gagnés"
                data={pts("turnovers")}
                color="#d97706"
              />
              <JapComboCard data={japData} />
            </div>
          </section>

          {/* ── Discipline ── */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">
              Discipline — Meudon
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricBar title="Cartons" data={pts("cartonsTotal")} color="#dc2626" />
            </div>
          </section>

          {/* ── Résumé tableau ── */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">
              Récapitulatif par match
            </h2>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Date</th>
                      <th className="py-1.5 pr-3 font-medium">Adversaire</th>
                      <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">Pts</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Ess.</th>
                      <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">Touch. %</th>
                      <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">Mêlée %</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Plaq.</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Turn.</th>
                      <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">JAP</th>
                      <th className="py-1.5 text-right font-medium">Cartons</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {metrics.map((m) => (
                      <tr key={m.matchId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                          {new Date(m.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="py-1.5 pr-3 font-medium max-w-[120px] truncate">{m.opponent}</td>
                        <td className="py-1.5 pr-3 text-right font-semibold">{m.points}</td>
                        <td className="py-1.5 pr-3 text-right">{m.essais}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {m.toucheReussite !== null ? `${m.toucheReussite} %` : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {m.meleeReussite !== null ? `${m.meleeReussite} %` : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{m.plaquages || "—"}</td>
                        <td className="py-1.5 pr-3 text-right">{m.turnovers || "—"}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {m.japPression > 0
                            ? `${m.japPression}${m.japPressionGainPct !== null ? ` (${m.japPressionGainPct}%)` : ""}`
                            : "—"}
                        </td>
                        <td className="py-1.5 text-right">{m.cartonsTotal || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </AppShell>
  );
}
