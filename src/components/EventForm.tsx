import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CARD_COLORS,
  KICK_KINDS,
  KICK_RESULTS,
  PASS_KINDS,
  PENALTY_MOTIFS,
  POINT_KINDS,
  SIDES,
  TACKLE_KINDS,
  TOUCHE_SUITES,
  TOUCHE_ZONES,
  TURNOVER_NATURES,
  ZONES,
  type MatchEvent,
  type MatchPlayer,
} from "@/lib/rugby";

export type EventDraft = {
  event_type: string;
  team_side: string | null;
  player_number: number | null;
  payload: Record<string, unknown>;
};

type Option = { value: string; label: string };

type FieldDef =
  | { k: "team"; label?: string }
  | { k: "player" }
  | { k: "select"; key: string; label: string; options: readonly Option[] }
  | { k: "switch"; key: string; label: string };

const opts = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }));

export function fieldsFor(type: string): FieldDef[] {
  switch (type) {
    case "melee":
      return [
        { k: "select", key: "zone", label: "Zone", options: opts(TOUCHE_ZONES) },
        { k: "select", key: "possession", label: "Possession", options: SIDES },
        { k: "select", key: "gain", label: "Gain", options: SIDES },
        {
          k: "select",
          key: "sortie",
          label: "Sortie",
          options: [
            { value: "8", label: "Sortie du 8" },
            { value: "9", label: "Sortie du 9" },
          ],
        },
      ];
    case "touche":
      return [
        { k: "select", key: "zone", label: "Zone", options: opts(TOUCHE_ZONES) },
        { k: "select", key: "possession", label: "Possession", options: SIDES },
        { k: "select", key: "gain", label: "Gain", options: SIDES },
        { k: "select", key: "suite", label: "Suite de jeu", options: opts(TOUCHE_SUITES) },
        { k: "switch", key: "en_avant", label: "En-avant (crée aussi un événement en-avant)" },
        {
          k: "select",
          key: "bloc",
          label: "Bloc (lignes soulevées)",
          options: [
            { value: "0", label: "0" },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
          ],
        },
      ];
    case "en_avant":
      return [
        { k: "team", label: "Équipe sanctionnée" },
        { k: "player" },
      ];
    case "turnover":
      return [
        { k: "team", label: "Équipe bénéficiaire" },
        { k: "select", key: "nature", label: "Nature", options: TURNOVER_NATURES },
        { k: "player" },
      ];
    case "penalite":
      return [
        { k: "team", label: "Équipe sanctionnée" },
        { k: "select", key: "motif", label: "Motif", options: PENALTY_MOTIFS },
        { k: "switch", key: "dix_metres", label: "10 mètres" },
        { k: "player" },
      ];
    case "carton":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "couleur", label: "Couleur", options: CARD_COLORS },
        { k: "player" },
      ];
    case "points":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "kind", label: "Type", options: POINT_KINDS },
        { k: "player" },
      ];
    case "entree_22":
      return [
        { k: "team", label: "Équipe qui entre dans les 22" },
        {
          k: "select",
          key: "efficace",
          label: "Résultat",
          options: [
            { value: "oui", label: "Efficace" },
            { value: "non", label: "Non efficace" },
          ],
        },
      ];
    case "cinquante_22":
      return [{ k: "team", label: "Équipe" }, { k: "player" }];
    case "passe":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "kind", label: "Type", options: PASS_KINDS },
        { k: "player" },
      ];
    case "ballon_touche":
      return [{ k: "team", label: "Équipe" }, { k: "player" }];
    case "plaquage":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "kind", label: "Type", options: TACKLE_KINDS },
        { k: "player" },
      ];
    case "jeu_au_pied":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "kind", label: "Type", options: KICK_KINDS },
        { k: "select", key: "resultat", label: "Résultat", options: KICK_RESULTS },
        { k: "player" },
      ];
    default:
      return [];
  }
}

export function defaultDraft(type: string, playerNumber: number | null = null): EventDraft {
  const payload: Record<string, unknown> = {};
  for (const f of fieldsFor(type)) {
    if (f.k === "select") payload[f.key] = f.options[0]?.value ?? "";
    if (f.k === "switch") payload[f.key] = false;
  }
  return { event_type: type, team_side: "meudon", player_number: playerNumber, payload };
}

function BtnGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent/10",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerField({
  players,
  value,
  onChange,
}: {
  players: MatchPlayer[];
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const selected = players.find((p) => p.number === value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Joueur (optionnel)
        </p>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Effacer
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => {
          const mp = players.find((p) => p.number === n);
          const initials = mp
            ? [mp.first_name, mp.last_name]
                .map((s) => s?.trim()[0]?.toUpperCase() ?? "")
                .filter(Boolean)
                .join("")
            : null;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? null : n)}
              title={mp ? `${mp.first_name ?? ""} ${mp.last_name ?? ""}`.trim() || `n°${n}` : `n°${n}`}
              className={cn(
                "flex flex-col items-center justify-center rounded border transition-colors",
                initials ? "h-11 w-11" : "size-9",
                value === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : mp
                    ? "border-border bg-background hover:bg-accent/10"
                    : "border-dashed border-muted-foreground/20 text-muted-foreground/40 hover:bg-accent/5",
              )}
            >
              <span className="text-sm font-bold tabular-nums leading-none">{n}</span>
              {initials && (
                <span className={cn("mt-0.5 text-[9px] font-semibold leading-none tracking-tight",
                  value === n ? "text-primary-foreground/80" : "text-muted-foreground",
                )}>
                  {initials}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          n°{value} · {[selected.first_name, selected.last_name].filter(Boolean).join(" ")}
          {selected.nickname ? ` « ${selected.nickname} »` : ""}
        </p>
      )}
    </div>
  );
}

export function EventForm({
  type,
  players,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  type: string;
  players: MatchPlayer[];
  initial?: MatchEvent | null;
  onSubmit: (draft: EventDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initial
      ? {
          event_type: initial.event_type,
          team_side: initial.team_side,
          player_number: initial.player_number,
          payload: { ...(initial.payload as Record<string, unknown>) },
        }
      : defaultDraft(type),
  );

  const setPayload = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, payload: { ...d.payload, [key]: value } }));

  const fields = useMemo(() => fieldsFor(type), [type]);

  return (
    <div className="space-y-4">
      {fields.map((f, i) => {
        if (f.k === "team") {
          return (
            <BtnGroup
              key={i}
              label={f.label ?? "Équipe"}
              options={SIDES}
              value={draft.team_side ?? "meudon"}
              onChange={(v) => setDraft((d) => ({ ...d, team_side: v }))}
            />
          );
        }
        if (f.k === "select") {
          return (
            <BtnGroup
              key={i}
              label={f.label}
              options={f.options}
              value={String(draft.payload[f.key] ?? f.options[0]?.value ?? "")}
              onChange={(v) => setPayload(f.key, v)}
            />
          );
        }
        if (f.k === "switch") {
          return (
            <div key={i} className="flex items-center gap-3">
              <Switch
                id={`sw-${f.key}`}
                checked={Boolean(draft.payload[f.key])}
                onCheckedChange={(v) => setPayload(f.key, v)}
              />
              <Label htmlFor={`sw-${f.key}`}>{f.label}</Label>
            </div>
          );
        }
        if (f.k === "player") {
          return (
            <PlayerField
              key={i}
              players={players}
              value={draft.player_number}
              onChange={(n) => setDraft((d) => ({ ...d, player_number: n }))}
            />
          );
        }
        return null;
      })}

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" onClick={() => onSubmit(draft)}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
