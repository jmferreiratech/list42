import { createAuthClient } from "better-auth/react"
import settings from "./settings.ts";

const authClient = createAuthClient({
    baseURL: `${settings.baseURL}/api/auth`,
});

export default authClient;
