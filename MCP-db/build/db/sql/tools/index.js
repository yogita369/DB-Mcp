import { registerExecuteQuery } from "./executeQuery.js";
import { registerGetSchema } from "./GetSchema.js";
import { registerListTables } from "./listTable.js";
import { registerPaginateQuery } from "./paginateQuery.js";
import { registerJoinTables } from "./joinTable.js";
import { registerExportQuery } from "./exportQuery.js";
import { registerSearchRecords } from "./searchRecord.js";
import { registerQueryHistory } from "./queryHistory.js";
import { registerExplainQuery } from "./explainQuery.js";
export function registerSqlTools(server) {
    registerGetSchema(server);
    registerExecuteQuery(server);
    registerListTables(server);
    registerPaginateQuery(server);
    registerJoinTables(server);
    registerExportQuery(server);
    registerSearchRecords(server);
    registerQueryHistory(server);
    registerExplainQuery(server);
}
