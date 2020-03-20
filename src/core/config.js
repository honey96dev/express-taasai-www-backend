require("dotenv").config();

const server = {
  isDev: false,
  port: process.env.HTTP_PORT,
  sslPort: process.env.HTTPS_PORT,
  baseUrl: process.env.BASE_URL,
  name: "hrgulf.org",
  description: "Portal in hrgulf.org",
  author: "Zhenlong J.",
  secret: "hrgulf@@",
  sslKey: "./sslcert/server.key",
  sslCert: "./sslcert/1e720c418ffe9875.crt",
  sslCA: "./sslcert/gd_bundle-g2-g1.crt",
  environment: process.env.NODE_ENV,
  assetsDir: process.env.ASSETS_DIR,
};
const mysql = {
  connectionLimit: 10,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};
const postgres = {
  connectionLimit: 10,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  timeout: 60000,
};
const session = {
  name: "fleet.taasai.com",
  key: "fleet.taasai.com",
  secret: "fleet.taasai.com@@",
};
const dbTblName = {
  users: "fleets",
  operators: "operators",
  drivers: "drivers",
  vehicleTypes: "vehicle_types",
  rides: "rides",
  fareDivisions: "fare_divisions",

  resetPasswordTokens: "reset_password_tokens",
};

const smtp = {
  // service: 'gmail',
  host: 'smtp.office365.com',
  secureConnection: true,
  port: 587,
  // secure: true,
  user: 'pm@eliteresources.co',
  pass: 'Theelite6*',
  limit: {
    receipt: 2999,
    message: 19,
  },
};

export {
  server,
  mysql,
  session,
  dbTblName,
  smtp,
}
export default {
  server,
  mysql,
  postgres,
  session,
  dbTblName,
  smtp,
}
