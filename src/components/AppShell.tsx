import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield, ClipboardList, Users, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/useAuth";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrateur",
  editeur: "Éditeur",
  lecteur: "Lecteur",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, highestRole, isAdmin } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="pitch-gradient sticky top-0 z-30 border-b border-sidebar-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/matchs" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-xl">
              🏉
            </span>
            <span className="font-display text-lg font-semibold uppercase tracking-wide text-sidebar-foreground">
              Rugby<span className="text-sidebar-primary">StatsApp</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Link to="/matchs">
                <ClipboardList className="size-4" /> Matchs
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Link to="/joueurs">
                <UserRound className="size-4" /> Joueurs
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
                <Link to="/admin">
                  <Users className="size-4" /> Administration
                </Link>
              </Button>
            )}
          </nav>
          <div className="flex items-center gap-2 border-l border-sidebar-border pl-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-sidebar-foreground/80">{user?.email}</p>
              <Badge variant="secondary" className="mt-0.5 gap-1 text-[10px]">
                <Shield className="size-3" /> {ROLE_LABEL[highestRole]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Se déconnecter"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
