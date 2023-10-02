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
    database: 'test',
    connectionLimit: 5,
    bigIntAsNumber: true, // number is safe
  });
  
  let conn: mariadb.PoolConnection;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query('SELECT 1 as val');

    const slots: Array<Slot> = await conn.query('SELECT * FROM slots');

    const exists = await conn.query('SELECT * FROM slots WHERE slot = ?', [217833464]);
    const notExists = await conn.query('SELECT * FROM slots WHERE slot = ?', [217833464 * 1000]);
    const [notExistsItem] = await conn.query('SELECT * FROM slots WHERE slot = ?', [217833464 * 1000]);

    console.log("exists", exists);
    console.log("notExists", notExists);
    console.log("notExistsItem", notExistsItem);

    const count = await conn.query('SELECT COUNT(*) as count FROM slots');
    console.log("count", count);
  } catch (err) {
    throw err;
  } finally {
    conn?.end();
  }

  await pool.end();
}

main();