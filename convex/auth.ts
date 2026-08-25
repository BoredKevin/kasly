import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const profile: Record<string, any> & { email: string } = {
          email: params.email as string,
        };
        if (typeof params.claimToken === "string" && params.claimToken) {
          profile.claimToken = params.claimToken;
        }
        return profile;
      },
    }),
  ],
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

        const preRegSetting = await ctx.db
          .query("appSettings")
          .withIndex("by_key", (q) => q.eq("key", "enablePreRegistration"))
          .unique();

        const isPreRegRequired = preRegSetting !== null ? preRegSetting.value : false;
        const rawClaimToken = (args.profile as any)?.claimToken;

        // If pre-registration is required, or if a claim token was provided
        if (rawClaimToken) {
          const tokenStr = String(rawClaimToken).trim();
          const tokenDoc = await ctx.db
            .query("claimTokens")
            .withIndex("by_token", (q) => q.eq("token", tokenStr))
            .unique();

          if (!tokenDoc || tokenDoc.isUsed || Date.now() > tokenDoc.expiresAt) {
            throw new Error(
              "Invalid or expired claim token. Please verify your student identity again.",
            );
          }

          const placeholderUser = await ctx.db.get("users", tokenDoc.userId);
          if (!placeholderUser) {
            throw new Error("Target pre-registered student profile not found.");
          }

          if (placeholderUser.isClaimed === true || placeholderUser.email) {
            throw new Error(
              "This pre-registered student profile has already been claimed.",
            );
          }

          const candidateEmail = (args.profile as any)?.email
            ? String((args.profile as any).email).trim().toLowerCase()
            : undefined;

          if (candidateEmail) {
            const existingWithEmail = await ctx.db
              .query("users")
              .withIndex("email", (q) => q.eq("email", candidateEmail))
              .first();

            if (existingWithEmail && existingWithEmail._id !== placeholderUser._id) {
              throw new Error("An account with this email address already exists.");
            }
          }

          // Consume token
          await ctx.db.patch("claimTokens", tokenDoc._id, { isUsed: true });

          const profileData = { ...(args.profile as any) };
          delete profileData.claimToken;
          delete profileData.flow;

          // Patch placeholder user
          await ctx.db.patch("users", placeholderUser._id, {
            ...profileData,
            email: candidateEmail,
            isClaimed: true,
            emailVerificationTime: Date.now(),
          });

          return placeholderUser._id;
        }

        if (isPreRegRequired) {
          throw new Error(
            "Pre-registration identity verification is required to create an account.",
          );
        }

        const profileData = { ...(args.profile as any) };
        delete profileData.flow;

        return await ctx.db.insert("users", {
          ...profileData,
          isClaimed: true,
        });
      }
      return args.existingUserId;
    },
  },
});
