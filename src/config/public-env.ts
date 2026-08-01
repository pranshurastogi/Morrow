export const publicEnvironment = {
  apiBaseUrl:
    (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(
      /\/$/,
      "",
    ) ?? "",
  pravaPublishableKey:
    (import.meta.env["VITE_PRAVA_PUBLISHABLE_KEY"] as string | undefined) ?? "",
  developmentUserId: import.meta.env.DEV
    ? ((import.meta.env["VITE_DEVELOPMENT_USER_ID"] as string | undefined) ??
      "morrow-local-user")
    : "",
  developmentUserEmail: import.meta.env.DEV
    ? ((import.meta.env["VITE_DEVELOPMENT_USER_EMAIL"] as string | undefined) ??
      "builder@example.com")
    : "",
} as const;

export function hasApiConfiguration(): boolean {
  return publicEnvironment.apiBaseUrl.length > 0;
}
