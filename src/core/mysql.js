import mysql from "mysql2";
import config from "core/config";

const pool = mysql.createPool(config.mysql);

const db = {};

db.query = (q, data) => {
  return new Promise((resolve, reject) => {
    pool.query(q, data, (err, res) => {
      err ? reject(err) : resolve(res);
    });
  });
};
export default db;
