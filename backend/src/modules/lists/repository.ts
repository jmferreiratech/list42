import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, PutCommand} from '@aws-sdk/lib-dynamodb';

import type {Settings} from '../../settings';

export default class ListsRepository {
    private ddbDocClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    static config(cfg: Settings) {
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
        return new ListsRepository(ddb, cfg.listsTable);
    }

    async retrieve(id: GroceryList['id']): Promise<GroceryList | null> {
        const {Item} = await this.ddbDocClient.send(new GetCommand({
            TableName: this.tableName,
            Key: {id},
        }));

        return (Item as GroceryList | undefined) ?? null;
    }

    async upsert(id: GroceryList['id'], data: Omit<GroceryList, 'id'> & {id?: GroceryList['id']}, current?: GroceryList): Promise<GroceryList> {
        const Item: GroceryList = {
            id,
            ...data,
            // ToDo: fix creation/update handling
            createdAt: current ? current.createdAt : new Date().toISOString(),
            updatedAt: current ? new Date().toISOString() : null,
        };

        await this.ddbDocClient.send(new PutCommand({
            TableName: this.tableName,
            Item,
        }));

        return Item;
    }

    constructor(
        ddbDocClient: DynamoDBDocumentClient,
        tableName: string,
    ) {
        this.ddbDocClient = ddbDocClient;
        this.tableName = tableName;
    }
}

export interface GroceryList {
    id: string;
    items: Record<string, GroceryListItem>;
    createdAt: string;
    updatedAt: string | null;
    updatedBy: string | null;
}

export interface GroceryListItem {
    id: string;
    name: string;
    completed: boolean;
    updatedBy: string;
    updatedAt: string;
}
