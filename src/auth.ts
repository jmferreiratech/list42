import { createAuthClient } from "better-auth/react"
import settings from "./settings.ts";

const authClient = createAuthClient({
    baseURL: `${settings.baseURL}/auth`,
});

export default authClient;
