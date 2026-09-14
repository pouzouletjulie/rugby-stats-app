import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EventForm, defaultDraft, type EventDraft } from "@/components/EventForm";
import { MatchSheetEditor } from "@/components/MatchSheetEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EVENT_LABELS,
  PERIODS,
  activePeriod,
  computeStats,
  eventSummary,
  periodLabel,
  periodStarted,
  playerName,
  teamLabel,
  type MatchEvent,
  type MatchPlayer,
} from "@/lib/rugby";
import { logAudit, useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/matchs_/$id")({
  head: () => ({
    meta: [
      { title: "Feuille de match — AS Meudon Rugby Stats" },
      {
        name: "description",
        content:
          "Saisie des événements, statistiques collectives et individuelles et historique des corrections du match.",
      },
      { property: "og:title", content: "Feuille de match — AS Meudon Rugby Stats" },
      {
        property: "og:description",
        content: "Score et statistiques recalculés automatiquement depuis les événements actifs.",
      },
    ],
  }),
  component: MatchPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Match introuvable.</div>,
});

const EVENT_GROUPS = [
  {
    label: "Conquête",
    types: ["melee", "touche"],
  },
  {
    label: "Points & discipline",
    types: ["points", "penalite", "carton"],
  },
  {
    label: "Jeu courant",
    types: ["turnover", "entree_22", "cinquante_22"],
  },
  {
    label: "Individuel",
    types: ["passe", "ballon_touche", "plaquage", "jeu_au_pied"],
  },
];

function MatchPage() {
  const { id } = Route.useParams();
  const { canEdit, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [editing, setEditing] = useState<MatchEvent | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

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

  const auditQ = useQuery({
    queryKey: ["match-audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const match = matchQ.data;
  const players = playersQ.data ?? [];
  const events = eventsQ.data ?? [];
  const stats = useMemo(() => computeStats(events), [events]);
  const period = activePeriod(events);
  const finalized = match?.status === "finalise";
  const editable = canEdit && !finalized;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["match-events", id] });
    void qc.invalidateQueries({ queryKey: ["match-audit", id] });
    void qc.invalidateQueries({ queryKey: ["matches"] });
  };

  const insertEvent = async (draft: EventDraft, silent = false) => {
    if (!editable) return;
    if (!draft.event_type.startsWith("debut_") && !period) {
      toast.error("Activez d'abord une période");
      return;
    }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase
      .from("match_events")
      .insert({
        match_id: id,
        period: draft.event_type.startsWith("debut_")
          ? (PERIODS.find((p) => p.startEvent === draft.event_type)?.value ?? null)
          : period,
        event_type: draft.event_type,
        team_side: draft.team_side,
        player_number: draft.player_number,
        payload: draft.payload as never,
        created_by: uid,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "ajout événement",
      entity: "match_event",
      entityId: data?.id ?? null,
      matchId: id,
      details: { type: draft.event_type, ...draft.payload },
    });
    refresh();
    if (!silent) toast.success(`${EVENT_LABELS[draft.event_type] ?? draft.event_type} enregistré`);
  };

  const updateEvent = async (ev: MatchEvent, draft: EventDraft) => {
    const { error } = await supabase
      .from("match_events")
      .update({
        team_side: draft.team_side,
        player_number: draft.player_number,
        payload: draft.payload as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "modification événement",
      entity: "match_event",
      entityId: ev.id,
      matchId: id,
      details: { avant: ev.payload, apres: draft.payload },
    });
    setEditing(null);
    refresh();
    toast.success("Événement modifié");
  };

  const toggleDelete = async (ev: MatchEvent) => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const restoring = Boolean(ev.deleted_at);
    const { error } = await supabase
      .from("match_events")
      .update({
        deleted_at: restoring ? null : new Date().toISOString(),
        deleted_by: restoring ? null : uid,
      })
      .eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: restoring ? "restauration événement" : "suppression événement",
      entity: "match_event",
      entityId: ev.id,
      matchId: id,
      details: { type: ev.event_type },
    });
    refresh();
  };

  const setStatus = async (status: "en_cours" | "finalise") => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase
      .from("matches")
      .update({
        status,
        finalized_at: status === "finalise" ? new Date().toISOString() : null,
        finalized_by: status === "finalise" ? uid : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: status === "finalise" ? "finalisation" : "réouverture",
      entity: "match",
      entityId: id,
      matchId: id,
    });
    void qc.invalidateQueries({ queryKey: ["match", id] });
    void qc.invalidateQueries({ queryKey: ["matches"] });
    refresh();
    toast.success(status === "finalise" ? "Match finalisé" : "Match réouvert");
  };

  if (matchQ.isLoading) return <AppShell>Chargement…</AppShell>;
  if (!match)
    return (
      <AppShell>
        <p>Match introuvable.</p>
      </AppShell>
    );

  const visibleEvents = [...events]
    .filter((e) => showDeleted || !e.deleted_at)
    .reverse();

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/matchs">
          <ArrowLeft className="size-4" /> Retour aux matchs
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <div className="pitch-gradient px-5 py-5 text-sidebar-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{teamLabel(match.team)}</Badge>
            <Badge variant={finalized ? "default" : "outline"} className={finalized ? "" : "text-sidebar-foreground"}>
              {finalized ? "Finalisé" : "En cours"}
            </Badge>
            <span className="text-xs text-sidebar-foreground/70">
              {new Date(match.match_date).toLocaleDateString("fr-FR")} · {match.competition_type} ·{" "}
              {match.location} · {match.field || "terrain n.c."} · {match.weather} · vent{" "}
              {match.wind} · rugby à {match.format}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-3xl font-bold uppercase">AS Meudon — {match.opponent}</h1>
            <div className="font-display text-5xl font-bold tabular-nums">
              {stats.sides.meudon.points}
              <span className="mx-2 text-sidebar-foreground/50">–</span>
              {stats.sides.adversaire.points}
            </div>
          </div>
          <p className="mt-2 text-xs text-sidebar-foreground/70">
            Période active : {periodLabel(period)} · {stats.eventCount} événements actifs
          </p>
        </div>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "outline"}
              disabled={!editable || periodStarted(events, p.startEvent)}
              onClick={() => insertEvent(defaultDraft(p.startEvent))}
            >
              {periodStarted(events, p.startEvent) ? "✓ " : ""}
              {p.label}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            {editable && (
              <Button size="sm" variant="secondary" onClick={() => setStatus("finalise")}>
                <Lock className="size-4" /> Finaliser
              </Button>
            )}
            {finalized && isAdmin && (
              <Button size="sm" variant="secondary" onClick={() => setStatus("en_cours")}>
                <RotateCcw className="size-4" /> Réouvrir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="saisie" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="saisie">Saisie</TabsTrigger>
          <TabsTrigger value="stats-match">Stats match</TabsTrigger>
          <TabsTrigger value="stats-joueurs">Stats joueurs</TabsTrigger>
          <TabsTrigger value="feuille">Feuille de match</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        {/* ── SAISIE ── */}
        <TabsContent value="saisie" className="space-y-4">
          {!editable && (
            <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {finalized
                ? "Match finalisé : la saisie est verrouillée. Un administrateur peut le réouvrir."
                : "Votre rôle Lecteur permet uniquement la consultation."}
            </p>
          )}

          <Card>
            <CardContent className="pt-5 space-y-5">
              {EVENT_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="label-kicker mb-2 text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.types.map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!editable}
                        onClick={() => setActiveType(activeType === t ? null : t)}
                        className={cn(
                          "rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                          activeType === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent/10",
                        )}
                      >
                        {EVENT_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {activeType && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="mb-3 font-display text-sm font-semibold uppercase text-primary">
                    {EVENT_LABELS[activeType]}
                  </p>
                  <EventForm
                    key={activeType}
                    type={activeType}
                    players={players}
                    submitLabel="Enregistrer"
                    onSubmit={async (draft) => {
                      await insertEvent(draft);
                      setActiveType(null);
                    }}
                    onCancel={() => setActiveType(null)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="uppercase">Journal</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="showdel" className="text-xs text-muted-foreground">
                  Voir les supprimés
                </Label>
                <Switch id="showdel" checked={showDeleted} onCheckedChange={setShowDeleted} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {!visibleEvents.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun événement enregistré.
                </p>
              )}
              {visibleEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    ev.deleted_at && "opacity-50 line-through",
                  )}
                >
                  <Badge variant="outline" className="shrink-0">
                    {periodLabel(ev.period)}
                  </Badge>
                  <span className="font-medium">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                  <span className="text-muted-foreground">{eventSummary(ev)}</span>
                  {ev.team_side && (
                    <Badge variant="secondary" className="shrink-0">
                      {ev.team_side === "meudon" ? "Meudon" : "Adversaire"}
                    </Badge>
                  )}
                  {editable && !ev.event_type.startsWith("debut_") && (
                    <div className="ml-auto flex gap-1">
                      {!ev.deleted_at && (
                        <Button size="icon" variant="ghost" onClick={() => setEditing(ev)} aria-label="Modifier">
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleDelete(ev)}
                        aria-label={ev.deleted_at ? "Restaurer" : "Supprimer"}
                      >
                        {ev.deleted_at ? <Undo2 className="size-4" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STATS MATCH ── */}
        <TabsContent value="stats-match">
          <Card>
            <CardHeader>
              <CardTitle className="uppercase">Comparatif collectif</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-display uppercase">Meudon</th>
                    <th className="py-2 text-center font-display uppercase">Statistique</th>
                    <th className="py-2 text-right font-display uppercase">Adversaire</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Points", stats.sides.meudon.points, stats.sides.adversaire.points],
                    ["Essais", stats.sides.meudon.essais, stats.sides.adversaire.essais],
                    ["Transformations", stats.sides.meudon.transformations, stats.sides.adversaire.transformations],
                    ["Pénalités au but", stats.sides.meudon.penalitesBut, stats.sides.adversaire.penalitesBut],
                    ["Essais de pénalité", stats.sides.meudon.essaisPenalite, stats.sides.adversaire.essaisPenalite],
                    [`Mêlées (gagnées)`, `${stats.sides.meudon.melees} (${stats.sides.meudon.meleesGagnees})`, `${stats.sides.adversaire.melees} (${stats.sides.adversaire.meleesGagnees})`],
                    [`Touches (gagnées)`, `${stats.sides.meudon.touches} (${stats.sides.meudon.touchesGagnees})`, `${stats.sides.adversaire.touches} (${stats.sides.adversaire.touchesGagnees})`],
                    ["Turnovers", stats.sides.meudon.turnovers, stats.sides.adversaire.turnovers],
                    ["Pénalités concédées", stats.sides.meudon.penalitesConcedees, stats.sides.adversaire.penalitesConcedees],
                    [`Cartons (B/J/R)`, `${stats.sides.meudon.cartons.blanc}/${stats.sides.meudon.cartons.jaune}/${stats.sides.meudon.cartons.rouge}`, `${stats.sides.adversaire.cartons.blanc}/${stats.sides.adversaire.cartons.jaune}/${stats.sides.adversaire.cartons.rouge}`],
                    ["Entrées dans les 22", stats.sides.meudon.entrees22, stats.sides.adversaire.entrees22],
                    ["50/22", stats.sides.meudon.cinquante22, stats.sides.adversaire.cinquante22],
                    ["Passes", stats.sides.meudon.passes, stats.sides.adversaire.passes],
                    ["Offloads", stats.sides.meudon.offloads, stats.sides.adversaire.offloads],
                    ["Ballons touchés", stats.sides.meudon.ballonsTouches, stats.sides.adversaire.ballonsTouches],
                    [`Plaquages (off/déf/n)`, `${stats.sides.meudon.plaquages.offensif}/${stats.sides.meudon.plaquages.defensif}/${stats.sides.meudon.plaquages.neutre}`, `${stats.sides.adversaire.plaquages.offensif}/${stats.sides.adversaire.plaquages.defensif}/${stats.sides.adversaire.plaquages.neutre}`],
                    [`JAP (gain/perte)`, `${stats.sides.meudon.jeuAuPied.total} (${stats.sides.meudon.jeuAuPied.gain}/${stats.sides.meudon.jeuAuPied.perte})`, `${stats.sides.adversaire.jeuAuPied.total} (${stats.sides.adversaire.jeuAuPied.gain}/${stats.sides.adversaire.jeuAuPied.perte})`],
                  ].map(([label, a, b]) => (
                    <tr key={String(label)} className="border-b last:border-0">
                      <td className="py-1.5 font-semibold tabular-nums">{a}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{label}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STATS JOUEURS ── */}
        <TabsContent value="stats-joueurs">
          <Card>
            <CardHeader>
              <CardTitle className="uppercase">Bilan individuel</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!stats.players.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun événement attribué à un joueur.
                </p>
              )}
              {!!stats.players.length && (
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Joueur</th>
                      <th>Pts</th>
                      <th>Essais</th>
                      <th>Passes</th>
                      <th>Offloads</th>
                      <th>Ballons</th>
                      <th>Plaq. o/d/n</th>
                      <th>JAP (gain)</th>
                      <th>Turn.</th>
                      <th>Pén.</th>
                      <th>Cart.</th>
                      <th>50/22</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {stats.players.map((p) => (
                      <tr key={p.number} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{playerName(players, p.number)}</td>
                        <td>{p.points}</td>
                        <td>{p.essais}</td>
                        <td>{p.passes}</td>
                        <td>{p.offloads}</td>
                        <td>{p.ballonsTouches}</td>
                        <td>{p.plaquagesOffensifs}/{p.plaquagesDefensifs}/{p.plaquagesNeutres}</td>
                        <td>{p.jeuAuPied} ({p.jeuAuPiedGain})</td>
                        <td>{p.turnovers}</td>
                        <td>{p.penalites}</td>
                        <td>{p.cartons}</td>
                        <td>{p.cinquante22}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FEUILLE DE MATCH ── */}
        <TabsContent value="feuille">
          <Card>
            <CardHeader>
              <CardTitle className="uppercase">Feuille de match — Rugby à {match.format}</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchSheetEditor
                matchId={id}
                format={match.format}
                canEdit={editable}
                team={match.team}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORIQUE ── */}
        <TabsContent value="historique">
          <Card>
            <CardHeader>
              <CardTitle className="uppercase">Historique des modifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {!(auditQ.data ?? []).length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune entrée d'historique.
                </p>
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
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corriger l'événement</DialogTitle>
          </DialogHeader>
          {editing && (
            <EventForm
              type={editing.event_type}
              players={players}
              initial={editing}
              submitLabel="Enregistrer la correction"
              onSubmit={(draft) => updateEvent(editing, draft)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
