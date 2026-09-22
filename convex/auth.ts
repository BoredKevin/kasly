import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

/**
 * Enhanced Password provider wrapper that intercepts low-level credential errors
 * (such as `InvalidSecret` or `InvalidAccountId` thrown by `retrieveAccount`)
 * and translates them into clean `ConvexError` instances.
 *
 * This prevents unhandled `Uncaught Error: InvalidSecret on the server` crashes
 * and ensures users receive an actionable "Invalid email or password" error.
 */
function SafePassword(config: Parameters<typeof Password>[0] = {}) {
  const provider = Password(config);
  const rawAuthorize =
    (provider as any).options?.authorize ?? (provider as any).authorize;

  const wrappedAuthorize = async (params: any, ctx: any) => {
    try {
      return await rawAuthorize(params, ctx);
    } catch (error: any) {
      const msg = error?.message;

      // Handle invalid credentials cleanly
      if (
        msg === "InvalidSecret" ||
        msg === "InvalidAccountId" ||
        msg === "Invalid credentials"
      ) {
        throw new ConvexError("Invalid email or password");
      }

      // Handle rate limiting cleanly
      if (msg === "TooManyFailedAttempts") {
        throw new ConvexError(
          "Too many failed login attempts. Please try again later.",
        );
      }

      // Handle password requirements
      if (msg === "Invalid password") {
        throw new ConvexError("Password must be at least 8 characters long.");
      }

      if (msg && msg.includes("Missing `password` param")) {
        throw new ConvexError("Password is required.");
      }

      // If it's already a ConvexError, let it propagate directly
      if (error instanceof ConvexError) {
        throw error;
      }

      // Wrap any other error in ConvexError so it never causes Uncaught Error on the server
      throw new ConvexError(msg || "Invalid email or password");
    }
  };

  (provider as any).authorize = wrappedAuthorize;
  if ((provider as any).options) {
    (provider as any).options.authorize = wrappedAuthorize;
  }

  return provider;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    SafePassword({
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
          throw new ConvexError(
            "New user registration is currently disabled by application settings.",
          );
        }

        const preRegSetting = await ctx.db
          .query("appSettings")
          .withIndex("by_key", (q) => q.eq("key", "enablePreRegistration"))
          .unique();

        const isPreRegRequired = preRegSetting !== null ? preRegSetting.value : false;

        const regLinksSetting = await ctx.db
          .query("appSettings")
          .withIndex("by_key", (q) => q.eq("key", "enableRegistrationLinks"))
          .unique();

        const isRegLinksEnabled = regLinksSetting !== null ? regLinksSetting.value : true;
        const rawClaimToken = (args.profile as any)?.claimToken;

        if (isRegLinksEnabled && !rawClaimToken) {
          throw new ConvexError(
            "Public registration is closed. Please register using your personal registration link.",
          );
        }

        // If pre-registration is required, or if a claim token was provided
        if (rawClaimToken) {
          const tokenStr = String(rawClaimToken).trim();
          const tokenDoc = await ctx.db
            .query("claimTokens")
            .withIndex("by_token", (q) => q.eq("token", tokenStr))
            .unique();

          if (!tokenDoc || tokenDoc.isUsed || Date.now() > tokenDoc.expiresAt) {
            throw new ConvexError(
              "Invalid or expired claim token. Please verify your student identity again.",
            );
          }

          const placeholderUser = await ctx.db.get("users", tokenDoc.userId);
          if (!placeholderUser) {
            throw new ConvexError("Target pre-registered student profile not found.");
          }

          if (placeholderUser.isClaimed === true || placeholderUser.email) {
            throw new ConvexError(
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
              throw new ConvexError("An account with this email address already exists.");
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

          // Mark any registration links for this user as claimed
          const regLinks = await ctx.db
            .query("registrationLinks")
            .withIndex("by_userId", (q) => q.eq("userId", placeholderUser._id))
            .collect();

          for (const rl of regLinks) {
            await ctx.db.patch("registrationLinks", rl._id, {
              isClaimed: true,
              claimedAt: Date.now(),
            });
          }

          return placeholderUser._id;
        }

        if (isPreRegRequired) {
          throw new ConvexError(
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
