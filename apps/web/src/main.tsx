import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { PageShell } from "./app/PageShell";
import DesignPage from "./design/DesignPage";
import { initAccent } from "./hooks/use-accent";
import { initTheme } from "./hooks/use-theme";
import "./index.css";
import { OfficePage } from "./office/OfficePage";
import { makeTRPCClient, TRPCProvider } from "./trpc";
import { WalkPage } from "./walk/WalkPage";

initTheme();
initAccent();

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => makeTRPCClient());

  return (
    <BrowserRouter>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <Routes>
              <Route path="/" element={<Navigate to="/walk" replace />} />
              <Route path="/walk" element={<WalkPage />} />
              <Route path="/office" element={<OfficePage />} />
              {/* Dev-only style guide; the link is hidden in production builds. */}
              <Route
                path="/design"
                element={
                  <PageShell placeholder="Design system">
                    <DesignPage />
                  </PageShell>
                }
              />
            </Routes>
          </TRPCProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
