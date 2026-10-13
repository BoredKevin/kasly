export interface GatewayOption {
  id: string;
  name: string;
  supportedChannels?: readonly string[] | string[];
}

export interface BankOption {
  code: string;
  name: string;
}

export interface WalletOption {
  code: string;
  name: string;
}
