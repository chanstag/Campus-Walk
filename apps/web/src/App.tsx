import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTRPC } from "./trpc";

export default function App() {
  const trpc = useTRPC();
  const hello = useQuery(trpc.hello.queryOptions({ name: "Campus Walk" }));
  const health = useQuery(trpc.health.queryOptions());

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Campus Walk</h1>
      <p>Vite + React + tRPC + Fastify + Drizzle + Neon skeleton.</p>

      <section>
        <h2>tRPC: hello</h2>
        <Status q={hello} render={(d) => <code>{d.greeting}</code>} />
      </section>

      <section>
        <h2>tRPC: health (Neon)</h2>
        <Status
          q={health}
          render={(d) => (
            <code>
              db: {d.db} at {d.at}
            </code>
          )}
        />
      </section>
    </main>
  );
}

function Status<T>({
  q,
  render,
}: {
  q: { isPending: boolean; error: { message: string } | null; data: T | undefined };
  render: (data: T) => ReactNode;
}) {
  if (q.isPending) return <p>Loading…</p>;
  if (q.error) return <p style={{ color: "crimson" }}>Error: {q.error.message}</p>;
  return <p>{render(q.data as T)}</p>;
}
