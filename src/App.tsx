import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import IdentifyPage from "./pages/IdentifyPage";
import GardenPage from "./pages/GardenPage";
import PlantDetailPage from "./pages/PlantDetailPage";
import SettingsPage from "./pages/SettingsPage";
import DiagnosisPage from "./pages/DiagnosisPage";
import PlantChatPage from "./pages/PlantChatPage";
import AuthForm from "./components/AuthForm";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) return null;
  if (!user) return <AuthForm />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthGate>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/identify" element={<IdentifyPage />} />
                <Route path="/garden" element={<GardenPage />} />
                <Route path="/plant/:id" element={<PlantDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/diagnose" element={<DiagnosisPage />} />
                <Route path="/chat" element={<PlantChatPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthGate>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
