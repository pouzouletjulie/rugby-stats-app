import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RugbyStatsApp — Statistiques de matchs" },
      {
        name: "description",
        content:
          "Collecte et consultation des statistiques de matchs de rugby : événements, scores et analyses par équipe.",
      },
      { property: "og:title", content: "RugbyStatsApp — Statistiques de matchs" },
      {
        property: "og:description",
        content:
          "Saisie d'événements, calcul automatique des scores et consultation des statistiques collectives et individuelles.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="pitch-gradient text-sidebar-foreground">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <p className="label-kicker text-sidebar-primary">RugbyStatsApp</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold uppercase leading-[0.95] sm:text-6xl">
            La statistique du club, match après match
          </h1>
          <p className="mt-5 max-w-xl text-sidebar-foreground/80">
            Saisie d'événements unitaires après-match ou en direct, scores calculés automatiquement,
            statistiques collectives et individuelles pour toutes les équipes du club.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="default" className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
              <Link to="/auth">Se connecter</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent">
              <Link to="/matchs">Voir les matchs</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-3">
        {[
          {
            icon: Activity,
            title: "Saisie rapide",
            text: "Mêlées, touches, turnovers, pénalités, cartons, points, entrées 22 et 50/22 en quelques appuis.",
          },
          {
            icon: BarChart3,
            title: "Statistiques automatiques",
            text: "Score, gains de conquête, plaquages, jeu au pied et bilans individuels recalculés en continu.",
          },
          {
            icon: ShieldCheck,
            title: "Rôles et historique",
            text: "Lecteur, Éditeur, Administrateur. Chaque correction et finalisation est historisée.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border bg-card p-5 shadow-panel">
            <f.icon className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-semibold uppercase">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
