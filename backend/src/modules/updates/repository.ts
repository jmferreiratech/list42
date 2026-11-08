import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
    DeleteCommand,
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand,
    type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

import type {Settings} from '../../settings';

// API Gateway closes a WebSocket connection after 2 hours, so a row older than this was left behind.
const CONNECTION_TTL_SECONDS = 3 * 60 * 60;

// The open WebSocket connections, each watching one list.
export default class ConnectionsRepository {
    private ddbDocClient: DynamoDBDocumentClient;
    private readonly tableName: string;
    private readonly byListIndex: string;

    static config(cfg: Settings) {
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
        return new ConnectionsRepository(ddb, cfg.connectionsTable, cfg.connectionsByListIndex);
    }

    async create(data: Pick<ListConnection, 'id' | 'list' | 'user'>) {
        const now = new Date();
        const Item: ListConnection = {
            ...data,
            createdAt: now.toISOString(),
            expiresAt: Math.floor(now.getTime() / 1000) + CONNECTION_TTL_SECONDS,
        };

        await this.ddbDocClient.send(new PutCommand({
            TableName: this.tableName,
            Item,
        }));

        return Item;
    }

    async remove(id: ListConnection['id']) {
        await this.ddbDocClient.send(new DeleteCommand({
            TableName: this.tableName,
            Key: {id},
        }));
    }

    async listIdsByList(list: ListConnection['list']): Promise<ListConnection['id'][]> {
        const input: QueryCommandInput = {
            TableName: this.tableName,
            IndexName: this.byListIndex,
            KeyConditionExpression: '#hash = :hash',
            ExpressionAttributeNames: {'#hash': 'list'},
            ExpressionAttributeValues: {':hash': list},
        };
        const ids: ListConnection['id'][] = [];

        do {
            const {Items = [], LastEvaluatedKey} = await this.ddbDocClient.send(new QueryCommand(input));
            ids.push(...(Items as Pick<ListConnection, 'id'>[]).map(item => item.id));
            input.ExclusiveStartKey = LastEvaluatedKey;
        } while (input.ExclusiveStartKey);

        return ids;
    }

    constructor(
        ddbDocClient: DynamoDBDocumentClient,
        tableName: string,
        byList: string,
    ) {
        this.ddbDocClient = ddbDocClient;
        this.tableName = tableName;
        this.byListIndex = byList;
    }
}

export interface ListConnection {
    /** API Gateway connection id. */
    id: string;
    list: string;
    user: string;
    createdAt: string;
    /** Epoch seconds, for the table's TTL. */
    expiresAt: number;
}
