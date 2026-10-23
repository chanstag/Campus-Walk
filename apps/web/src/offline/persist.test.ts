import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";
import { pauseRestoredMutations, shouldPersistMutation, shouldPersistQuery } from "./persist";

function query(path: string[], status: "success" | "error" | "pending" = "success") {
  return { queryKey: [path, { input: {}, type: "query" }], state: { status } } as unknown as Parameters<typeof shouldPersistQuery>[0];
}

describe("shouldPersistQuery", () => {
  it("keeps the walk screen's reads", () => {
    for (const path of [["campus", "tree"], ["asset", "byRoom"], ["asset", "byBuilding"], ["assetType", "list"], ["permissions", "mine"]])
      expect(shouldPersistQuery(query(path))).toBe(true);
  });

  it("skips other procedures, signed photo URLs and queries without data", () => {
    expect(shouldPersistQuery(query(["office", "summary"]))).toBe(false);
    expect(shouldPersistQuery(query(["assetPhoto", "list"]))).toBe(false);
    expect(shouldPersistQuery(query(["asset", "byCampus"]))).toBe(false);
    expect(shouldPersistQuery(query(["asset", "byRoom"], "error"))).toBe(false);
  });
});

describe("shouldPersistMutation", () => {
  it("keeps only writes the server has not confirmed", () => {
    const m = (status: string) => ({ state: { status } }) as Parameters<typeof shouldPersistMutation>[0];
    expect(shouldPersistMutation(m("pending"))).toBe(true);
    expect(shouldPersistMutation(m("success"))).toBe(false);
    expect(shouldPersistMutation(m("error"))).toBe(false);
  });
});

describe("pauseRestoredMutations", () => {
  it("marks restored pending mutations paused so they are replayed, and leaves the rest alone", () => {
    const client = {
      timestamp: 0,
      buster: "1",
      clientState: {
        queries: [],
        mutations: [
          { mutationKey: [["asset", "assess"]], state: { status: "pending", isPaused: false, variables: { assetId: "a" } } },
          { mutationKey: [["asset", "assess"]], state: { status: "success", isPaused: false } },
        ],
      },
    } as unknown as PersistedClient;

    const restored = pauseRestoredMutations(client);
    expect(restored.clientState.mutations.map((m) => m.state.isPaused)).toEqual([true, false]);
    expect(restored.clientState.mutations[0]!.state.variables).toEqual({ assetId: "a" });
  });
});
