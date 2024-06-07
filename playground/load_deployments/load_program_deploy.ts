import mariadb from "mariadb";
import fs from "fs";
import invariant from "tiny-invariant";

async function main() {
  // usage: ts-node load_program_deploy.ts txid order signature payer <binary.so>

  const txid: string = process.argv[2];
  const order: number = Number(process.argv[3]);
  const signature: string = process.argv[4];
  const payer: string = process.argv[5];
  const binary: string = process.argv[6];
  const binaryBuffer = fs.readFileSync(binary);

  const txidBigInt = BigInt(txid);

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

  // insert into pubkeys
  const prepared = await db.prepare("CALL addPubkeyIfNotExists(?)");
  const touchedPubkeys = [payer];
  for (const pubkey of touchedPubkeys) {
    await prepared.execute([pubkey]);
  }
  prepared.close();

  await db.beginTransaction();

  // insert into txs
  await db.query(
    "INSERT INTO txs (txid, signature, payer) VALUES (?, ?, fromPubkeyBase58(?))",
    [txidBigInt, signature, payer]
  );

  // insert into deployments
  await db.query(
    "INSERT INTO ixsProgramDeploy VALUES(?, ?, TO_BASE64(BINARY(?)))",
    [txidBigInt, order, binaryBuffer]
  );

  await db.commit();

  await db.end();
  await pool.end();
}

main();
