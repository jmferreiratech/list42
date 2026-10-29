import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

import type {Settings} from '../../settings';

export default class SharesRepository {
    private ddbDocClient: DynamoDBDocumentClient;
    private readonly tableName: string;
    private readonly byIdIndex: string;

    static config(cfg: Settings) {
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
        return new SharesRepository(ddb, cfg.sharesTable, cfg.sharesByIdIndex);
    }

    async create(data: Pick<ListShare, 'id' | 'user' | 'list' | 'name'>) {
        const Item: ListShare = {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: null,
        };

        await this.ddbDocClient.send(new PutCommand({
            TableName: this.tableName,
            Item,
        }));

        return Item;
    }

    async listByUser(user: ListShare['user']) {
        const {Items} = await queryAll(this.ddbDocClient, {
            TableName: this.tableName,
            KeyConditionExpression: '#hash = :hash',
            ExpressionAttributeNames: {'#hash': 'user'},
            ExpressionAttributeValues: {':hash': user},
        });

        return Items as ListShare[];
    }

    async retrieve(id: ListShare['id']): Promise<ListShare | null> {
        const {Items} = await this.ddbDocClient.send(new QueryCommand({
            TableName: this.tableName,
            IndexName: this.byIdIndex,
            KeyConditionExpression: '#hash = :hash',
            ExpressionAttributeNames: {'#hash': 'id'},
            ExpressionAttributeValues: {':hash': id},
            Limit: 1,
        }));

        return (Items?.[0] as ListShare | undefined) ?? null;
    }

    async find(user: ListShare['user'], list: ListShare['list']) {
        const {Item} = await this.ddbDocClient.send(new GetCommand({
            TableName: this.tableName,
            Key: {user, list},
        }));

        return Item as ListShare | undefined ?? null;
    }

    constructor(
        ddbDocClient: DynamoDBDocumentClient,
        tableName: string,
        byId: string,
    ) {
        this.ddbDocClient = ddbDocClient;
        this.tableName = tableName;
        this.byIdIndex = byId;
    }
}

export interface ListShare {
    id: string;
    name: string;
    user: string;
    list: string;
    createdAt: string;
    updatedAt: string | null;
}

async function queryAll<T>(ddb: DynamoDBDocumentClient, input: QueryCommandInput): Promise<QueryResult<T>> {
    const Items: T[] = [];

    do {
        const {Items: some = [], LastEvaluatedKey} = await ddb.send(new QueryCommand(input));
        Items.push(...some as T[]);
        input.ExclusiveStartKey = LastEvaluatedKey;
    } while (input.ExclusiveStartKey);

    return {
        Items,
    };
}

interface QueryResult<T> {
    Items: T[];
}
