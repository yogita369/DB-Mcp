import { config } from "dotenv";
config();
import { getMongoDb, closeMongoDb } from "./db.js";
import { log } from "../../logger.js";
async function seed() {
    const db = await getMongoDb();
    log("info", "Clearing collections");
    await db.collection("customers").deleteMany({});
    await db.collection("orders").deleteMany({});
    await db.collection("products").deleteMany({});
    await db.collection("transactions").deleteMany({});
    log("info", "Seeding customers");
    await db.collection("customers").insertMany([
        { _id: 4, name: "Alice", email: "alice@gmail.com", revenue: 5000 },
        { _id: 5, name: "Bob", email: "bob@gmail.com", revenue: 7000 },
        { _id: 6, name: "Charlie", email: "charlie@gmail.com", revenue: 3000 },
    ]);
    log("info", "Seeding products");
    await db.collection("products").insertMany([
        { _id: 1, name: "Laptop", price: 1200, stock: 10, category: "Electronics" },
        { _id: 2, name: "Phone", price: 800, stock: 25, category: "Electronics" },
        { _id: 3, name: "Mouse", price: 25, stock: 100, category: "Accessories" },
        { _id: 4, name: "Keyboard", price: 100, stock: 50, category: "Accessories" },
        { _id: 5, name: "Monitor", price: 400, stock: 15, category: "Electronics" },
    ]);
    log("info", "Seeding orders");
    await db.collection("orders").insertMany([
        { _id: 1, customer_id: 4, product: "Laptop", amount: 1200, status: "completed" },
        { _id: 2, customer_id: 4, product: "Mouse", amount: 25, status: "completed" },
        { _id: 3, customer_id: 5, product: "Phone", amount: 800, status: "pending" },
        { _id: 4, customer_id: 5, product: "Keyboard", amount: 100, status: "completed" },
        { _id: 5, customer_id: 6, product: "Monitor", amount: 400, status: "cancelled" },
    ]);
    log("info", "Seeding transactions");
    await db.collection("transactions").insertMany([
        { _id: 1, customer_id: 4, order_id: 1, amount: 1200, type: "debit" },
        { _id: 2, customer_id: 4, order_id: 2, amount: 25, type: "debit" },
        { _id: 3, customer_id: 5, order_id: 3, amount: 800, type: "debit" },
        { _id: 4, customer_id: 5, order_id: 4, amount: 100, type: "debit" },
        { _id: 5, customer_id: 6, order_id: 5, amount: 400, type: "debit" },
    ]);
    log("info", "Seed complete");
    await closeMongoDb();
    process.exit(0);
}
seed().catch((err) => {
    log("error", "Seed failed", {
        error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    process.exit(1);
});
