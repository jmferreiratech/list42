import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

export const OFFLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Saved on every change instead of throttled: a list is small, and a change made offline
// must already be saved if the app is closed right after it.
export const offlineCachePersister = createAsyncStoragePersister({
    storage: window.localStorage,
    key: 'list42.offlineCache',
    throttleTime: 0,
});

export async function clearOfflineCache(queryClient: QueryClient): Promise<void> {
    queryClient.clear();
    await offlineCachePersister.removeClient();
}
