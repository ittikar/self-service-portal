import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { INFRA_REPOS } from "~/lib/repos";
import { RESOURCE_CATALOG, getResourceDef } from "~/server/schemas";

export const catalogRouter = createTRPCRouter({
  repos: protectedProcedure.query(() => INFRA_REPOS),
  resources: protectedProcedure.query(() => RESOURCE_CATALOG),
  resourceDef: protectedProcedure
    .input(z.object({ type: z.string() }))
    .query(({ input }) => {
      const def = getResourceDef(input.type);
      if (!def) return null;
      return def;
    }),
});
