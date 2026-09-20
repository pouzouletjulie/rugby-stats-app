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
  PENALTY_CHOICES,
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
  | { k: "zone"; key: string; label: string }
  | { k: "select"; key: string; label: string; options: readonly Option[] }
  | { k: "switch"; key: string; label: string };

const opts = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }));

export function fieldsFor(type: string, payload?: Record<string, unknown>, teamSide?: string | null): FieldDef[] {
  switch (type) {
    case "melee": {
      const gain = String(payload?.["gain"] ?? "meudon");
      const fields: FieldDef[] = [
        { k: "zone", key: "zone", label: "Zone" },
        { k: "select", key: "possession", label: "Possession", options: SIDES },
        { k: "select", key: "gain", label: "Gain", options: SIDES },
      ];
      if (gain === "meudon") {
        fields.push({
          k: "select",
          key: "sortie",
          label: "Sortie",
          options: [
            { value: "8", label: "Sortie du 8" },
            { value: "9", label: "Sortie du 9" },
            { value: "bras_casse", label: "Bras cassé (pénalité)" },
          ],
        });
      }
      return fields;
    }
    case "touche": {
      const joueVite = payload?.["joue_vite"] === true;
      const possession = String(payload?.["possession"] ?? "meudon");
      const gain = String(payload?.["gain"] ?? "meudon");
      const base: FieldDef[] = [
        { k: "zone", key: "zone", label: "Zone" },
        { k: "select", key: "possession", label: "Possession", options: SIDES },
        { k: "select", key: "gain", label: "Gain", options: SIDES },
        { k: "switch", key: "joue_vite", label: "Joue vite" },
      ];
      if (!joueVite) {
        if (possession === "meudon") {
          base.push({
            k: "select",
            key: "bloc",
            label: "Bloc (lignes soulevées)",
            options: [
              { value: "0", label: "0" },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "pb", label: "PB" },
            ],
          });
        }
        if (gain === "meudon") {
          base.push({ k: "select", key: "suite", label: "Suite de jeu", options: opts(TOUCHE_SUITES) });
        }
      }
      return base;
    }
    case "en_avant":
      return teamSide === "meudon"
        ? [{ k: "team", label: "Équipe sanctionnée" }, { k: "player" }]
        : [{ k: "team", label: "Équipe sanctionnée" }];
    case "turnover":
      return [
        { k: "team", label: "Équipe bénéficiaire" },
        { k: "select", key: "nature", label: "Nature", options: TURNOVER_NATURES },
        { k: "player" },
      ];
    case "penalite": {
      const fields: FieldDef[] = [
        { k: "team", label: "Équipe sanctionnée" },
        { k: "zone", key: "zone", label: "Zone" },
        { k: "player" },
      ];
      if (teamSide === "meudon") {
        fields.splice(1, 0, {
          k: "select",
          key: "motif",
          label: "Motif",
          options: PENALTY_MOTIFS.filter((m) => m.value !== "melee"),
        });
      }
      if (teamSide === "adversaire") {
        fields.splice(2, 0, {
          k: "select",
          key: "choix",
          label: "Notre choix",
          options: PENALTY_CHOICES,
        });
        if (payload?.["choix"] === "penaltouche") {
          fields.splice(3, 0, {
            k: "switch",
            key: "penaltouche_trouvee",
            label: "Pénaltouche trouvée",
          });
        }
      }
      return fields;
    }
    case "carton":
      return [
        { k: "team", label: "Équipe" },
        { k: "select", key: "couleur", label: "Couleur", options: CARD_COLORS },
        { k: "player" },
      ];
    case "points": {
      const pointsKind = String(payload?.["kind"] ?? "essai");
      const isKick = (pointsKind === "transformation" || pointsKind === "penalite_but" || pointsKind === "drop") && teamSide === "meudon";
      const isPositioned = (pointsKind === "transformation" || pointsKind === "penalite_but") && teamSide === "meudon";
      const fields: FieldDef[] = [
        { k: "team", label: "Équipe" },
        { k: "select", key: "kind", label: "Type", options: POINT_KINDS },
      ];
      if (isKick) fields.push({ k: "switch", key: "reussi", label: "Réussi" });
      if (isPositioned) {
        fields.push({
          k: "select",
          key: "position_cote",
          label: "Côté",
          options: [
            { value: "gauche", label: "Gauche terrain" },
            { value: "milieu", label: "Milieu terrain" },
            { value: "droite", label: "Droite terrain" },
          ],
        });
        fields.push({
          k: "select",
          key: "position_distance",
          label: "Distance",
          options: [
            { value: "22m", label: "22m" },
            { value: "40m", label: "40m" },
            { value: "50m", label: "50m" },
          ],
        });
      }
      if (teamSide === "meudon") fields.push({ k: "player" });
      return fields;
    }
    case "entree_22":
      return [
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
    case "jeu_au_pied": {
      const kind = String(payload?.kind ?? "");
      const base: FieldDef[] = [
        { k: "select", key: "kind", label: "Type", options: KICK_KINDS },
      ];
      if (kind === "engagement") {
        return [
          ...base,
          { k: "switch", key: "recupere", label: "Récupéré" },
          { k: "switch", key: "moins_10m", label: "Moins de 10m" },
          { k: "switch", key: "direct_touche", label: "Direct en touche" },
          { k: "switch", key: "plaquage_immediat", label: "Plaquage immédiat" },
          { k: "player" },
        ];
      }
      if (kind === "chandelle" || kind === "box_kick" || kind === "par_dessus") {
        return [
          ...base,
          { k: "zone", key: "zone", label: "Zone de destination" },
          { k: "switch", key: "recupere", label: "Récupéré" },
          { k: "player" },
        ];
      }
      if (kind === "rasant") {
        return [
          ...base,
          { k: "zone", key: "zone", label: "Zone de destination" },
          { k: "switch", key: "gain_terrain", label: "Gain de terrain" },
          { k: "switch", key: "touche", label: "Sorti en touche" },
          { k: "player" },
        ];
      }
      if (kind === "degagement") {
        const fields: FieldDef[] = [
          ...base,
          { k: "zone", key: "zone", label: "Zone de destination" },
          { k: "switch", key: "gain_terrain", label: "Gain de terrain" },
          { k: "switch", key: "touche", label: "Sorti en touche" },
        ];
        if (payload?.["touche"] === true) {
          fields.push({ k: "switch", key: "touche_directe", label: "Touche directe" });
        }
        fields.push({ k: "switch", key: "cinquante_22", label: "50/22" });
        fields.push({ k: "player" });
        return fields;
      }
      if (kind === "renvoi_22" || kind === "renvoi_enbut") {
        return [
          ...base,
          { k: "zone", key: "zone", label: "Zone de destination" },
          { k: "switch", key: "gain_terrain", label: "Gain de terrain" },
          { k: "player" },
        ];
      }
      return [...base, { k: "player" }];
    }
    default:
      return [];
  }
}

export function defaultDraft(type: string, playerNumber: number | null = null): EventDraft {
  const payload: Record<string, unknown> = {};
  for (const f of fieldsFor(type)) {
    if (f.k === "select") payload[f.key] = f.options[0]?.value ?? "";
    if (f.k === "zone") payload[f.key] = TOUCHE_ZONES[3]; // milieu de terrain par défaut
    if (f.k === "switch") payload[f.key] = false;
  }
  return { event_type: type, team_side: "meudon", player_number: playerNumber, payload };
}

const ZONE_SHORT = ["Nos 5m", "Nos 22m", "Nôtre ½", "Milieu", "Leur ½", "Leurs 22m", "Leurs 5m"];

function ZoneSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const idx = Math.max(0, (TOUCHE_ZONES as readonly string[]).indexOf(value));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="text-xs font-medium">{TOUCHE_ZONES[idx]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={6}
        step={1}
        value={idx}
        onChange={(e) => onChange(TOUCHE_ZONES[Number(e.target.value)])}
        className="w-full accent-primary"
      />
      <div className="grid grid-cols-7 gap-0">
        {ZONE_SHORT.map((label, i) => (
          <span
            key={i}
            className={cn(
              "text-center text-[8px] leading-tight px-px",
              i === idx ? "text-primary font-bold" : "text-muted-foreground/60",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
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

  const kickKind = type === "jeu_au_pied" ? String(draft.payload["kind"] ?? "") : "";
  const pointsKind = type === "points" ? String(draft.payload["kind"] ?? "") : "";
  const joueVite = type === "touche" ? Boolean(draft.payload["joue_vite"]) : false;
  const touchePossession = type === "touche" ? String(draft.payload["possession"] ?? "meudon") : "";
  const toucheGain = type === "touche" ? String(draft.payload["gain"] ?? "meudon") : "";
  const meleeGain = type === "melee" ? String(draft.payload["gain"] ?? "meudon") : "";
  const degagementTouche = kickKind === "degagement" ? Boolean(draft.payload["touche"]) : false;
  const penaltyChoix = type === "penalite" ? String(draft.payload["choix"] ?? "") : "";
  const fields = useMemo(
    () => fieldsFor(type, draft.payload, draft.team_side),
    [type, kickKind, pointsKind, joueVite, touchePossession, toucheGain, meleeGain, degagementTouche, penaltyChoix, draft.team_side], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
        if (f.k === "zone") {
          return (
            <ZoneSlider
              key={i}
              label={f.label}
              value={String(draft.payload[f.key] ?? TOUCHE_ZONES[3])}
              onChange={(v) => setPayload(f.key, v)}
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
              onChange={(v) => {
                if (type === "jeu_au_pied" && f.key === "kind") {
                  setDraft((d) => ({ ...d, payload: { kind: v } }));
                } else if (type === "points" && f.key === "kind") {
                  const isKick = v === "transformation" || v === "penalite_but" || v === "drop";
                  setDraft((d) => ({ ...d, payload: { kind: v, ...(isKick ? { reussi: true } : {}) } }));
                } else {
                  setPayload(f.key, v);
                }
              }}
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
