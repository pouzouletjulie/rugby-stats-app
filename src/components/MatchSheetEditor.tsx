import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RUGBY_POSITIONS, type MatchPlayer, type Player, type PositionSlot } from "@/lib/rugby";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  matchId: string;
  format: number;
  canEdit: boolean;
};

function useMatchPlayers(matchId: string) {
  return useQuery({
    queryKey: ["match-players", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_players")
        .select("id, number, last_name, first_name, nickname, player_id")
        .eq("match_id", matchId)
        .order("number");
      if (error) throw error;
      return (data ?? []) as MatchPlayer[];
    },
  });
}

function useAllPlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, last_name, first_name, nickname, team, first_row, birth_date, license_number")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });
}

function playerDisplayName(p: MatchPlayer | Player): string {
  const parts = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return p.nickname ? `${parts} « ${p.nickname} »` : parts;
}

type SlotProps = {
  slot: PositionSlot;
  assigned: MatchPlayer | undefined;
  players: Player[];
  canEdit: boolean;
  onAssign: (slot: PositionSlot, player: Player) => void;
  onClear: (slot: PositionSlot) => void;
};

function PositionSlotCell({ slot, assigned, players, canEdit, onAssign, onClear }: SlotProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      search.trim()
        ? players.filter((p) =>
            `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase()),
          )
        : players,
    [players, search],
  );

  if (slot.isReplacement) {
    return (
      <div className="flex items-center gap-1.5 rounded border bg-muted/30 px-2 py-1 text-xs">
        <span className="w-5 shrink-0 font-display font-bold tabular-nums text-muted-foreground">
          {slot.number}
        </span>
        {assigned ? (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{playerDisplayName(assigned)}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onClear(slot)}
                className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Retirer"
              >
                <X className="size-3" />
              </button>
            )}
          </>
        ) : (
          <>
            <span className="flex-1 text-muted-foreground/60 italic">{slot.label}</span>
            {canEdit && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] text-accent underline-offset-2 hover:underline"
                  >
                    Choisir
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <PlayerPicker
                    players={filtered}
                    search={search}
                    onSearch={setSearch}
                    onSelect={(p) => {
                      onAssign(slot, p);
                      setOpen(false);
                      setSearch("");
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Popover open={open && canEdit} onOpenChange={(v) => canEdit && setOpen(v)}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "group relative flex min-w-[7rem] flex-col items-center rounded-md border px-2 py-2 text-center transition-colors",
            assigned
              ? "border-sidebar-primary/30 bg-sidebar-primary/5"
              : "border-dashed border-muted-foreground/30 bg-background",
            canEdit && "cursor-pointer hover:border-accent hover:bg-accent/5",
          )}
        >
          <span className="font-display text-xl font-bold tabular-nums text-accent">{slot.number}</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{slot.label}</span>
          {assigned ? (
            <span className="mt-1 w-full truncate text-xs font-semibold">{playerDisplayName(assigned)}</span>
          ) : (
            <span className="mt-1 text-xs italic text-muted-foreground/50">
              {canEdit ? "Choisir…" : "—"}
            </span>
          )}
          {assigned && canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear(slot);
              }}
              className="absolute right-1 top-1 hidden text-muted-foreground hover:text-destructive group-hover:block"
              aria-label="Retirer"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      {canEdit && (
        <PopoverContent className="w-64 p-2" align="center">
          <PlayerPicker
            players={filtered}
            search={search}
            onSearch={setSearch}
            onSelect={(p) => {
              onAssign(slot, p);
              setOpen(false);
              setSearch("");
            }}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}

function PlayerPicker({
  players,
  search,
  onSearch,
  onSelect,
}: {
  players: Player[];
  search: string;
  onSearch: (v: string) => void;
  onSelect: (p: Player) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Input
        autoFocus
        placeholder="Rechercher un joueur…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="max-h-48 overflow-y-auto">
        {players.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Aucun joueur trouvé</p>
        )}
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent/10"
          >
            <span className="font-medium">{p.last_name.toUpperCase()} {p.first_name}</span>
            {p.nickname && <span className="ml-1 text-muted-foreground">« {p.nickname} »</span>}
            {p.first_row && (
              <span className="ml-1 rounded bg-sidebar-primary/20 px-1 text-[10px] text-sidebar-primary">
                1L
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MatchSheetEditor({ matchId, format, canEdit }: Props) {
  const qc = useQueryClient();
  const playersQ = useMatchPlayers(matchId);
  const allPlayersQ = useAllPlayers();

  const config = RUGBY_POSITIONS[format] ?? RUGBY_POSITIONS[15];
  const allSlots = [...config.starters, ...config.replacements];
  const assignedMap = useMemo(() => {
    const m = new Map<number, MatchPlayer>();
    for (const mp of playersQ.data ?? []) m.set(mp.number, mp);
    return m;
  }, [playersQ.data]);

  const assign = async (slot: PositionSlot, player: Player) => {
    const existing = assignedMap.get(slot.number);
    if (existing?.id) {
      const { error } = await supabase
        .from("match_players")
        .update({
          last_name: player.last_name,
          first_name: player.first_name,
          nickname: player.nickname,
          player_id: player.id,
        })
        .eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("match_players").insert({
        match_id: matchId,
        number: slot.number,
        last_name: player.last_name,
        first_name: player.first_name,
        nickname: player.nickname,
        player_id: player.id,
      });
      if (error) { toast.error(error.message); return; }
    }
    void qc.invalidateQueries({ queryKey: ["match-players", matchId] });
  };

  const clear = async (slot: PositionSlot) => {
    const existing = assignedMap.get(slot.number);
    if (!existing?.id) return;
    const { error } = await supabase.from("match_players").delete().eq("id", existing.id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["match-players", matchId] });
  };

  const slotProps = (slot: PositionSlot) => ({
    slot,
    assigned: assignedMap.get(slot.number),
    players: allPlayersQ.data ?? [],
    canEdit,
    onAssign: assign,
    onClear: clear,
  });

  if (playersQ.isLoading || allPlayersQ.isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        {config.layout.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-wrap justify-center gap-2">
            {row.map((num) => {
              const slot = allSlots.find((s) => s.number === num);
              if (!slot) return null;
              return <PositionSlotCell key={num} {...slotProps(slot)} />;
            })}
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <p className="label-kicker mb-2 text-muted-foreground">Remplaçants</p>
        <div className="flex flex-wrap gap-2">
          {config.replacements.map((slot) => (
            <div key={slot.number} className="w-full sm:w-[calc(50%-0.25rem)] lg:w-[calc(33%-0.25rem)]">
              <PositionSlotCell {...slotProps(slot)} />
            </div>
          ))}
        </div>
      </div>

      {canEdit && (allPlayersQ.data ?? []).length === 0 && (
        <p className="rounded-md border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
          Aucun joueur dans le registre.{" "}
          <a href="/joueurs" className="text-accent underline">
            Ajouter des joueurs
          </a>{" "}
          pour composer la feuille.
        </p>
      )}
    </div>
  );
}
