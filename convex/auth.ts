import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(rawCtx, args) {
      const ctx = rawCtx as unknown as MutationCtx;
      if (args.existingUserId === null) {
        const setting = await ctx.db
          .query("appSettings")
          .withIndex("by_key", (q) => q.eq("key", "allowSignUps"))
          .unique();

        const allowSignUps = setting !== null ? setting.value : true;
        if (!allowSignUps) {
          throw new Error(
            "New user registration is currently disabled by application settings.",
          );
        }

        return await ctx.db.insert("users", {
          ...(args.profile as any),
        });
      }
      return args.existingUserId;
    },
  },
});
