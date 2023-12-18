import mariadb from "mariadb";
import fs from "fs";
import invariant from "tiny-invariant";

async function main() {
  // usage: ts-node load_state.ts yyyymmdd slot program.gz account.gz

  const yyyymmdd: string = process.argv[2];
  const slot: string = process.argv[3];
  const program: string = process.argv[4];
  const account: string = process.argv[5];
  const programBuffer = fs.readFileSync(program);
  const accountBuffer = fs.readFileSync(account);

  const mariadbHost = "localhost";
  const mariadbPort = 3306;
  const mariadbUser = "root";
  const mariadbPassword = "password";
  const mariadbDatabase = "whirlpool";
  const concurrency = 10;

  const pool = mariadb.createPool({
    host: mariadbHost,
    port: mariadbPort,
    user: mariadbUser,
    password: mariadbPassword,
    database: mariadbDatabase,
    connectionLimit: concurrency + 5, // margin: 5
    bigIntAsNumber: false, // use bigint
  });

  const db = await pool.getConnection();

  await db.beginTransaction();

  // insert into states
  await db.query(
    "INSERT INTO states VALUES(?, ?, BINARY(?), BINARY(?))",
    [yyyymmdd, slot, programBuffer, accountBuffer]
  );

  await db.commit();

  await db.end();
  await pool.end();
}

main();
