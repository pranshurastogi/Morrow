import { useAuth } from "@clerk/tanstack-react-start";
import { useEffect } from "react";

import { registerAccessTokenProvider } from "./access-token";

/**
 * Keeps Clerk at the authentication boundary while allowing the framework-
 * agnostic API client to request a fresh session token for each operation.
 */
export function ClerkSessionBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    return registerAccessTokenProvider(
      isSignedIn ? () => getToken() : async () => null,
    );
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
