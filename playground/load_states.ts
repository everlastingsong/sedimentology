import mariadb from "mariadb";
import fs from "fs";
import invariant from "tiny-invariant";

async function main() {
  // usage: ts-node load_deployment.ts txid order signature payer <binary.so>

  const database: string = process.argv[2];
  const date: number = Number(process.argv[3]);
  const slot: number = Number(process.argv[4]);
  const program_data_blobfile: string = process.argv[5];
  const account_data_blocfile: string = process.argv[6];
  const program_data = fs.readFileSync(program_data_blobfile);
  const account_data = fs.readFileSync(account_data_blocfile);

  const mariadbHost = "localhost";
  const mariadbPort = 3306;
  const mariadbUser = "root";
  const mariadbPassword = "password";
  const mariadbDatabase = database; //"whirlpool";
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

  // insert into deployments
  await db.query(
    "INSERT INTO states VALUES(?, ?, BINARY(?), BINARY(?))",
    [date, slot, program_data, account_data]
  );

  await db.commit();

  await db.end();
  await pool.end();
}

main();
