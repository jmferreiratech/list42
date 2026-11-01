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

    const handleRestored = async () => {
        await queryClient.resumePausedMutations();
        // The saved lists may be old, so the open one is fetched again once the unsent changes are in.
        await queryClient.invalidateQueries();
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
