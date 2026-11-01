import {CreateTableCommand, DeleteTableCommand, DynamoDBClient, ListTablesCommand} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import fs from 'fs';
import {afterAll, beforeAll} from 'vitest';
import YAML from 'yaml';

beforeAll(async () => {
    await createTables(ddbTables);
});

afterAll(async () => {
    await deleteTables(ddbTables);
});

const serverless = parsedServerlessFile('./src/modules/auth/resources.yml');

const ddbTables = Object.values(serverless.resources.Resources)
    .filter(r => r.Type === 'AWS::DynamoDB::Table')
    .map(r => r.Properties);

async function createTables(tables) {
    const { TableNames: existingTables } = await ddb.send(new ListTablesCommand({}));

    for (const table of tables) {
        if (table.StreamSpecification?.StreamViewType) {
            table.StreamSpecification.StreamEnabled = table.StreamSpecification.StreamEnabled ?? true;
        }

        if (existingTables.includes(table.TableName)) {
            await ddb.send(new DeleteTableCommand({TableName: table.TableName}));
        }
        await ddb.send(new CreateTableCommand(table));
    }
}

async function deleteTables(tables) {
    const { TableNames: existingTables } = await ddb.send(new ListTablesCommand({}));

    for (const table of tables) {
        if (existingTables.includes(table.TableName)) {
            await ddb.send(new DeleteTableCommand({TableName: table.TableName}));
        }
    }
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
    endpoint: 'http://localhost:8080',
}));

function parsedServerlessFile(filePath) {
    return YAML.parse(fs.readFileSync(filePath, 'utf8'), {
        customTags: [{
            tag: '!ImportValue',
            resolve: (str) => {
                return {'ImportValue': str};
            },
            default: true,
        }, {
            tag: '!Join',
            collection: 'seq',
            resolve: (str) => {
                return {'Join': str.toJSON()};
            },
            default: true,
        }, {
            tag: '!Ref',
            resolve: (str) => {
                return {'Ref': str};
            },
            default: true,
        }, {
            tag: '!GetAtt',
            resolve: (str) => {
                return {'GetAtt': str.split('.')};
            },
            default: true,
        }],
    });
}
