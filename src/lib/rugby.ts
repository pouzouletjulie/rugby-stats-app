export const TEAMS = [
  { value: "junior", label: "Junior" },
  { value: "cadet", label: "Cadet" },
  { value: "feminine", label: "Féminine" },
  { value: "senior1", label: "Senior 1" },
  { value: "senior_reserve", label: "Senior Réserve" },
] as const;

// Pour les joueurs : senior regroupe senior1 et senior_reserve
export const PLAYER_TEAMS = [
  { value: "junior", label: "Junior" },
  { value: "cadet", label: "Cadet" },
  { value: "feminine", label: "Féminine" },
  { value: "senior", label: "Senior" },
] as const;

export type TeamCode = (typeof TEAMS)[number]["value"] | "senior";

const ALL_TEAM_LABELS: Record<string, string> = {
  junior: "Junior",
  cadet: "Cadet",
  feminine: "Féminine",
  senior1: "Senior 1",
  senior_reserve: "Senior Réserve",
  senior: "Senior",
};

export const teamLabel = (code: string) => ALL_TEAM_LABELS[code] ?? code;

export const COMPETITION_TYPES = [
  "Championnat",
  "Coupe",
  "Amical",
  "Tournoi",
  "Barrage",
  "Autre",
] as const;

export const LOCATIONS = ["Domicile", "Extérieur", "Terrain neutre"] as const;
export const WEATHERS = ["Ensoleillé", "Couvert", "Pluie", "Neige", "Chaud", "Froid"] as const;
export const WINDS = ["Nul", "Léger", "Modéré", "Fort", "Rafales"] as const;
export const FORMATS = [15, 12, 10, 7] as const;

export const PERIODS = [
  { value: "mt1", label: "1re mi-temps", startEvent: "debut_mt1" },
  { value: "mt2", label: "2e mi-temps", startEvent: "debut_mt2" },
  { value: "additionnel", label: "Temps additionnel", startEvent: "debut_additionnel" },
] as const;

export type PeriodCode = (typeof PERIODS)[number]["value"];

export const periodLabel = (code: string | null) =>
  PERIODS.find((p) => p.value === code)?.label ?? "—";

export const ZONES = [
  "Nos 22 m",
  "Entre nos 22 m et le milieu",
  "Entre le milieu et les 22 m adverses",
  "22 m adverses",
] as const;

export const SIDES = [
  { value: "meudon", label: "AS Meudon" },
  { value: "adversaire", label: "Adversaire" },
] as const;

export const sideLabel = (side: string | null | undefined) =>
  side === "meudon" ? "AS Meudon" : side === "adversaire" ? "Adversaire" : "—";

export const TOUCHE_SUITES = ["Ballon porté", "Jeu déployé", "Jeu au pied", "Mêlée", "Autre"] as const;
export const TURNOVER_NATURES = [
  { value: "grattage", label: "Grattage" },
  { value: "en_avant", label: "En-avant" },
  { value: "arrachage", label: "Arrachage" },
  { value: "interception", label: "Interception" },
  { value: "autre", label: "Autre" },
] as const;
export const PENALTY_MOTIFS = [
  { value: "melee", label: "Mêlée" },
  { value: "hors_jeu", label: "Hors-jeu" },
  { value: "perte_appui", label: "Perte d'appui" },
  { value: "plaqueur_ruck", label: "Plaqueur dans le ruck" },
  { value: "en_avant_volontaire", label: "En-avant volontaire" },
  { value: "plaquage_haut", label: "Plaquage haut" },
  { value: "plaquage_a_deux", label: "Plaquage à deux" },
  { value: "autre", label: "Autre faute" },
] as const;
export const CARD_COLORS = [
  { value: "blanc", label: "Blanc" },
  { value: "jaune", label: "Jaune" },
  { value: "rouge", label: "Rouge" },
] as const;
export const POINT_KINDS = [
  { value: "essai", label: "Essai", points: 5 },
  { value: "transformation", label: "Transformation", points: 2 },
  { value: "penalite_but", label: "Pénalité au but", points: 3 },
  { value: "essai_penalite", label: "Essai de pénalité", points: 7 },
] as const;
export const PASS_KINDS = [
  { value: "normale", label: "Passe normale" },
  { value: "offload", label: "Offload" },
] as const;
export const TACKLE_KINDS = [
  { value: "offensif", label: "Offensif" },
  { value: "defensif", label: "Défensif" },
  { value: "neutre", label: "Neutre" },
] as const;
export const KICK_KINDS = [
  { value: "drop", label: "Drop" },
  { value: "penaltouche", label: "Pénaltouche" },
  { value: "touche", label: "Touche" },
  { value: "chandelle", label: "Chandelle" },
  { value: "rasant", label: "Rasant" },
] as const;
export const KICK_RESULTS = [
  { value: "gain", label: "Gain de terrain" },
  { value: "perte", label: "Perte de terrain" },
] as const;

export const EVENT_LABELS: Record<string, string> = {
  debut_mt1: "Début de 1re mi-temps",
  debut_mt2: "Début de 2e mi-temps",
  debut_additionnel: "Début du temps additionnel",
  melee: "Mêlée",
  touche: "Touche",
  turnover: "Turnover",
  penalite: "Pénalité sifflée",
  carton: "Carton",
  points: "Points",
  entree_22: "Entrée dans les 22",
  cinquante_22: "50/22",
  passe: "Passe",
  ballon_touche: "Ballon touché",
  plaquage: "Plaquage",
  jeu_au_pied: "Jeu au pied",
};

export type MatchEvent = {
  id: string;
  match_id: string;
  period: string | null;
  event_type: string;
  team_side: string | null;
  player_number: number | null;
  payload: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type MatchPlayer = {
  id?: string;
  number: number;
  last_name: string | null;
  first_name: string | null;
  nickname: string | null;
  player_id?: string | null;
};

export type Player = {
  id: string;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  license_number: string | null;
  first_row: boolean;
  team: string | null;
  nickname: string | null;
};

export type PositionSlot = {
  number: number;
  label: string;
  group: string;
  isReplacement: boolean;
};

type FormatConfig = {
  starters: PositionSlot[];
  replacements: PositionSlot[];
  layout: number[][];
};

export const RUGBY_POSITIONS: Record<number, FormatConfig> = {
  15: {
    starters: [
      { number: 1, label: "Pilier gauche", group: "Première ligne", isReplacement: false },
      { number: 2, label: "Talonneur", group: "Première ligne", isReplacement: false },
      { number: 3, label: "Pilier droit", group: "Première ligne", isReplacement: false },
      { number: 4, label: "2e ligne", group: "Deuxième ligne", isReplacement: false },
      { number: 5, label: "2e ligne", group: "Deuxième ligne", isReplacement: false },
      { number: 6, label: "Flanker gauche", group: "Troisième ligne", isReplacement: false },
      { number: 7, label: "Flanker droit", group: "Troisième ligne", isReplacement: false },
      { number: 8, label: "Numéro 8", group: "Troisième ligne", isReplacement: false },
      { number: 9, label: "Demi de mêlée", group: "Demis", isReplacement: false },
      { number: 10, label: "Demi d'ouverture", group: "Demis", isReplacement: false },
      { number: 11, label: "Ailier gauche", group: "Trois-quarts", isReplacement: false },
      { number: 12, label: "Centre", group: "Trois-quarts", isReplacement: false },
      { number: 13, label: "Centre", group: "Trois-quarts", isReplacement: false },
      { number: 14, label: "Ailier droit", group: "Trois-quarts", isReplacement: false },
      { number: 15, label: "Arrière", group: "Arrière", isReplacement: false },
    ],
    replacements: Array.from({ length: 7 }, (_, i) => ({
      number: 16 + i,
      label: `Remplaçant`,
      group: "Remplaçants",
      isReplacement: true,
    })),
    layout: [[1, 2, 3], [4, 5], [6, 7, 8], [9, 10], [11, 12, 13, 14], [15]],
  },
  12: {
    starters: [
      { number: 1, label: "Pilier gauche", group: "Première ligne", isReplacement: false },
      { number: 2, label: "Talonneur", group: "Première ligne", isReplacement: false },
      { number: 3, label: "Pilier droit", group: "Première ligne", isReplacement: false },
      { number: 4, label: "2e ligne", group: "Deuxième ligne", isReplacement: false },
      { number: 5, label: "2e ligne", group: "Deuxième ligne", isReplacement: false },
      { number: 6, label: "Flanker gauche", group: "Troisième ligne", isReplacement: false },
      { number: 7, label: "Flanker droit", group: "Troisième ligne", isReplacement: false },
      { number: 8, label: "Numéro 8", group: "Troisième ligne", isReplacement: false },
      { number: 9, label: "Demi de mêlée", group: "Demis", isReplacement: false },
      { number: 10, label: "Demi d'ouverture", group: "Demis", isReplacement: false },
      { number: 11, label: "Centre", group: "Trois-quarts", isReplacement: false },
      { number: 12, label: "Arrière", group: "Arrière", isReplacement: false },
    ],
    replacements: Array.from({ length: 3 }, (_, i) => ({
      number: 13 + i,
      label: `Remplaçant`,
      group: "Remplaçants",
      isReplacement: true,
    })),
    layout: [[1, 2, 3], [4, 5], [6, 7, 8], [9, 10], [11, 12]],
  },
  10: {
    starters: [
      { number: 1, label: "Pilier gauche", group: "Première ligne", isReplacement: false },
      { number: 2, label: "Talonneur", group: "Première ligne", isReplacement: false },
      { number: 3, label: "Pilier droit", group: "Première ligne", isReplacement: false },
      { number: 4, label: "2e ligne", group: "Deuxième ligne", isReplacement: false },
      { number: 5, label: "Flanker", group: "Troisième ligne", isReplacement: false },
      { number: 6, label: "Numéro 8", group: "Troisième ligne", isReplacement: false },
      { number: 7, label: "Demi de mêlée", group: "Demis", isReplacement: false },
      { number: 8, label: "Demi d'ouverture", group: "Demis", isReplacement: false },
      { number: 9, label: "Centre", group: "Trois-quarts", isReplacement: false },
      { number: 10, label: "Arrière", group: "Arrière", isReplacement: false },
    ],
    replacements: Array.from({ length: 3 }, (_, i) => ({
      number: 11 + i,
      label: `Remplaçant`,
      group: "Remplaçants",
      isReplacement: true,
    })),
    layout: [[1, 2, 3], [4, 5], [6], [7, 8], [9, 10]],
  },
  7: {
    starters: [
      { number: 1, label: "Pilier", group: "Avants", isReplacement: false },
      { number: 2, label: "Talonneur", group: "Avants", isReplacement: false },
      { number: 3, label: "Flanker", group: "Avants", isReplacement: false },
      { number: 4, label: "Demi de mêlée", group: "Arrières", isReplacement: false },
      { number: 5, label: "Demi d'ouverture", group: "Arrières", isReplacement: false },
      { number: 6, label: "Centre", group: "Arrières", isReplacement: false },
      { number: 7, label: "Arrière", group: "Arrières", isReplacement: false },
    ],
    replacements: Array.from({ length: 7 }, (_, i) => ({
      number: 8 + i,
      label: `Remplaçant`,
      group: "Remplaçants",
      isReplacement: true,
    })),
    layout: [[1, 2, 3], [4, 5, 6, 7]],
  },
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function pointsValue(ev: MatchEvent): number {
  if (ev.event_type !== "points") return 0;
  const kind = str(ev.payload?.["kind"]);
  return POINT_KINDS.find((k) => k.value === kind)?.points ?? 0;
}

export function eventSummary(ev: MatchEvent): string {
  const p = ev.payload ?? {};
  const parts: string[] = [];
  switch (ev.event_type) {
    case "melee":
    case "touche":
      parts.push(str(p["zone"]));
      parts.push(`possession ${sideLabel(str(p["possession"]))}`);
      parts.push(`gain ${sideLabel(str(p["gain"]))}`);
      if (ev.event_type === "melee" && str(p["sortie"]))
        parts.push(`sortie du ${str(p["sortie"])}`);
      if (ev.event_type === "touche") {
        if (str(p["suite"])) parts.push(str(p["suite"]));
        if (p["bloc"]) parts.push("bloc");
      }
      break;
    case "turnover":
      parts.push(
        TURNOVER_NATURES.find((n) => n.value === str(p["nature"]))?.label ?? str(p["nature"]),
      );
      break;
    case "penalite":
      parts.push(PENALTY_MOTIFS.find((m) => m.value === str(p["motif"]))?.label ?? str(p["motif"]));
      break;
    case "carton":
      parts.push(CARD_COLORS.find((c) => c.value === str(p["couleur"]))?.label ?? str(p["couleur"]));
      break;
    case "points":
      parts.push(POINT_KINDS.find((k) => k.value === str(p["kind"]))?.label ?? str(p["kind"]));
      parts.push(`${pointsValue(ev)} pts`);
      break;
    case "passe":
      parts.push(PASS_KINDS.find((k) => k.value === str(p["kind"]))?.label ?? str(p["kind"]));
      break;
    case "plaquage":
      parts.push(TACKLE_KINDS.find((k) => k.value === str(p["kind"]))?.label ?? str(p["kind"]));
      break;
    case "jeu_au_pied":
      parts.push(KICK_KINDS.find((k) => k.value === str(p["kind"]))?.label ?? str(p["kind"]));
      parts.push(
        KICK_RESULTS.find((r) => r.value === str(p["resultat"]))?.label ?? str(p["resultat"]),
      );
      break;
    default:
      break;
  }
  if (ev.player_number) parts.push(`n°${ev.player_number}`);
  return parts.filter(Boolean).join(" · ");
}

export type SideStats = {
  points: number;
  essais: number;
  transformations: number;
  penalitesBut: number;
  essaisPenalite: number;
  melees: number;
  meleesGagnees: number;
  touches: number;
  touchesGagnees: number;
  turnovers: number;
  penalitesConcedees: number;
  cartons: { blanc: number; jaune: number; rouge: number };
  entrees22: number;
  cinquante22: number;
  passes: number;
  offloads: number;
  ballonsTouches: number;
  plaquages: { offensif: number; defensif: number; neutre: number };
  jeuAuPied: { total: number; gain: number; perte: number };
};

const emptySide = (): SideStats => ({
  points: 0,
  essais: 0,
  transformations: 0,
  penalitesBut: 0,
  essaisPenalite: 0,
  melees: 0,
  meleesGagnees: 0,
  touches: 0,
  touchesGagnees: 0,
  turnovers: 0,
  penalitesConcedees: 0,
  cartons: { blanc: 0, jaune: 0, rouge: 0 },
  entrees22: 0,
  cinquante22: 0,
  passes: 0,
  offloads: 0,
  ballonsTouches: 0,
  plaquages: { offensif: 0, defensif: 0, neutre: 0 },
  jeuAuPied: { total: 0, gain: 0, perte: 0 },
});

export type PlayerStats = {
  number: number;
  points: number;
  essais: number;
  passes: number;
  offloads: number;
  ballonsTouches: number;
  plaquages: number;
  plaquagesOffensifs: number;
  plaquagesDefensifs: number;
  plaquagesNeutres: number;
  jeuAuPied: number;
  jeuAuPiedGain: number;
  japDrop: number;
  japPenaltouche: number;
  japTouche: number;
  japChandelle: number;
  japRasant: number;
  turnovers: number;
  penalites: number;
  cartons: number;
  cinquante22: number;
};

const emptyPlayer = (number: number): PlayerStats => ({
  number,
  points: 0,
  essais: 0,
  passes: 0,
  offloads: 0,
  ballonsTouches: 0,
  plaquages: 0,
  plaquagesOffensifs: 0,
  plaquagesDefensifs: 0,
  plaquagesNeutres: 0,
  jeuAuPied: 0,
  jeuAuPiedGain: 0,
  japDrop: 0,
  japPenaltouche: 0,
  japTouche: 0,
  japChandelle: 0,
  japRasant: 0,
  turnovers: 0,
  penalites: 0,
  cartons: 0,
  cinquante22: 0,
});

export function activeEvents(events: MatchEvent[]) {
  return events.filter((e) => !e.deleted_at);
}

export function computeStats(events: MatchEvent[]) {
  const list = activeEvents(events);
  const sides: Record<"meudon" | "adversaire", SideStats> = {
    meudon: emptySide(),
    adversaire: emptySide(),
  };
  const players = new Map<number, PlayerStats>();

  const player = (n: number | null) => {
    if (!n) return null;
    if (!players.has(n)) players.set(n, emptyPlayer(n));
    return players.get(n)!;
  };

  for (const ev of list) {
    const p = ev.payload ?? {};
    const side = ev.team_side === "adversaire" ? "adversaire" : "meudon";
    const s = sides[side];
    const pl = ev.team_side === "adversaire" ? null : player(ev.player_number);

    switch (ev.event_type) {
      case "points": {
        const kind = str(p["kind"]);
        const value = pointsValue(ev);
        s.points += value;
        if (kind === "essai") s.essais += 1;
        if (kind === "transformation") s.transformations += 1;
        if (kind === "penalite_but") s.penalitesBut += 1;
        if (kind === "essai_penalite") s.essaisPenalite += 1;
        if (pl) {
          pl.points += value;
          if (kind === "essai") pl.essais += 1;
        }
        break;
      }
      case "melee":
      case "touche": {
        const possession = str(p["possession"]) === "adversaire" ? "adversaire" : "meudon";
        const gain = str(p["gain"]);
        const target = sides[possession];
        if (ev.event_type === "melee") {
          target.melees += 1;
          if (gain === possession) target.meleesGagnees += 1;
        } else {
          target.touches += 1;
          if (gain === possession) target.touchesGagnees += 1;
        }
        break;
      }
      case "turnover":
        s.turnovers += 1;
        if (pl) pl.turnovers += 1;
        break;
      case "penalite":
        s.penalitesConcedees += 1;
        if (pl) pl.penalites += 1;
        break;
      case "carton": {
        const c = str(p["couleur"]);
        if (c === "blanc" || c === "jaune" || c === "rouge") s.cartons[c] += 1;
        if (pl) pl.cartons += 1;
        break;
      }
      case "entree_22":
        s.entrees22 += 1;
        break;
      case "cinquante_22":
        s.cinquante22 += 1;
        if (pl) pl.cinquante22 += 1;
        break;
      case "passe": {
        const kind = str(p["kind"]);
        if (kind === "offload") {
          s.offloads += 1;
          if (pl) pl.offloads += 1;
        } else {
          s.passes += 1;
          if (pl) pl.passes += 1;
        }
        break;
      }
      case "ballon_touche":
        s.ballonsTouches += 1;
        if (pl) pl.ballonsTouches += 1;
        break;
      case "plaquage": {
        const kind = str(p["kind"]);
        if (kind === "offensif" || kind === "defensif" || kind === "neutre") s.plaquages[kind] += 1;
        if (pl) {
          pl.plaquages += 1;
          if (kind === "offensif") pl.plaquagesOffensifs += 1;
          else if (kind === "defensif") pl.plaquagesDefensifs += 1;
          else pl.plaquagesNeutres += 1;
        }
        break;
      }
      case "jeu_au_pied": {
        s.jeuAuPied.total += 1;
        const res = str(p["resultat"]);
        if (res === "gain") s.jeuAuPied.gain += 1;
        else if (res === "perte") s.jeuAuPied.perte += 1;
        if (pl) {
          pl.jeuAuPied += 1;
          if (res === "gain") pl.jeuAuPiedGain += 1;
          const kind = str(p["kind"]);
          if (kind === "drop") pl.japDrop += 1;
          else if (kind === "penaltouche") pl.japPenaltouche += 1;
          else if (kind === "touche") pl.japTouche += 1;
          else if (kind === "chandelle") pl.japChandelle += 1;
          else if (kind === "rasant") pl.japRasant += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    sides,
    players: [...players.values()].sort((a, b) => a.number - b.number),
    eventCount: list.length,
  };
}

export function activePeriod(events: MatchEvent[]): PeriodCode | null {
  const starts = activeEvents(events).filter((e) => e.event_type.startsWith("debut_"));
  if (!starts.length) return null;
  const last = starts[starts.length - 1]!;
  return (PERIODS.find((p) => p.startEvent === last.event_type)?.value ?? null) as PeriodCode | null;
}

export function periodStarted(events: MatchEvent[], startEvent: string) {
  return activeEvents(events).some((e) => e.event_type === startEvent);
}

export function playerName(players: MatchPlayer[], number: number | null | undefined) {
  if (!number) return null;
  const p = players.find((x) => x.number === number);
  if (!p) return `n°${number}`;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  const label = p.nickname ? `${name || "Joueur"} « ${p.nickname} »` : name;
  return label ? `n°${number} ${label}` : `n°${number}`;
}
