import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LogOut, Shield, ClipboardList, Users, UserRound } from "lucide-react";
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
  const { user, highestRole, isAdmin, realIsAdmin, isPending, previewMode, setPreviewMode } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const header = (
    <header className="pitch-gradient sticky top-0 z-30 border-b border-sidebar-border print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/matchs" className="flex items-center gap-2">
          <img src="/logo2.png" alt="Logo" className="size-9 rounded-md object-contain" />
          <span className="font-display text-lg font-semibold uppercase tracking-wide text-sidebar-foreground">
            Rugby<span className="text-sidebar-primary">StatsApp</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {!isPending && (
            <>
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
            </>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Link to="/admin">
                <Users className="size-4" /> Administration
              </Link>
            </Button>
          )}
          {realIsAdmin && (
            <Button
              variant={previewMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              className={previewMode ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30" : "text-sidebar-foreground hover:bg-sidebar-accent"}
              title={previewMode ? "Quitter la prévisualisation" : "Prévisualiser en tant que Lecteur"}
            >
              {previewMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {previewMode ? "Quitter prévisualisation" : "Vue lecteur"}
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
      {previewMode && (
        <div className="bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-white">
          Mode prévisualisation — vous voyez l'interface telle qu'un Lecteur la voit
        </div>
      )}
    </header>
  );

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <main className="mx-auto max-w-6xl px-4 py-16 text-center">
          <Shield className="mx-auto mb-4 size-12 text-muted-foreground/40" />
          <h1 className="text-2xl font-bold uppercase">Compte en attente d'approbation</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
            Votre compte a été créé. Un administrateur doit valider votre accès avant que vous puissiez utiliser l'application.
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}>
            Se déconnecter
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
