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
import { TEAMS, teamLabel, type Player } from "@/lib/rugby";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
      last_name: values.last_name.trim(),
      first_name: values.first_name.trim(),
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
                {TEAMS.map((t) => (
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

function JoueursPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

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

  const players = playersQ.data ?? [];

  const filtered = players.filter((p) => {
    const matchSearch =
      !search.trim() ||
      `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchTeam = !teamFilter || p.team === teamFilter;
    return matchSearch && matchTeam;
  });

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
                {TEAMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <PlayerDialog
        player={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["players"] })}
      />
    </AppShell>
  );
}
