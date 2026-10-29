import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import type {User} from 'better-auth';

import {DynamoDbAdapterMethods} from '../../db/ddb-adapter';
import type {Settings} from '../../settings';

export class UsersRepository {
    private adapter: DynamoDbAdapterMethods;
    private readonly model: string;

    static config(_cfg: Settings) {
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
        return new UsersRepository(
            new DynamoDbAdapterMethods(ddb),
            'users',
        );
    }

    async retrieve(id: User['id']) {
        return this.adapter.findOne<User>({
            model: this.model,
            where: [{
                field: 'id',
                operator: 'eq',
                value: id,
                connector: 'AND',
            }],
        });
    }

    constructor(
        adapter: DynamoDbAdapterMethods,
        model: string,
    ) {
        this.adapter = adapter;
        this.model = model;
    }
}
