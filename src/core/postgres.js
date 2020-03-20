import { Pool, Client } from "pg";
import config from "core/config";

const pool = new Pool(config.postgres);

export default pool;
