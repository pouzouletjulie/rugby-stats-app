import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — RugbyStatsApp" },
      {
        name: "description",
        content: "Connectez-vous pour consulter et saisir les statistiques de matchs.",
      },
      { property: "og:title", content: "Connexion — RugbyStatsApp" },
      {
        property: "og:description",
        content: "Accès à RugbyStatsApp.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let navigated = false;

    const handleSession = async (session: Session | null) => {
      if (session && !navigated) {
        navigated = true;
        await supabase.rpc("claim_first_admin");
        navigate({ to: "/matchs" });
      }
    };

    // Handles existing session on page load AND OAuth redirect return (code in URL)
    supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Compte créé — rôle Lecteur attribué");
    } else {
      toast.success("Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.");
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) toast.error("Connexion Google impossible");
  };

  return (
    <div className="pitch-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-10 place-items-center rounded-md bg-sidebar-primary text-2xl">
            🏉
          </span>
          <span className="font-display text-xl font-semibold uppercase tracking-wide text-sidebar-foreground">
            Rugby<span className="text-sidebar-primary">StatsApp</span>
          </span>
        </Link>
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="uppercase">Accès au club</CardTitle>
            <CardDescription>
              Toute nouvelle inscription reçoit le rôle Lecteur. Un administrateur peut ensuite le
              promouvoir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Connexion
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Inscription
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">Mot de passe</Label>
                    <Input
                      id="password2"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              Continuer avec Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
