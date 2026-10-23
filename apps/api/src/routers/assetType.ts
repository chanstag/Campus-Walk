import { asc } from "drizzle-orm";
import { assetType } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";

export const assetTypeRouter = router({
  list: authorizedProcedure("asset", "read").query(({ ctx }) =>
    ctx.db.query.assetType.findMany({ orderBy: [asc(assetType.category), asc(assetType.name)] }),
  ),
});
