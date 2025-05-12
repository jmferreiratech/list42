import { createAuthClient } from "better-auth/react"
import settings from "./settings.ts";

export function setupAuthClient() {
    return createAuthClient({
        baseURL: `${settings.baseURL}/auth`,
    });
}

export type AuthClient = ReturnType<typeof createAuthClient>;

export type Session = AuthClient['$Infer']['Session'];
