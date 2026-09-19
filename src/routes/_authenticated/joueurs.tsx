import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { PLAYER_TEAMS, teamLabel, type Player, type Championship } from "@/lib/rugby";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/joueurs")({
  head: () => ({
    meta: [
      { title: "Joueurs — AS Meudon Rugby Stats" },
      { name: "description", content: "Registre des joueurs de l'AS Meudon Rugby." },
    ],
  }),
  component: JoueursPage,
});

const playerSchema = z.object({
  last_name: z.string().min(1, "Nom obligatoire"),
  first_name: z.string().min(1, "Prénom obligatoire"),
  birth_date: z.string().optional(),
  license_number: z.string().optional(),
  first_row: z.boolean().default(false),
  team: z.string().optional(),
  nickname: z.string().optional(),
});

type PlayerForm = z.infer<typeof playerSchema>;

function PlayerDialog({
  player,
  open,
  onClose,
  onSaved,
}: {
  player: Player | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlayerForm>({
    resolver: zodResolver(playerSchema),
    defaultValues: player
      ? {
          last_name: player.last_name,
          first_name: player.first_name,
          birth_date: player.birth_date ?? "",
          license_number: player.license_number ?? "",
          first_row: player.first_row,
          team: player.team ?? "",
          nickname: player.nickname ?? "",
        }
      : { first_row: false, team: "", birth_date: "", license_number: "", nickname: "" },
  });

  const firstRow = watch("first_row");

  const onSubmit = async (values: PlayerForm) => {
    const payload = {
      last_name: values.last_name.trim().toUpperCase(),
      first_name: values.first_name.trim().toUpperCase(),
      birth_date: values.birth_date?.trim() || null,
      license_number: values.license_number?.trim() || null,
      first_row: values.first_row,
      team: (values.team?.trim() || null) as Player["team"],
      nickname: values.nickname?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (player) {
      const { error } = await supabase.from("players").update(payload).eq("id", player.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Joueur mis à jour");
    } else {
      const { error } = await supabase.from("players").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Joueur ajouté");
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{player ? "Modifier le joueur" : "Ajouter un joueur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input {...register("last_name")} placeholder="DUPONT" className="uppercase" />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Prénom *</Label>
              <Input {...register("first_name")} placeholder="Antoine" />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Surnom</Label>
            <Input {...register("nickname")} placeholder="Toto" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date de naissance</Label>
              <Input {...register("birth_date")} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Numéro de licence</Label>
              <Input {...register("license_number")} placeholder="123456" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Équipe</Label>
            <Select
              value={watch("team") ?? ""}
              onValueChange={(v) => setValue("team", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes équipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Toutes équipes</SelectItem>
                {PLAYER_TEAMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="first_row"
              checked={firstRow}
              onCheckedChange={(v) => setValue("first_row", v)}
            />
            <Label htmlFor="first_row">Première ligne</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {player ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type StatsSortKey = "name" | "points" | "blanc" | "jaune" | "bleu" | "rouge";

function JoueursPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [championshipFilter, setChampionshipFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState("registre");
  const [statsSortKey, setStatsSortKey] = useState<StatsSortKey>("name");
  const [statsSortDir, setStatsSortDir] = useState<"asc" | "desc">("asc");

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });

  const championshipsQ = useQuery({
    queryKey: ["championships-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("*")
        .eq("active", true)
        .order("season", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Championship[];
    },
  });

  const statsQ = useQuery({
    queryKey: ["player-stats-aggregate", teamFilter, championshipFilter],
    queryFn: async () => {
      // Step 1: get match IDs filtered by championship if set
      let matchQuery = supabase.from("matches").select("id");
      if (championshipFilter) matchQuery = matchQuery.eq("championship_id", championshipFilter);
      const { data: matches } = await matchQuery;
      const matchIds = (matches ?? []).map((m: { id: string }) => m.id);

      if (!matchIds.length) {
        // Still return all players with zero stats
        let playerQuery = supabase.from("players").select("*").order("last_name");
        if (teamFilter) playerQuery = playerQuery.eq("team", teamFilter);
        const { data: playerList } = await playerQuery;
        return (playerList ?? []).map((pl: Player) => ({
          ...pl,
          stats: { points: 0, blanc: 0, jaune: 0, bleu: 0, rouge: 0 },
        }));
      }

      // Step 2: get all match_players for those matches
      const { data: matchPlayers } = await supabase
        .from("match_players")
        .select("match_id, player_id, number")
        .in("match_id", matchIds);

      // Step 3: get all events of type "points" and "carton" for these matches (meudon side only)
      const { data: events } = await supabase
        .from("match_events")
        .select("player_number, event_type, payload, match_id, team_side")
        .in("match_id", matchIds)
        .in("event_type", ["points", "carton"])
        .is("deleted_at", null)
        .eq("team_side", "meudon");

      // Step 4: get players filtered by team if set
      let playerQuery = supabase.from("players").select("*").order("last_name");
      if (teamFilter) playerQuery = playerQuery.eq("team", teamFilter);
      const { data: playerList } = await playerQuery;

      // Step 5: aggregate per player_id via match_players lookup
      const agg: Record<string, { points: number; blanc: number; jaune: number; bleu: number; rouge: number }> = {};

      const POINT_VALUES: Record<string, number> = {
        essai: 5,
        transformation: 2,
        penalite_but: 3,
        drop: 3,
        essai_penalite: 7,
      };

      for (const ev of (events ?? [])) {
        const n = ev.player_number;
        if (!n) continue;
        // Find the match_player with this match_id and number
        const mp = (matchPlayers ?? []).find(
          (mp: { match_id: string; player_id: string | null; number: number }) =>
            mp.match_id === ev.match_id && mp.number === n
        );
        if (!mp?.player_id) continue;
        const pid = mp.player_id;
        if (!agg[pid]) agg[pid] = { points: 0, blanc: 0, jaune: 0, bleu: 0, rouge: 0 };

        if (ev.event_type === "points") {
          const kind = (ev.payload as Record<string, unknown>)?.kind ?? "";
          const reussi = (ev.payload as Record<string, unknown>)?.reussi !== false;
          const isKick = kind === "transformation" || kind === "penalite_but" || kind === "drop";
          if (!isKick || reussi) {
            agg[pid].points += POINT_VALUES[kind as string] ?? 0;
          }
        }

        if (ev.event_type === "carton") {
          const c = (ev.payload as Record<string, unknown>)?.couleur ?? "";
          if (c === "blanc") agg[pid].blanc += 1;
          else if (c === "jaune") agg[pid].jaune += 1;
          else if (c === "bleu") agg[pid].bleu += 1;
          else if (c === "rouge") agg[pid].rouge += 1;
        }
      }

      return (playerList ?? []).map((pl: Player) => ({
        ...pl,
        stats: agg[pl.id] ?? { points: 0, blanc: 0, jaune: 0, bleu: 0, rouge: 0 },
      }));
    },
  });

  const players = playersQ.data ?? [];

  const filtered = players.filter((p) => {
    const matchSearch =
      !search.trim() ||
      `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchTeam = !teamFilter || p.team === teamFilter;
    return matchSearch && matchTeam;
  });

  const championships = championshipsQ.data ?? [];

  type PlayerWithStats = Player & {
    stats: { points: number; blanc: number; jaune: number; bleu: number; rouge: number };
  };

  const filteredStats = ((statsQ.data ?? []) as PlayerWithStats[]).filter((p) => {
    const matchSearch =
      !search.trim() ||
      `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const sortedStats = [...filteredStats].sort((a, b) => {
    let cmp = 0;
    if (statsSortKey === "name") {
      cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    } else {
      cmp = a.stats[statsSortKey] - b.stats[statsSortKey];
    }
    return statsSortDir === "asc" ? cmp : -cmp;
  });

  const handleSortClick = (key: StatsSortKey) => {
    if (statsSortKey === key) {
      setStatsSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setStatsSortKey(key);
      setStatsSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: StatsSortKey) => {
    if (statsSortKey !== key) return null;
    return statsSortDir === "asc" ? " ↑" : " ↓";
  };

  const handleDelete = async (p: Player) => {
    if (!confirm(`Supprimer ${p.first_name} ${p.last_name} ?`)) return;
    const { error } = await supabase.from("players").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Joueur supprimé");
    void qc.invalidateQueries({ queryKey: ["players"] });
  };

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Player) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase">Joueurs</h1>
          <p className="text-sm text-muted-foreground">{players.length} joueur{players.length !== 1 ? "s" : ""} dans le registre</p>
        </div>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Ajouter un joueur
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Rechercher par nom, prénom, surnom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Toutes équipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes équipes</SelectItem>
                {PLAYER_TEAMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={championshipFilter} onValueChange={setChampionshipFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tous championnats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous championnats</SelectItem>
                {championships.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="registre">Registre</TabsTrigger>
              <TabsTrigger value="statistiques">Statistiques</TabsTrigger>
            </TabsList>

            <TabsContent value="registre">
              {playersQ.isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
              )}
              {!playersQ.isLoading && filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {players.length === 0
                    ? "Aucun joueur enregistré."
                    : "Aucun joueur ne correspond aux filtres."}
                </p>
              )}
              {filtered.length > 0 && (
                <div className="divide-y">
                  {filtered.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary/10">
                        <UserRound className="size-4 text-sidebar-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {p.last_name.toUpperCase()} {p.first_name}
                          {p.nickname && (
                            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                              « {p.nickname} »
                            </span>
                          )}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {p.team && <span>{teamLabel(p.team)}</span>}
                          {p.license_number && <span>Licence : {p.license_number}</span>}
                          {p.birth_date && (
                            <span>
                              Né(e) le{" "}
                              {new Date(p.birth_date).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.first_row && (
                          <Badge variant="secondary" className="text-[10px]">
                            1ère ligne
                          </Badge>
                        )}
                        {canEdit && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(p)}
                              aria-label="Modifier"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(p)}
                              aria-label="Supprimer"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="statistiques">
              {statsQ.isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
              )}
              {!statsQ.isLoading && sortedStats.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune donnée disponible.
                </p>
              )}
              {!statsQ.isLoading && sortedStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th
                          className="cursor-pointer select-none pb-2 pr-4 font-medium hover:text-foreground"
                          onClick={() => handleSortClick("name")}
                        >
                          Joueur{sortIndicator("name")}
                        </th>
                        <th
                          className="cursor-pointer select-none pb-2 pr-4 text-right font-medium hover:text-foreground"
                          onClick={() => handleSortClick("points")}
                        >
                          Pts{sortIndicator("points")}
                        </th>
                        <th
                          className="cursor-pointer select-none pb-2 pr-4 text-right font-medium hover:text-foreground"
                          onClick={() => handleSortClick("blanc")}
                        >
                          Blanc{sortIndicator("blanc")}
                        </th>
                        <th
                          className="cursor-pointer select-none pb-2 pr-4 text-right font-medium hover:text-foreground"
                          onClick={() => handleSortClick("jaune")}
                        >
                          Jaune{sortIndicator("jaune")}
                        </th>
                        <th
                          className="cursor-pointer select-none pb-2 pr-4 text-right font-medium hover:text-foreground"
                          onClick={() => handleSortClick("bleu")}
                        >
                          Bleu{sortIndicator("bleu")}
                        </th>
                        <th
                          className="cursor-pointer select-none pb-2 text-right font-medium hover:text-foreground"
                          onClick={() => handleSortClick("rouge")}
                        >
                          Rouge{sortIndicator("rouge")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedStats.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/40">
                          <td className="py-2 pr-4">
                            <span className="font-medium">{p.last_name.toUpperCase()}</span>{" "}
                            {p.first_name}
                            {p.nickname && (
                              <span className="ml-1 text-xs text-muted-foreground">« {p.nickname} »</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {p.stats.points > 0 ? p.stats.points : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {p.stats.blanc > 0 ? p.stats.blanc : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {p.stats.jaune > 0 ? p.stats.jaune : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {p.stats.bleu > 0 ? p.stats.bleu : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {p.stats.rouge > 0 ? p.stats.rouge : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PlayerDialog
        key={editing?.id ?? "new"}
        player={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["players"] })}
      />
    </AppShell>
  );
}
