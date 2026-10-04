import { PaymentGatewayAdapter } from "./types";

export class GatewayRegistry {
  private adapters = new Map<string, PaymentGatewayAdapter>();

  /**
   * Registers a payment gateway adapter.
   */
  public register(adapter: PaymentGatewayAdapter): void {
    const key = adapter.provider.toLowerCase();
    if (this.adapters.has(key)) {
      throw new Error(`Gateway adapter for provider '${adapter.provider}' is already registered.`);
    }
    this.adapters.set(key, adapter);
  }

  /**
   * Retrieves an adapter by provider name. Throws if not registered.
   */
  public get(provider: string): PaymentGatewayAdapter {
    const key = provider.toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(
        `Payment gateway provider '${provider}' is not supported or not registered.`
      );
    }
    return adapter;
  }

  /**
   * Checks whether a provider is registered.
   */
  public has(provider: string): boolean {
    return this.adapters.has(provider.toLowerCase());
  }

  /**
   * Returns list of all registered gateway adapters.
   */
  public list(): PaymentGatewayAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const registry = new GatewayRegistry();

/**
 * Convenience helper to get an adapter.
 */
export function getGatewayAdapter(provider: string = "borderpay"): PaymentGatewayAdapter {
  return registry.get(provider);
}

/**
 * Returns list of metadata for all supported gateways.
 */
export function listSupportedGateways(): Array<{ provider: string; displayName: string }> {
  return registry.list().map((a) => ({
    provider: a.provider,
    displayName: a.displayName,
  }));
}
