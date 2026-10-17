import path from "path";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
export const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "database.db");
export const DB_TYPE = process.env.DB_TYPE ?? "sqlite";
