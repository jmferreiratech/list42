import {
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    ScanCommand,
    type ScanCommandOutput,
    TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {type AdapterDebugLogs, type CleanedWhere, createAdapter, type CustomAdapter} from 'better-auth/adapters';

import logger from '../logger';

interface DdbAdapterConfig {
    /**
   * The DynamoDBDocumentClient instance to interact with the database.
   */
    ddbDocClient: DynamoDBDocumentClient;
    /**
   * Helps you debug issues with the adapter.
   */
    debugLogs?: AdapterDebugLogs;
}

export const ddbAdapter = (config: DdbAdapterConfig) => {
    const {ddbDocClient} = config; // Destructure here

    return createAdapter({
        config: {
            adapterId: 'ddb-adapter',
            adapterName: 'DynamoDB Adapter',
            usePlural: true,
            debugLogs: config.debugLogs ?? false,
            supportsJSON: true,
            supportsDates: false,
            supportsBooleans: true,
            supportsNumericIds: false,
        },
        adapter: (
            //  {
            // options, // Better Auth options
            // schema, // User's Better Auth schema
            // debugLog, // Debug log function
            // getField, // Utility function
            // getDefaultModelName, // Utility function
            // getDefaultFieldName, // Utility function
            // getFieldAttributes, // Utility function
        // }
        ) => {
            return new DynamoDbAdapterMethods(ddbDocClient);
        },
    });
};

export class DynamoDbAdapterMethods implements CustomAdapter {
    private ddbDocClient: DynamoDBDocumentClient;

    constructor(ddbDocClient: DynamoDBDocumentClient) {
        this.ddbDocClient = ddbDocClient;
    }

    async create<T extends Record<string, unknown>>({model, data}: {model: string; data: T}) {
        await this.ddbDocClient.send(new PutCommand({
            TableName: model,
            Item: data,
        }));
        return data;
    }

    async update<T>({model, where, update}: {model: string; where: CleanedWhere[]; update: Partial<T>}) {
        const currentItem = await this.findOne({model, where});
        if (!currentItem) {
            return null;
        }

        const updatedItem = {
            ...currentItem,
            ...update,
        };

        await this.ddbDocClient.send(new PutCommand({
            TableName: model,
            Item: updatedItem,
        }));

        return updatedItem as T;
    }

    async updateMany<T>({model, where, update}: {model: string; where: CleanedWhere[]; update: Partial<T>}) {
        const items = await this.findMany<T>({model, where});

        let updatedCount = 0;

        for (let i = 0; i < items.length; i += 100) {
            const batch = items.slice(i, i + 100);

            if (batch.length === 0) {
                continue;
            }

            await this.ddbDocClient.send(new TransactWriteCommand({
                TransactItems: batch.map(item => ({
                    Put: {
                        TableName: model,
                        Item: {...item, ...update},
                    },
                })),
            }));

            updatedCount += batch.length;
        }

        return updatedCount;
    }

    async delete({model, where}: {model: string; where: CleanedWhere[]}) {
        const idCondition = where.find(w => w.field === 'id');
        if (idCondition) {
            await this.ddbDocClient.send(new DeleteCommand({
                TableName: model,
                Key: {id: idCondition.value},
            }));
        }

        // fallback
        const item = await this.findOne<{id: string}>({model, where});
        if (item) {
            await this.ddbDocClient.send(new DeleteCommand({
                TableName: model,
                Key: {id: item.id},
            }));
        }
    }

    async deleteMany({model, where}: {model: string; where: CleanedWhere[]}) {
        const items = await this.findMany<{id: string}>({model, where});

        let deletedCount = 0;

        for (let i = 0; i < items.length; i += 100) {
            const batch = items.slice(i, i + 100);

            if (batch.length === 0) {
                continue;
            }

            await this.ddbDocClient.send(new TransactWriteCommand({
                TransactItems: batch.map(item => ({
                    Delete: {
                        TableName: model,
                        Key: {id: item.id},
                    },
                })),
            }));

            deletedCount += batch.length;
        }

        return deletedCount;
    }

    async findOne<T>({model, where}: {model: string; where: CleanedWhere[]; select?: string[]}) {
        const idCondition = where.find(w => w.field === 'id');
        if (idCondition) {
            const {Item} = await this.ddbDocClient.send(new GetCommand({
                TableName: model,
                Key: {id: idCondition.value},
            }));
            return Item as T ?? null;
        }

        // fallback
        const [result] = await this.findMany({model, where, limit: 1});
        return result as T ?? null;
    }

    async findMany<T>({model, where, limit, sortBy, offset = 0}: {model: string; where?: CleanedWhere[]; limit?: number; sortBy?: {field: string; direction: 'asc' | 'desc'}; offset?: number}) {
        logger.warn('Expensive Operation `findMany`', {model, where, limit, sortBy, offset});
        const {
            FilterExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            unsupportedConditions,
        } = buildFilterExpression(where);
        const postFilter = filter(unsupportedConditions);

        const all = [];
        let LastEvaluatedKey = undefined;

        const shouldLimit = limit && !sortBy;
        do {
            const out: ScanCommandOutput = await this.ddbDocClient.send(new ScanCommand({
                TableName: model,
                Limit: shouldLimit ? limit + offset - all.length : undefined,
                FilterExpression,
                ExpressionAttributeNames,
                ExpressionAttributeValues,
                ExclusiveStartKey: LastEvaluatedKey,
            }));
            all.push(...(out.Items ?? []).filter(postFilter));
            LastEvaluatedKey = out.LastEvaluatedKey ?? undefined;
        } while (LastEvaluatedKey && (!shouldLimit || all.length < limit + offset));

        const result = all
            .toSpliced(0, offset);
        if (sortBy) {
            result.sort(sorter(sortBy.field, sortBy.direction));
        }
        return result as T[];
    }

    async count({model, where}: {model: string; where?: CleanedWhere[]}) {
        logger.warn('Expensive Operation `count`', {model, where});
        const {
            FilterExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            unsupportedConditions,
        } = buildFilterExpression(where);

        if (unsupportedConditions.length > 0) {
            throw new Error(`Unsupported conditions when running a count: ${JSON.stringify(unsupportedConditions)}`);
        }
        const command = new ScanCommand({
            TableName: model,
            FilterExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            Select: 'COUNT',
        });

        const {Count = 0} = await this.ddbDocClient.send(command);
        return Count;
    }
}

function buildFilterExpression(where?: CleanedWhere[]) {
    if (!where || where.length === 0) {
        return {
            FilterExpression: undefined,
            ExpressionAttributeNames: undefined,
            ExpressionAttributeValues: undefined,
            unsupportedConditions: [],
        };
    }

    const unsupportedConditions: CleanedWhere[] = [];
    const filterParts: string[] = [];
    const ExpressionAttributeNames: Record<string, string> = {};
    const ExpressionAttributeValues: Record<string, unknown> = {};
    let valueCounter = 0; // Counter for unique value placeholders

    where.forEach((condition, i) => {
        const fieldPlaceholder = `#f${i}`;
        const operator = condition.operator;

        if (comparisonOperatorMap[operator]) {
            // Handle standard comparison operators (=, <>, >, <, >=, <=)
            const valuePlaceholder = `:v${valueCounter++}`;
            filterParts.push(`${fieldPlaceholder} ${comparisonOperatorMap[operator]} ${valuePlaceholder}`);
            ExpressionAttributeNames[fieldPlaceholder] = condition.field; // Add field name now
            ExpressionAttributeValues[valuePlaceholder] = condition.value instanceof Date ? condition.value.toISOString() : condition.value;
        } else if (operator === 'in') {
            if (!Array.isArray(condition.value) || condition.value.length === 0) {
                logger.warn('Skipping IN condition due to invalid value', {field: condition.field, value: condition.value});
                unsupportedConditions.push(condition);
                return;
            }
            ExpressionAttributeNames[fieldPlaceholder] = condition.field; // Add field name now
            const valuePlaceholders: string[] = [];
            condition.value.forEach((val) => {
                const placeholder = `:v${valueCounter++}`;
                ExpressionAttributeValues[placeholder] = val;
                valuePlaceholders.push(placeholder);
            });
            filterParts.push(`${fieldPlaceholder} IN (${valuePlaceholders.join(', ')})`);
        } else if (operator === 'contains') {
            ExpressionAttributeNames[fieldPlaceholder] = condition.field; // Add field name now
            const valuePlaceholder = `:v${valueCounter++}`;
            filterParts.push(`contains (${fieldPlaceholder}, ${valuePlaceholder})`);
            ExpressionAttributeValues[valuePlaceholder] = condition.value;
        } else if (operator === 'starts_with') {
            ExpressionAttributeNames[fieldPlaceholder] = condition.field; // Add field name now
            const valuePlaceholder = `:v${valueCounter++}`;
            filterParts.push(`begins_with (${fieldPlaceholder}, ${valuePlaceholder})`);
            ExpressionAttributeValues[valuePlaceholder] = condition.value;
        } else {
            unsupportedConditions.push(condition);
        }
    });

    // Check if any valid filter parts were generated
    if (filterParts.length === 0) {
        return {
            FilterExpression: undefined,
            ExpressionAttributeNames: undefined,
            ExpressionAttributeValues: undefined,
            unsupportedConditions,
        };
    }

    const FilterExpression = filterParts.join(' AND ');

    return {
        FilterExpression,
        ExpressionAttributeNames: Object.keys(ExpressionAttributeNames).length > 0 ? ExpressionAttributeNames : undefined,
        ExpressionAttributeValues: Object.keys(ExpressionAttributeValues).length > 0 ? ExpressionAttributeValues : undefined,
        unsupportedConditions,
    };
}

const comparisonOperatorMap: Record<string, string> = {
    eq: '=',
    ne: '<>',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
};

function filter(conditions?: CleanedWhere[]) {
    return (item: Record<string, unknown>) => {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        return conditions.every((condition) => {
            const itemValue = item[condition.field];
            const conditionValue = condition.value;
            const operator = condition.operator; // No need for default 'eq' if we assume 'ends_with'

            // Only handle 'ends_with' operator client-side
            if (operator === 'ends_with') {
                // Ensure both values are strings before calling endsWith
                if (typeof itemValue === 'string' && typeof conditionValue === 'string') {
                    return itemValue.endsWith(conditionValue);
                }
                // If types don't match or aren't strings, the condition fails
                return false;
            }

            // If an unexpected operator appears, log a warning and filter out the item
            logger.warn('Unexpected operator during client-side filtering. Expected only \'ends_with\'.', {operator});
            return false;
        });
    };
}

function sorter<T>(field: keyof T, direction: 'asc' | 'desc') {
    return (a: T, b: T) => {
        const fieldA = a[field];
        const fieldB = b[field];

        if (fieldA === undefined || fieldA === null) {
            return direction === 'asc' ? -1 : 1;
        }
        if (fieldB === undefined || fieldB === null) {
            return direction === 'asc' ? 1 : -1;
        }

        if (direction === 'asc') {
            return fieldA < fieldB ? -1 : fieldA > fieldB ? 1 : 0;
        } else {
            return fieldA > fieldB ? -1 : fieldA < fieldB ? 1 : 0;
        }
    };
}
