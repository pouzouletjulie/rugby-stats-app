import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CARD_COLORS,
  EVENT_LABELS,
  KICK_KINDS,
  KICK_RESULTS,
  PASS_KINDS,
  PENALTY_MOTIFS,
  POINT_KINDS,
  SIDES,
  TACKLE_KINDS,
  TOUCHE_SUITES,
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
        { k: "select", key: "zone", label: "Zone", options: opts(ZONES) },
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
        { k: "select", key: "zone", label: "Zone", options: opts(ZONES) },
        { k: "select", key: "possession", label: "Possession", options: SIDES },
        { k: "select", key: "gain", label: "Gain", options: SIDES },
        { k: "select", key: "suite", label: "Suite de jeu", options: opts(TOUCHE_SUITES) },
        { k: "switch", key: "bloc", label: "Bloc" },
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
      return [{ k: "team", label: "Équipe qui entre dans les 22" }];
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
          team_side: initial.team_side ?? "meudon",
          player_number: initial.player_number ?? null,
          payload: { ...defaultDraft(initial.event_type).payload, ...(initial.payload ?? {}) },
        }
      : defaultDraft(type),
  );

  const fields = fieldsFor(draft.event_type);
  const setPayload = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, payload: { ...d.payload, [key]: value } }));

  const numbers = players.length
    ? players.map((p) => p.number).sort((a, b) => a - b)
    : Array.from({ length: 22 }, (_, i) => i + 1);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <p className="label-kicker">{EVENT_LABELS[draft.event_type] ?? draft.event_type}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          if (f.k === "team") {
            return (
              <div key="team" className="space-y-1.5">
                <Label>{f.label ?? "Équipe"}</Label>
                <Select
                  value={draft.team_side ?? "meudon"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, team_side: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIDES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          if (f.k === "player") {
            return (
              <div key="player" className="space-y-1.5">
                <Label>Joueur (optionnel)</Label>
                <Select
                  value={draft.player_number ? String(draft.player_number) : "none"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, player_number: v === "none" ? null : Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non identifié</SelectItem>
                    {numbers.map((n) => {
                      const p = players.find((x) => x.number === n);
                      const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
                      return (
                        <SelectItem key={n} value={String(n)}>
                          n°{n}
                          {name ? ` — ${name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          if (f.k === "switch") {
            return (
              <div key={f.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label>{f.label}</Label>
                <Switch
                  checked={Boolean(draft.payload[f.key])}
                  onCheckedChange={(v) => setPayload(f.key, v)}
                />
              </div>
            );
          }
          return (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Select
                value={String(draft.payload[f.key] ?? "")}
                onValueChange={(v) => setPayload(f.key, v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
