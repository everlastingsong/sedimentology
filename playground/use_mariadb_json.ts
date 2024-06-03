import mariadb from 'mariadb';

enum SlotProcessingState {
  Added = 0,
  Fetched = 1,
}

type Slot = {
  slot: number;
  block_height: number | null;
  block_timestamp: number | null;
  state: SlotProcessingState;
}

async function main() {
  const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'whirlpool2',
    connectionLimit: 5,
    bigIntAsNumber: true, // number is safe
  });
  
  let conn: mariadb.PoolConnection;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT 1 as val');
    console.log(rows);

    // remainingAccountsInfo
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [1, JSON.stringify([[0, 5], [1, 4], [2, 15]])]);
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [2, JSON.stringify([[0, 9]])]);
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [3, JSON.stringify([])]);

    try {
      await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [4, JSON.stringify([[]])]);
    } catch(e) { console.error(e); }
    try {
      await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [5, JSON.stringify([[1]])]);
    } catch(e) { console.error(e); }
    try {
      await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeU8U8TupleArray(?))', [5, JSON.stringify([[3,3,3]])]);
    } catch(e) { console.error(e); }
    
    // remainingAccounts
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeBase58PubkeyArray(?))', [11, JSON.stringify([
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "11111111111111111111111111111111",
      "SysvarRent111111111111111111111111111111111",
      "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
    ])]);
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeBase58PubkeyArray(?))', [12, JSON.stringify([
      "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
      "2ADGF2ksvBu8pArqmYC26qXF97HBrGWwckhMGjCj6QEY",
    ])]);
    await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeBase58PubkeyArray(?))', [13, JSON.stringify([])]);
    // error test
    try {
      await conn.query('INSERT INTO varbinary_table (id, data) VALUES (?, encodeBase58PubkeyArray(?))', [14, JSON.stringify(["2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"])]);
    } catch(e) { console.error(e); }


  } catch (err) {
    throw err;
  } finally {
    conn?.end();
  }

  await pool.end();
}

main();