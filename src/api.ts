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
    tagTypes: ['GroceryList', 'GroceryLists'],
    endpoints: (builder) => ({
        listGroceryLists: builder.query<{id: string; name: string}[], void>({
            query: () => '/',
            providesTags: ['GroceryLists'],
        }),
        getGroceryList: builder.query<GroceryList, { id?: GroceryList['id'] }>({
            query: ({id = 'mine'}) => `/${id}`,
            providesTags: ['GroceryList'],
        }),
        updateGroceryList: builder.mutation<GroceryList, { id?: GroceryList['id'], items: GroceryItem[] }>({
            query: ({id = 'mine', items}) => ({
                url: `/${id}`,
                method: 'PUT',
                body: {items},
            }),
            async onQueryStarted({ id, items }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
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
        getShareCode: builder.query<string, void>({
            query: () => '/mine/share-code',
        }),
        redeemShareCode: builder.mutation<GroceryList, { shareCode: string }>({
            query: ({shareCode}) => ({
                url: '/',
                method: 'POST',
                params: {shared: shareCode},
            }),
            invalidatesTags: ['GroceryLists'],
        }),
    }),
});

export default groceryApi;
