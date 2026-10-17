import Database from "better-sqlite3";
import path from "path";
import { log } from "../../logger.js";
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "database.db");
const db = new Database(DB_PATH, { timeout: 5000 });
function migrate() {
    log("info", "Running migrations", { path: DB_PATH });
    db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    const customersCount = db.prepare(`SELECT COUNT(*) as count FROM customers`).get().count;
    if (customersCount === 0) {
        db.exec(`
      INSERT INTO customers (name, email) VALUES
        ('Alice', 'alice@gmail.com'),
        ('Bob',   'bob@gmail.com'),
        ('Carol', 'carol@gmail.com')
    `);
        log("info", "Seeded customers");
    }
    // ── products ──────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT    NOT NULL,
      price    INTEGER NOT NULL,
      stock    INTEGER DEFAULT 0,
      category TEXT
    )
  `);
    const productsCount = db.prepare(`SELECT COUNT(*) as count FROM products`).get().count;
    if (productsCount === 0) {
        db.exec(`
      INSERT INTO products (name, price, stock, category) VALUES
        ('Laptop',   1200, 10,  'Electronics'),
        ('Phone',    800,  25,  'Electronics'),
        ('Mouse',    25,   100, 'Accessories'),
        ('Keyboard', 100,  50,  'Accessories'),
        ('Monitor',  400,  15,  'Electronics')
    `);
        log("info", "Seeded products");
    }
    // ── orders ────────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product     TEXT    NOT NULL,
      amount      INTEGER NOT NULL,
      status      TEXT    DEFAULT 'pending',
      created_at  TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
    const ordersCount = db.prepare(`SELECT COUNT(*) as count FROM orders`).get().count;
    if (ordersCount === 0) {
        const customers = db
            .prepare(`SELECT id FROM customers ORDER BY id`)
            .all();
        if (customers.length >= 3) {
            const [c1, c2, c3] = customers;
            const ins = db.prepare(`INSERT INTO orders (customer_id, product, amount, status) VALUES (?, ?, ?, ?)`);
            ins.run(c1.id, "Laptop", 1200, "completed");
            ins.run(c1.id, "Mouse", 25, "completed");
            ins.run(c2.id, "Phone", 800, "pending");
            ins.run(c2.id, "Keyboard", 100, "completed");
            ins.run(c3.id, "Monitor", 400, "cancelled");
            log("info", "Seeded orders");
        }
    }
    // ── transactions ──────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_id    INTEGER NOT NULL,
      amount      INTEGER NOT NULL,
      type        TEXT CHECK(type IN ('credit', 'debit')),
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (order_id)    REFERENCES orders(id)
    )
  `);
    const txCount = db.prepare(`SELECT COUNT(*) as count FROM transactions`).get().count;
    if (txCount === 0) {
        const customers = db
            .prepare(`SELECT id FROM customers ORDER BY id`)
            .all();
        const orders = db
            .prepare(`SELECT id FROM orders ORDER BY id`)
            .all();
        if (customers.length >= 3 && orders.length >= 5) {
            const [c1, c2, c3] = customers;
            const [o1, o2, o3, o4, o5] = orders;
            const ins = db.prepare(`INSERT INTO transactions (customer_id, order_id, amount, type) VALUES (?, ?, ?, ?)`);
            ins.run(c1.id, o1.id, 1200, "debit");
            ins.run(c1.id, o2.id, 25, "debit");
            ins.run(c2.id, o3.id, 800, "debit");
            ins.run(c2.id, o4.id, 100, "debit");
            ins.run(c3.id, o5.id, 400, "debit");
            log("info", "Seeded transactions");
        }
    }
    log("info", "Migrations complete");
    db.close();
}
migrate();
