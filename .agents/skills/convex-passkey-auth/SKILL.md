---
name: convex-passkey-auth
description: Passwordless WebAuthn passkey authentication — self-minted JWTs, multi-device support, session management, and React hooks for Convex. Use this skill whenever working with convex-passkey-auth or related Convex component functionality.
---

# convex-passkey-auth

## Instructions

This component provides complete WebAuthn passkey authentication for Convex apps, handling the full challenge/response flow with self-minted HMAC-SHA256 JWTs. It includes multi-device support, session management, and React hooks for registration and login. The component eliminates passwords entirely while providing secure session tokens compatible with Convex's auth system.

### Installation

```bash
npm install convex-passkey-auth
```

## Use cases

• **Replace traditional password auth** with WebAuthn passkeys for better security and user experience
• **Build multi-device authentication** where users can authenticate from phones, laptops, and hardware security keys
• **Implement passwordless onboarding** with passkey registration and automatic user creation
• **Add secure session management** with configurable expiry, refresh tokens, and logout capabilities
• **Deploy preview environments** without hardcoded origins since rpId is derived from the client

## How it works

The component provides a `PasskeyAuth` class that handles WebAuthn challenge generation and verification through methods like `generateRegistrationOptions` and `verifyAuthentication`. You create Convex mutations that wrap these methods, then use the provided React hooks (`usePasskeyRegister`, `usePasskeyLogin`, `usePasskeyAuth`) to handle the browser WebAuthn APIs.

Session tokens are HMAC-SHA256 signed JWTs that integrate directly with Convex's auth system. The `validateSession` method checks token validity and returns user data, while `getOrCreateUser` provides stable user identifiers from passkey credentials. The component stores passkeys, sessions, and challenges in Convex tables with automatic cleanup via cron jobs.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by convex-passkey-auth is not needed

## Resources

- [npm package](https://www.npmjs.com/package/convex-passkey-auth)
- [GitHub repository](https://github.com/TimpiaAI/convex-passkey-auth)
- [Live demo](https://passkey-auth-demo-iota.vercel.app)
- [Convex Components Directory](https://www.convex.dev/components/convex-passkey-auth)
- [Convex documentation](https://docs.convex.dev)
