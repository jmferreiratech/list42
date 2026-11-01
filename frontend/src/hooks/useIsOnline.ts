import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

export default function useIsOnline(): boolean {
    return useSyncExternalStore(
        onStoreChange => onlineManager.subscribe(onStoreChange),
        () => onlineManager.isOnline(),
    );
}
