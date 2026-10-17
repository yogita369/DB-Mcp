import { registerListCollections } from "./listCollection.js";
import { registerFindDocuments } from "./findDoc.js";
import { registerInsertDocument } from "./insertDoc.js";
import { registerUpdateDocument } from "./updateDoc.js";
import { registerDeleteDocument } from "./deleteDoc.js";
import { registerExplainDocument } from "./explainDoc.js";
import { registerAggregateQuery } from "./aggregatQuery.js";
import { registerSearchDocuments } from "./searchDoc.js";
export function registerMongoTools(server) {
    registerListCollections(server);
    registerFindDocuments(server);
    registerInsertDocument(server);
    registerUpdateDocument(server);
    registerDeleteDocument(server);
    registerExplainDocument(server);
    registerAggregateQuery(server);
    registerSearchDocuments(server);
}
