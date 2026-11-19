import dotenv from "dotenv";
import { assertTestDatabase } from "./utils/test-database";

// Never load the development .env for tests.
dotenv.config({ path: ".env.test", quiet: true });
assertTestDatabase(process.env.DATABASE_URL);
