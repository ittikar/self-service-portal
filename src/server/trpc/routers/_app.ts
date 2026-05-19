import { createTRPCRouter } from "../trpc";
import { catalogRouter } from "./catalog";
import { requestRouter } from "./request";

export const appRouter = createTRPCRouter({
  catalog: catalogRouter,
  request: requestRouter,
});

export type AppRouter = typeof appRouter;
