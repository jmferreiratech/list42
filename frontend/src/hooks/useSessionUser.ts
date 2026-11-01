import { useEffect } from 'react';
import { type Session } from '../auth';
import { useAuth } from '../components/Auth.tsx';

export type SessionUser = Pick<Session['user'], 'id' | 'name' | 'email' | 'image'>;

interface SessionUserState {
    user: SessionUser | null;
    isPending: boolean;
}

const LAST_USER_KEY = 'list42.lastSessionUser';

// Without network the session request fails. The last user the server confirmed is trusted
// until the server answers again, and forgotten only when it says there is no session.
export default function useSessionUser(): SessionUserState {
    const { data, isPending, error } = useAuth().useSession();
    const isConfirmedByServer = !isPending && !error;
    const confirmedUser = data ? toSessionUser(data.user) : null;
    const confirmedUserJson = JSON.stringify(confirmedUser);

    useEffect(() => {
        if (!isConfirmedByServer) {
            return;
        }
        if (confirmedUserJson === 'null') {
            localStorage.removeItem(LAST_USER_KEY);
        } else {
            localStorage.setItem(LAST_USER_KEY, confirmedUserJson);
        }
    }, [isConfirmedByServer, confirmedUserJson]);

    if (isPending) {
        return { user: null, isPending: true };
    }
    return { user: error ? readLastUser() : confirmedUser, isPending: false };
}

function toSessionUser({ id, name, email, image }: Session['user']): SessionUser {
    return { id, name, email, image };
}

function readLastUser(): SessionUser | null {
    const storedUser = localStorage.getItem(LAST_USER_KEY);
    return storedUser ? JSON.parse(storedUser) as SessionUser : null;
}
