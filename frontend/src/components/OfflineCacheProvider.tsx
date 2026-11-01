import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactNode } from 'react';
import { OFFLINE_CACHE_MAX_AGE_MS, offlineCachePersister } from '../offlineCache.ts';

interface OfflineCacheProviderProps {
    userId: string;
    children: ReactNode;
}

// Saves the lists and the unsent changes, so the app opens and keeps working without network.
// The cache belongs to one user: a cache saved by someone else is dropped instead of restored.
export default function OfflineCacheProvider({ userId, children }: OfflineCacheProviderProps) {
    const queryClient = useQueryClient();

    // Queries wait until this returns, so it must not wait for the network.
    const handleRestored = () => {
        // The saved lists may be old: marked stale, each one is fetched again when shown.
        void queryClient.invalidateQueries({ refetchType: 'none' });
        // Offline, unsent changes wait here for the connection to return.
        void queryClient.resumePausedMutations();
    };

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: offlineCachePersister, buster: userId, maxAge: OFFLINE_CACHE_MAX_AGE_MS }}
            onSuccess={handleRestored}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
