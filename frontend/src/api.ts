import {
    MutateOptions,
    QueryClient,
    queryOptions,
    useIsMutating,
    useMutation,
    useMutationState,
    useQueryClient,
} from '@tanstack/react-query';
import { OFFLINE_CACHE_MAX_AGE_MS } from './offlineCache.ts';
import settings from './settings.ts';

export interface GroceryItem {
    id: string;
    name: string;
    completed: boolean;
    updatedAt?: string | null;
}

interface GroceryList {
    id: string;
    items: GroceryItem[];
    createdAt?: string;
    updatedAt?: string | null;
}

interface GroceryListSummary {
    id: string;
    name: string;
}

export const queryKeys = {
    groceryLists: ['groceryLists'] as const,
    groceryList: (listId: string) => ['groceryList', listId] as const,
};

export function createQueryClient(): QueryClient {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                // Cached data is reused as is. Only the open list refetches, on a timer and on focus (see GroceryList).
                staleTime: Infinity,
                retry: false,
                // Kept as long as the saved copy, so a list opened before is still there after a restart without network.
                gcTime: OFFLINE_CACHE_MAX_AGE_MS,
                networkMode: 'offlineFirst',
            },
        },
    });
    registerItemMutations(queryClient);
    return queryClient;
}

export const groceryListsQuery = queryOptions({
    queryKey: queryKeys.groceryLists,
    queryFn: ({ signal }) => request<GroceryListSummary[]>('', { signal }),
});

export function groceryListQuery(listId: string) {
    return queryOptions({
        queryKey: queryKeys.groceryList(listId),
        queryFn: ({ signal }) => request<GroceryList>(`/${encodeURIComponent(listId)}`, { signal }),
    });
}

// Each share asks for a new code, so it is not cached.
export function fetchShareCode(): Promise<string> {
    return request<string>('/mine/share-code');
}

// True while any item change to this list is still being saved.
export function useIsSavingItems(listId: string): boolean {
    return useIsMutating({ mutationKey: itemMutationKey(listId) }) > 0;
}

// Ids of the items on this list with changes that could not be sent yet, such as those made offline.
export function useUnsentItemIds(listId: string): Set<GroceryItem['id']> {
    const unsentChanges = useMutationState({
        filters: { mutationKey: itemMutationKey(listId), predicate: mutation => mutation.state.isPaused },
        select: mutation => mutation.state.variables as ItemChange,
    });
    return new Set(unsentChanges.map(change => change.item.id));
}

export function useAddItem(listId: string) {
    return useItemMutation(listId, 'add');
}

export function useUpdateItem(listId: string) {
    return useItemMutation(listId, 'update');
}

export function useDeleteItem(listId: string) {
    return useItemMutation(listId, 'delete');
}

export function useRedeemShareCode() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shareCode: string) => request<GroceryList>(
            `?${new URLSearchParams({ shared: shareCode })}`,
            { method: 'POST' },
        ),
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.groceryLists }),
    });
}

type ItemAction = 'add' | 'update' | 'delete';

// Everything needed to send a change lives in its variables, so a change saved offline can be sent after a restart.
interface ItemChange {
    listId: string;
    action: ItemAction;
    item: GroceryItem;
}

const itemActions: Record<ItemAction, {
    send: (listId: string, item: GroceryItem) => Promise<GroceryList>;
    applyToItems: (items: GroceryItem[], item: GroceryItem) => GroceryItem[];
}> = {
    add: {
        send: (listId, item) => request<GroceryList>(itemsPath(listId), { method: 'POST', body: item }),
        applyToItems: (items, item) => [...items, item],
    },
    update: {
        send: (listId, item) => request<GroceryList>(itemPath(listId, item), { method: 'PUT', body: item }),
        applyToItems: (items, item) => items.map(i => i.id === item.id ? item : i),
    },
    delete: {
        send: (listId, item) => request<GroceryList>(itemPath(listId, item), { method: 'DELETE' }),
        applyToItems: (items, item) => items.filter(i => i.id !== item.id),
    },
};

function useItemMutation(listId: string, action: ItemAction) {
    const mutationKey = itemMutationKey(listId);
    // How changes are sent and applied comes from the defaults in registerItemMutations.
    const { mutate } = useMutation<GroceryList, Error, ItemChange>({
        mutationKey,
        // Changes to one list are sent one at a time, so each reply already includes the changes before it.
        scope: { id: mutationKey.join(':') },
    });

    return {
        mutate: (item: GroceryItem, options?: MutateOptions<GroceryList, Error, ItemChange>) => {
            // The client stamps the change, so the server can tell an old offline change from a newer one.
            const change = action === 'delete' ? item : { ...item, updatedAt: new Date().toISOString() };
            mutate({ listId, action, item: change }, options);
        },
    };
}

// Changes made offline are paused and saved with the cache. They resume after a restart only if
// the client already knows how to send them, so this is set up when the client is created.
function registerItemMutations(queryClient: QueryClient): void {
    queryClient.setMutationDefaults<GroceryList, Error, ItemChange>(['groceryListItems'], {
        mutationFn: ({ listId, action, item }) => itemActions[action].send(listId, item),
        onMutate: async ({ listId, action, item }) => {
            const { queryKey } = groceryListQuery(listId);
            // A refetch already on its way would bring back the list without this change.
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(queryKey, list => list && { ...list, items: itemActions[action].applyToItems(list.items, item) });
        },
        onError: (_error, { listId }) => {
            // The reply to the last pending change brings the list as the server has it. Without one, ask for it.
            if (isLastPendingChange(queryClient, listId)) {
                queryClient.invalidateQueries({ queryKey: queryKeys.groceryList(listId) });
            }
        },
        onSuccess: (list, { listId }) => {
            // A reply that arrives while later changes are still pending lacks them, so writing it would undo them on screen.
            if (isLastPendingChange(queryClient, listId)) {
                queryClient.setQueryData(queryKeys.groceryList(listId), list);
            }
        },
    });
}

function isLastPendingChange(queryClient: QueryClient, listId: string): boolean {
    return queryClient.isMutating({ mutationKey: itemMutationKey(listId) }) === 1;
}

function itemMutationKey(listId: string) {
    return ['groceryListItems', listId] as const;
}

function itemsPath(listId: string): string {
    return `/${encodeURIComponent(listId)}/items`;
}

function itemPath(listId: string, item: GroceryItem): string {
    return `${itemsPath(listId)}/${encodeURIComponent(item.id)}`;
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
}

async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${settings.baseURL}/lists${path}`, {
        method,
        signal,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`${method} ${path} failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}
