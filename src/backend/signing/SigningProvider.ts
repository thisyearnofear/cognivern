export interface SigningParams {
  walletId: string;
  message: string;
  apiKeyToken?: string | null;
  derivationPath?: string;
}

export interface SigningResult {
  signature: string;
  signer: string;
}

export interface SigningProvider {
  readonly name: string;
  sign(params: SigningParams): Promise<SigningResult>;
}
