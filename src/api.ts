import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react';
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
        addItem: builder.mutation<GroceryList, { id?: GroceryList['id'], item: GroceryItem }>({
            query: ({id = 'mine', item}) => ({
                url: `/${id}/items`,
                method: 'POST',
                body: item,
            }),
            async onQueryStarted({ id, item }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                        if (draft) {
                            draft.items.push({...item, updatedAt: new Date().toISOString()});
                        }
                    })
                );
                try {
                    const { data } =await queryFulfilled;
                    dispatch(
                        groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                            Object.assign(draft, data)
                        }),
                    )
                } catch {
                    patchResult.undo();
                }
            },
        }),
        updateItem: builder.mutation<GroceryList, { id?: GroceryList['id'], item: GroceryItem }>({
            query: ({id = 'mine', item}) => ({
                url: `/${id}/items/${item.id}`,
                method: 'PUT',
                body: item,
            }),
            async onQueryStarted({ id, item }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                        if (draft) {
                            const index = draft.items.findIndex(i => i.id === item.id);
                            if (index !== -1) {
                                draft.items[index] = {...item, updatedAt: new Date().toISOString()};
                            }
                        }
                    })
                );
                try {
                    const { data } = await queryFulfilled;
                    dispatch(
                        groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                            Object.assign(draft, data)
                        }),
                    )
                } catch {
                    patchResult.undo();
                }
            },
        }),
        deleteItem: builder.mutation<GroceryList, { id?: GroceryList['id'], item: GroceryItem }>({
            query: ({id = 'mine', item}) => ({
                url: `/${id}/items/${item.id}`,
                method: 'DELETE',
            }),
            async onQueryStarted({ id, item }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                        if (draft) {
                            draft.items = draft.items.filter(i => i.id !== item.id);
                        }
                    })
                );
                try {
                    const { data } = await queryFulfilled;
                    dispatch(
                        groceryApi.util.updateQueryData('getGroceryList', {id}, (draft) => {
                            Object.assign(draft, data)
                        }),
                    )
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
