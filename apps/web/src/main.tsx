import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DesignPage from "./design/DesignPage";
import "./index.css";
import { makeTRPCClient, TRPCProvider } from "./trpc";

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => makeTRPCClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <App />
      </TRPCProvider>
    </QueryClientProvider>
  );
}

// Dev-only style guide at /design. Replace with a real router when routing lands.
const page = window.location.pathname === "/design" ? <DesignPage /> : <Root />;

createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);
