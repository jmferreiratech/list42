import {ConditionalCheckFailedException, DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';

import type {Settings} from '../../settings';

// Item changes update only their own item, so changes to different items never overwrite each other.
// Each one is saved only if it is not older than the stored item, so a change that arrives late
// (made offline) can't undo a newer one. Every write returns the list as stored afterwards.
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

    async saveItem(listId: GroceryList['id'], item: GroceryListItem): Promise<GroceryList | null> {
        await this.createIfMissing(listId);

        return await this.updateIfNotOlder(listId, item.id, item.updatedAt, {
            UpdateExpression: 'SET #items.#itemId = :item, #updatedAt = :now, #updatedBy = :updatedBy',
            ConditionExpression: 'attribute_not_exists(#items.#itemId) OR #items.#itemId.#updatedAt <= :updatedAt',
            ExpressionAttributeValues: {':item': item, ':updatedBy': item.updatedBy},
        });
    }

    // The item is kept, marked as deleted, so that an older change arriving later can't bring it back.
    async deleteItem(listId: GroceryList['id'], itemId: GroceryListItem['id'], updatedAt: string, updatedBy: string): Promise<GroceryList | null> {
        return await this.updateIfNotOlder(listId, itemId, updatedAt, {
            UpdateExpression: 'SET #items.#itemId.#deleted = :deleted, #items.#itemId.#updatedAt = :updatedAt, #items.#itemId.#updatedBy = :updatedBy, #updatedAt = :now, #updatedBy = :updatedBy',
            ConditionExpression: '#items.#itemId.#updatedAt <= :updatedAt',
            ExpressionAttributeNames: {'#deleted': 'deleted'},
            ExpressionAttributeValues: {':deleted': true, ':updatedBy': updatedBy},
        });
    }

    private async updateIfNotOlder(
        listId: GroceryList['id'],
        itemId: GroceryListItem['id'],
        updatedAt: string,
        expression: ItemUpdateExpression,
    ): Promise<GroceryList | null> {
        try {
            const {Attributes} = await this.ddbDocClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {id: listId},
                UpdateExpression: expression.UpdateExpression,
                ConditionExpression: expression.ConditionExpression,
                ExpressionAttributeNames: {
                    '#items': 'items',
                    '#itemId': itemId,
                    '#updatedAt': 'updatedAt',
                    '#updatedBy': 'updatedBy',
                    ...expression.ExpressionAttributeNames,
                },
                ExpressionAttributeValues: {
                    ':updatedAt': updatedAt,
                    ':now': new Date().toISOString(),
                    ...expression.ExpressionAttributeValues,
                },
                ReturnValues: 'ALL_NEW',
            }));
            return Attributes as GroceryList;
        } catch (error) {
            if (error instanceof ConditionalCheckFailedException) {
                return await this.retrieve(listId);
            }
            throw error;
        }
    }

    // A nested item can only be set once the list and its items map exist.
    private async createIfMissing(id: GroceryList['id']): Promise<void> {
        const list: GroceryList = {
            id,
            items: {},
            createdAt: new Date().toISOString(),
            updatedAt: null,
            updatedBy: null,
        };

        try {
            await this.ddbDocClient.send(new PutCommand({
                TableName: this.tableName,
                Item: list,
                ConditionExpression: 'attribute_not_exists(id)',
            }));
        } catch (error) {
            if (!(error instanceof ConditionalCheckFailedException)) {
                throw error;
            }
        }
    }

    constructor(
        ddbDocClient: DynamoDBDocumentClient,
        tableName: string,
    ) {
        this.ddbDocClient = ddbDocClient;
        this.tableName = tableName;
    }
}

interface ItemUpdateExpression {
    UpdateExpression: string;
    ConditionExpression: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues: Record<string, unknown>;
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
    deleted?: boolean;
}
