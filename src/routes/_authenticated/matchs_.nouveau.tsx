import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPETITION_TYPES,
  FORMATS,
  LOCATIONS,
  TEAMS,
  WEATHERS,
  WINDS,
  type TeamCode,
} from "@/lib/rugby";
import { logAudit, useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/matchs_/nouveau")({
  head: () => ({
    meta: [
      { title: "Nouveau match — AS Meudon Rugby Stats" },
      {
        name: "description",
        content:
          "Créer un match : équipe, date, adversaire, conditions de jeu et feuille de match optionnelle.",
      },
      { property: "og:title", content: "Nouveau match — AS Meudon Rugby Stats" },
      { property: "og:description", content: "Renseignez le contexte du match avant la saisie." },
    ],
  }),
  component: NewMatchPage,
});

type PlayerRow = { number: number; last_name: string; first_name: string; nickname: string };

function NewMatchPage() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [busy, setBusy] = useState(false);
  const [withSheet, setWithSheet] = useState(false);
  const [players, setPlayers] = useState<PlayerRow[]>(
    Array.from({ length: 22 }, (_, i) => ({
      number: i + 1,
      last_name: "",
      first_name: "",
      nickname: "",
    })),
  );
  const [form, setForm] = useState({
    team: "senior1" as TeamCode,
    match_date: new Date().toISOString().slice(0, 10),
    opponent: "",
    competition_type: "Championnat",
    location: "Domicile",
    field: "",
    weather: "Ensoleillé",
    wind: "Nul",
    format: 15,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("matches")
      .insert({ ...form, created_by: (await supabase.auth.getUser()).data.user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    if (withSheet) {
      const rows = players
        .filter((p) => p.last_name || p.first_name || p.nickname)
        .map((p) => ({
          match_id: data.id,
          number: p.number,
          last_name: p.last_name || null,
          first_name: p.first_name || null,
          nickname: p.nickname || null,
        }));
      if (rows.length) await supabase.from("match_players").insert(rows);
    }
    await logAudit({
      action: "création",
      entity: "match",
      entityId: data.id,
      matchId: data.id,
      details: { opponent: form.opponent, team: form.team },
    });
    setBusy(false);
    toast.success("Match créé");
    navigate({ to: "/matchs/$id", params: { id: data.id } });
  };

  if (!canEdit) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Seuls les éditeurs et administrateurs peuvent créer un match.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/matchs">
          <ArrowLeft className="size-4" /> Retour aux matchs
        </Link>
      </Button>
      <h1 className="text-3xl font-bold uppercase">Nouveau match</h1>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="uppercase">Contexte</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Équipe AS Meudon</Label>
              <Select value={form.team} onValueChange={(v) => set("team", v as TeamCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.match_date}
                onChange={(e) => set("match_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp">Adversaire</Label>
              <Input
                id="opp"
                required
                value={form.opponent}
                onChange={(e) => set("opponent", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type de rencontre</Label>
              <Select
                value={form.competition_type}
                onValueChange={(v) => set("competition_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPETITION_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Localisation</Label>
              <Select value={form.location} onValueChange={(v) => set("location", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field">Terrain</Label>
              <Input id="field" value={form.field} onChange={(e) => set("field", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Météo</Label>
              <Select value={form.weather} onValueChange={(v) => set("weather", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEATHERS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vent</Label>
              <Select value={form.wind} onValueChange={(v) => set("wind", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select
                value={String(form.format)}
                onValueChange={(v) => set("format", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      Rugby à {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="uppercase">Feuille de match (optionnelle)</CardTitle>
            <Switch checked={withSheet} onCheckedChange={setWithSheet} />
          </CardHeader>
          {withSheet && (
            <CardContent className="space-y-2">
              {players.map((p, i) => (
                <div key={p.number} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2">
                  <span className="font-display text-lg font-semibold tabular-nums text-muted-foreground">
                    {p.number}
                  </span>
                  <Input
                    placeholder="Nom"
                    value={p.last_name}
                    onChange={(e) =>
                      setPlayers((list) =>
                        list.map((x, xi) => (xi === i ? { ...x, last_name: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Prénom"
                    value={p.first_name}
                    onChange={(e) =>
                      setPlayers((list) =>
                        list.map((x, xi) => (xi === i ? { ...x, first_name: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Surnom"
                    value={p.nickname}
                    onChange={(e) =>
                      setPlayers((list) =>
                        list.map((x, xi) => (xi === i ? { ...x, nickname: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={busy}>
            Créer le match
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
