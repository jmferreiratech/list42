import {
    QueryClient,
    queryOptions,
    useIsMutating,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
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
    shareCode: ['shareCode'] as const,
};

export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            // Cached data is reused as is. Only the open list refetches, on a timer and on focus (see GroceryList).
            queries: { staleTime: Infinity, retry: false },
        },
    });
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

export const shareCodeQuery = queryOptions({
    queryKey: queryKeys.shareCode,
    queryFn: ({ signal }) => request<string>('/mine/share-code', { signal }),
    staleTime: 0,
});

// True while any item change to this list is still being saved.
export function useIsSavingItems(listId: string): boolean {
    return useIsMutating({ mutationKey: itemMutationKey(listId) }) > 0;
}

export function useAddItem(listId: string) {
    return useItemMutation(listId, {
        send: item => request<GroceryList>(itemsPath(listId), { method: 'POST', body: item }),
        applyToItems: (items, item) => [...items, stampUpdatedAt(item)],
    });
}

export function useUpdateItem(listId: string) {
    return useItemMutation(listId, {
        send: item => request<GroceryList>(itemPath(listId, item), { method: 'PUT', body: item }),
        applyToItems: (items, item) => items.map(i => i.id === item.id ? stampUpdatedAt(item) : i),
    });
}

export function useDeleteItem(listId: string) {
    return useItemMutation(listId, {
        send: item => request<GroceryList>(itemPath(listId, item), { method: 'DELETE' }),
        applyToItems: (items, item) => items.filter(i => i.id !== item.id),
    });
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

interface ItemChange {
    send: (item: GroceryItem) => Promise<GroceryList>;
    applyToItems: (items: GroceryItem[], item: GroceryItem) => GroceryItem[];
}

function useItemMutation(listId: string, { send, applyToItems }: ItemChange) {
    const queryClient = useQueryClient();
    const { queryKey } = groceryListQuery(listId);
    const mutationKey = itemMutationKey(listId);

    return useMutation({
        mutationKey,
        // Changes to one list are sent one at a time, so each reply already includes the changes before it.
        scope: { id: mutationKey.join(':') },
        mutationFn: send,
        onMutate: async (item: GroceryItem) => {
            // A refetch already on its way would bring back the list without this change.
            await queryClient.cancelQueries({ queryKey });
            const previousList = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, list => list && { ...list, items: applyToItems(list.items, item) });
            return { previousList };
        },
        onError: (_error, _item, context) => {
            queryClient.setQueryData(queryKey, context?.previousList);
        },
        onSuccess: (list) => {
            // A reply that arrives while later changes are still pending lacks them, so writing it would undo them on screen.
            if (queryClient.isMutating({ mutationKey }) === 1) {
                queryClient.setQueryData(queryKey, list);
            }
        },
    });
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

function stampUpdatedAt(item: GroceryItem): GroceryItem {
    return { ...item, updatedAt: new Date().toISOString() };
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
