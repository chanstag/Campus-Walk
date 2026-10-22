import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { PageShell } from "./app/PageShell";
import { AcceptInvitePage } from "./auth/AcceptInvitePage";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";
import DesignPage from "./design/DesignPage";
import { initAccent } from "./hooks/use-accent";
import { initTheme } from "./hooks/use-theme";
import "./index.css";
import { OfficePage } from "./office/OfficePage";
import { makeTRPCClient, TRPCProvider } from "./trpc";
import { UsersPage } from "./users/UsersPage";
import { WalkPage } from "./walk/WalkPage";

initTheme();
initAccent();

function isUnauthorized(err: unknown) {
  return err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED";
}

function makeQueryClient() {
  return new QueryClient({
    // A session that expires mid-visit shows up as UNAUTHORIZED on the next query; go sign in.
    queryCache: new QueryCache({
      onError: (err) => {
        if (isUnauthorized(err) && window.location.pathname !== "/login") window.location.assign("/login");
      },
    }),
    defaultOptions: {
      queries: { retry: (count, err) => !isUnauthorized(err) && count < 3 },
    },
  });
}

function Root() {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() => makeTRPCClient());

  return (
    <BrowserRouter>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />

              <Route element={<RequireAuth />}>
                <Route path="/" element={<Navigate to="/walk" replace />} />
                <Route path="/walk" element={<WalkPage />} />
                <Route path="/office" element={<OfficePage />} />
              </Route>
              <Route element={<RequireAuth adminOnly />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>

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
