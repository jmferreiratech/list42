import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react';
import settings from './settings.ts';

export interface GroceryItem {
    id: string;
    name: string;
    completed: boolean;
}

interface GroceryList {
    id: string;
    items: GroceryItem[];
    createdAt?: string;
    updatedAt?: string | null;
}

export const groceryApi = createApi({
    reducerPath: 'groceryApi',
    baseQuery: fetchBaseQuery({
        baseUrl: `${settings.baseURL}/lists/`,
        credentials: 'include',
    }),
    tagTypes: ['GroceryList'],
    endpoints: (builder) => ({
        getGroceryList: builder.query<GroceryList, void>({
            query: () => '/mine',
            providesTags: ['GroceryList'],
        }),
        updateGroceryList: builder.mutation<GroceryList, { items: GroceryItem[] }>({
            query: ({items}: {items: GroceryItem[]}) => ({
                url: '/mine',
                method: 'PUT',
                body: {items},
            }),
            async onQueryStarted({ items }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    groceryApi.util.updateQueryData('getGroceryList', undefined, (draft) => {
                        if (draft) {
                            draft.items = items;
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
        }),
    }),
});

export const {
    useGetGroceryListQuery,
    useUpdateGroceryListMutation,
} = groceryApi;
