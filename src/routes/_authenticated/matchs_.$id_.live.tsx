import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CARD_COLORS,
  PERIODS,
  POINT_KINDS,
  activePeriod,
  periodLabel,
  periodStarted,
  type MatchEvent,
  type MatchPlayer,
} from "@/lib/rugby";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/matchs_/$id_/live")({
  component: LivePage,
});

// ── Shared sub-components ────────────────────────────────────

function TeamToggle({
  value,
  onChange,
}: {
  value: "meudon" | "adversaire";
  onChange: (v: "meudon" | "adversaire") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["meudon", "adversaire"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "rounded-xl py-4 text-lg font-bold transition-colors",
            value === t
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {t === "meudon" ? "Meudon" : "Adversaire"}
        </button>
      ))}
    </div>
  );
}

function PlayerPicker({
  players,
  value,
  onChange,
}: {
  players: MatchPlayer[];
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => {
        const name =
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          `n°${p.number}`;
        return (
          <button
            key={p.number}
            type="button"
            onClick={() => onChange(value === p.number ? null : p.number)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              value === p.number
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background",
            )}
          >
            <span className="mr-1 text-xs opacity-60">n°{p.number}</span>
            {name}
          </button>
        );
      })}
    </div>
  );
}

function SubmitBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground active:opacity-80"
    >
      {label}
    </button>
  );
}

// ── Sheet forms ──────────────────────────────────────────────

function PenaliteSheet({
  onSubmit,
}: {
  onSubmit: (team: "meudon" | "adversaire") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSubmit("meudon")}
        className="rounded-xl bg-primary py-6 text-lg font-bold text-primary-foreground active:opacity-80"
      >
        Meudon
      </button>
      <button
        type="button"
        onClick={() => onSubmit("adversaire")}
        className="rounded-xl bg-muted py-6 text-lg font-bold active:opacity-80"
      >
        Adversaire
      </button>
    </div>
  );
}

function EnAvantSheet({
  onSubmit,
}: {
  onSubmit: (team: "meudon" | "adversaire") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSubmit("meudon")}
        className="rounded-xl bg-primary py-6 text-lg font-bold text-primary-foreground active:opacity-80"
      >
        Meudon
      </button>
      <button
        type="button"
        onClick={() => onSubmit("adversaire")}
        className="rounded-xl bg-muted py-6 text-lg font-bold active:opacity-80"
      >
        Adversaire
      </button>
    </div>
  );
}

function ToucheSheet({
  onSubmit,
}: {
  onSubmit: (
    possession: "meudon" | "adversaire",
    gain: "meudon" | "adversaire",
  ) => void;
}) {
  const [possession, setPossession] = useState<"meudon" | "adversaire">(
    "meudon",
  );
  const [gain, setGain] = useState<"meudon" | "adversaire">("meudon");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lance
        </p>
        <TeamToggle value={possession} onChange={setPossession} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Gain
        </p>
        <TeamToggle value={gain} onChange={setGain} />
      </div>
      <SubmitBtn label="Enregistrer" onClick={() => onSubmit(possession, gain)} />
    </div>
  );
}

function MeleeSheet({
  onSubmit,
}: {
  onSubmit: (
    possession: "meudon" | "adversaire",
    gain: "meudon" | "adversaire",
  ) => void;
}) {
  const [possession, setPossession] = useState<"meudon" | "adversaire">(
    "meudon",
  );
  const [gain, setGain] = useState<"meudon" | "adversaire">("meudon");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Possession
        </p>
        <TeamToggle value={possession} onChange={setPossession} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Gain
        </p>
        <TeamToggle value={gain} onChange={setGain} />
      </div>
      <SubmitBtn label="Enregistrer" onClick={() => onSubmit(possession, gain)} />
    </div>
  );
}

function TurnoverSheet({
  players,
  onSubmit,
}: {
  players: MatchPlayer[];
  onSubmit: (team: "meudon" | "adversaire", player: number | null) => void;
}) {
  const [team, setTeam] = useState<"meudon" | "adversaire">("meudon");
  const [player, setPlayer] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <TeamToggle
        value={team}
        onChange={(t) => {
          setTeam(t);
          setPlayer(null);
        }}
      />
      {team === "meudon" && players.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Joueur (optionnel)
          </p>
          <PlayerPicker players={players} value={player} onChange={setPlayer} />
        </div>
      )}
      <SubmitBtn
        label="Enregistrer"
        onClick={() => onSubmit(team, player)}
      />
    </div>
  );
}

function Entree22Sheet({
  onSubmit,
}: {
  onSubmit: (efficace: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSubmit(true)}
        className="rounded-xl bg-emerald-500 py-6 text-lg font-bold text-white active:opacity-80"
      >
        Efficace
      </button>
      <button
        type="button"
        onClick={() => onSubmit(false)}
        className="rounded-xl bg-muted py-6 text-lg font-bold active:opacity-80"
      >
        Non efficace
      </button>
    </div>
  );
}

function ReceptionSheet({
  onSubmit,
}: {
  onSubmit: (reussi: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSubmit(true)}
        className="rounded-xl bg-emerald-500 py-6 text-lg font-bold text-white active:opacity-80"
      >
        Réussie
      </button>
      <button
        type="button"
        onClick={() => onSubmit(false)}
        className="rounded-xl bg-muted py-6 text-lg font-bold active:opacity-80"
      >
        Manquée
      </button>
    </div>
  );
}

const CARD_COLOR_STYLES: Record<string, string> = {
  blanc: "bg-white border-2 border-gray-300 text-gray-800",
  jaune: "bg-yellow-400 text-yellow-900",
  bleu: "bg-blue-500 text-white",
  rouge: "bg-red-600 text-white",
};

function CartonSheet({
  players,
  onSubmit,
}: {
  players: MatchPlayer[];
  onSubmit: (
    team: "meudon" | "adversaire",
    couleur: string,
    player: number | null,
  ) => void;
}) {
  const [team, setTeam] = useState<"meudon" | "adversaire">("meudon");
  const [couleur, setCouleur] = useState<string>("jaune");
  const [player, setPlayer] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Couleur
        </p>
        <div className="grid grid-cols-4 gap-2">
          {CARD_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCouleur(c.value)}
              className={cn(
                "rounded-xl py-3 text-sm font-bold transition-all",
                CARD_COLOR_STYLES[c.value] ?? "bg-muted",
                couleur === c.value
                  ? "ring-2 ring-primary ring-offset-2"
                  : "opacity-60",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Équipe
        </p>
        <TeamToggle
          value={team}
          onChange={(t) => {
            setTeam(t);
            setPlayer(null);
          }}
        />
      </div>
      {team === "meudon" && players.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Joueur
          </p>
          <PlayerPicker players={players} value={player} onChange={setPlayer} />
        </div>
      )}
      <SubmitBtn
        label="Enregistrer"
        onClick={() => onSubmit(team, couleur, player)}
      />
    </div>
  );
}

function PointsSheet({
  onSubmit,
}: {
  onSubmit: (team: "meudon" | "adversaire", kind: string) => void;
}) {
  const [team, setTeam] = useState<"meudon" | "adversaire">("meudon");
  const [kind, setKind] = useState<string>("essai");
  return (
    <div className="space-y-4">
      <TeamToggle value={team} onChange={setTeam} />
      <div className="grid grid-cols-2 gap-2">
        {POINT_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn(
              "rounded-xl py-3 text-sm font-bold transition-colors",
              kind === k.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            {k.label}
            <span className="block text-xs opacity-70">+{k.points} pts</span>
          </button>
        ))}
      </div>
      <SubmitBtn
        label="Enregistrer"
        onClick={() => onSubmit(team, kind)}
      />
    </div>
  );
}

// ── Tile definitions ─────────────────────────────────────────

const TILES = [
  {
    id: "penalite",
    label: "Pénalité",
    bg: "bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700",
  },
  {
    id: "en_avant",
    label: "En-avant",
    bg: "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700",
  },
  {
    id: "touche",
    label: "Touche",
    bg: "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700",
  },
  {
    id: "melee",
    label: "Mêlée",
    bg: "bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700",
  },
  {
    id: "turnover",
    label: "Turnover",
    bg: "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700",
  },
  {
    id: "entree_22",
    label: "Entrée 22m",
    bg: "bg-teal-100 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700",
  },
  {
    id: "reception",
    label: "Réception",
    bg: "bg-sky-100 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700",
  },
  {
    id: "carton",
    label: "Carton",
    bg: "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700",
  },
  {
    id: "points",
    label: "Points",
    bg: "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700",
    colSpan: true,
  },
] as const;

// ── Main page ─────────────────────────────────────────────────

function LivePage() {
  const { id } = Route.useParams();
  const { canEditTeam } = useAuth();
  const qc = useQueryClient();
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  const matchQ = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .single();
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
    refetchInterval: 10000,
  });

  const match = matchQ.data;
  const players = playersQ.data ?? [];
  const events = eventsQ.data ?? [];
  const period = activePeriod(events);
  const editable =
    canEditTeam(match?.team ?? "") && match?.status !== "finalise";

  const refresh = () =>
    void qc.invalidateQueries({ queryKey: ["match-events", id] });

  const insertEvent = async (
    event_type: string,
    team_side: string | null,
    player_number: number | null,
    payload: Record<string, unknown>,
  ) => {
    if (!editable) {
      toast.error("Match non éditable");
      return;
    }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const usePeriod = event_type.startsWith("debut_")
      ? (PERIODS.find((p) => p.startEvent === event_type)?.value ?? null)
      : period;
    if (!usePeriod && !event_type.startsWith("debut_")) {
      toast.error("Activez d'abord une période");
      return;
    }
    const { error } = await supabase.from("match_events").insert({
      match_id: id,
      period: usePeriod,
      event_type,
      team_side,
      player_number,
      payload,
      created_by: uid,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    setActiveSheet(null);
    toast.success("Enregistré");
  };

  const renderSheet = () => {
    switch (activeSheet) {
      case "penalite":
        return (
          <PenaliteSheet
            onSubmit={(team) => insertEvent("penalite", team, null, {})}
          />
        );
      case "en_avant":
        return (
          <EnAvantSheet
            onSubmit={(team) => insertEvent("en_avant", team, null, {})}
          />
        );
      case "touche":
        return (
          <ToucheSheet
            onSubmit={(pos, gain) =>
              insertEvent("touche", pos, null, { possession: pos, gain })
            }
          />
        );
      case "melee":
        return (
          <MeleeSheet
            onSubmit={(pos, gain) =>
              insertEvent("melee", pos, null, { possession: pos, gain })
            }
          />
        );
      case "turnover":
        return (
          <TurnoverSheet
            players={players}
            onSubmit={(team, player) =>
              insertEvent("turnover", team, player, {})
            }
          />
        );
      case "entree_22":
        return (
          <Entree22Sheet
            onSubmit={(efficace) =>
              insertEvent("entree_22", "meudon", null, {
                efficace: efficace ? "oui" : "non",
              })
            }
          />
        );
      case "reception":
        return (
          <ReceptionSheet
            onSubmit={(reussi) =>
              insertEvent("reception_coup_envoi", null, null, { reussi })
            }
          />
        );
      case "carton":
        return (
          <CartonSheet
            players={players}
            onSubmit={(team, couleur, player) =>
              insertEvent("carton", team, player, { couleur })
            }
          />
        );
      case "points":
        return (
          <PointsSheet
            onSubmit={(team, kind) =>
              insertEvent("points", team, null, { kind })
            }
          />
        );
      default:
        return null;
    }
  };

  if (matchQ.isLoading)
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        Chargement…
      </div>
    );

  return (
    <div
      className="flex flex-col overflow-hidden bg-background"
      style={{ height: "100dvh" }}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-background px-3 py-2">
        <Link
          to="/matchs/$id"
          params={{ id }}
          className="text-muted-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="truncate text-sm font-semibold">
          AS Meudon — {match?.opponent}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {period ? periodLabel(period) : "Pas de période"}
        </span>
      </div>

      {/* ── Period toggles ── */}
      <div className="flex shrink-0 gap-2 border-b bg-muted/20 px-3 py-2">
        {PERIODS.map((p) => {
          const started = periodStarted(events, p.startEvent);
          const isCurrent = period === p.value;
          return (
            <button
              key={p.value}
              type="button"
              disabled={!editable || isCurrent}
              onClick={() => insertEvent(p.startEvent, null, null, {})}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : started
                    ? "bg-muted text-muted-foreground line-through opacity-50"
                    : "border border-border bg-background hover:bg-accent/10",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Tile grid ── */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={!editable || (!period && !tile.id.startsWith("debut_"))}
            onClick={() => setActiveSheet(tile.id)}
            className={cn(
              "flex items-center justify-center rounded-2xl border-2 text-center font-bold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30",
              tile.bg,
              "colSpan" in tile && tile.colSpan ? "col-span-2" : "",
            )}
          >
            <span className="text-base leading-tight">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* ── Bottom sheet ── */}
      {activeSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setActiveSheet(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-wide">
                {TILES.find((t) => t.id === activeSheet)?.label}
              </h2>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            {renderSheet()}
          </div>
        </>
      )}
    </div>
  );
}
