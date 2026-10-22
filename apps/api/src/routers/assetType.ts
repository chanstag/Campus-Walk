import { asc } from "drizzle-orm";
import { assetType } from "../db/schema.js";
import { protectedProcedure, router } from "../trpc.js";

export const assetTypeRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.assetType.findMany({ orderBy: [asc(assetType.category), asc(assetType.name)] }),
  ),
});
