/**
 * API wire types subpath — the HTTP/agent request & response envelopes, auth,
 * workspace, and API key contracts. Owned here as the single source of truth;
 * backend helpers re-export `ApiResponse` from this package.
 */
export type {
  ApiResponse,
  AuthUser,
  AuthSession,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  WalletConfig,
  ApiKeyScope,
  ApiKeyMandate,
  ApiKey,
  ApiKeyCreateResponse,
  Workspace,
  WorkspaceSettings,
  OwsWallet,
  OwsApiKey,
  BootstrapWalletRequest,
  CreateApiKeyRequest,
} from "./types/index.js";
