export type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function registerAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;

  return () => {
    if (accessTokenProvider === provider) accessTokenProvider = null;
  };
}

export async function getAccessToken(): Promise<string | null> {
  return accessTokenProvider?.() ?? null;
}
