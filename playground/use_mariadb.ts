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
    console.log(rows);

    const slots: Array<Slot> = await conn.query('SELECT * FROM slots');
    console.log(slots);
    console.log(slots[0].state === SlotProcessingState.Added);

    const res = await conn.query('INSERT INTO slots (slot, state) VALUES (?, ?)', [Date.now(), SlotProcessingState.Added]);
    console.log(res);

    // transaction sample
    // https://mariadb.com/docs/skysql-previous-release/connect/programming-languages/nodejs/promise/transactions/
    await conn.beginTransaction();
    try {
      const now = Date.now();
      await conn.query('INSERT INTO slots (slot, state) VALUES (?, ?)', [now+0, SlotProcessingState.Added]);
      await conn.query('INSERT INTO slots (slot, state) VALUES (?, ?)', [now+1, SlotProcessingState.Added]);
      await conn.query('INSERT INTO slots (slot, state) VALUES (?, ?)', [now+2, SlotProcessingState.Added]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.log(err);
    }

    await conn.beginTransaction();
    try {
      const now = Date.now();
      const data = [
        [now+3, SlotProcessingState.Added],
        [now+4, SlotProcessingState.Added],
        [now+5, SlotProcessingState.Added],
      ];
      await conn.batch('INSERT INTO slots (slot, state) VALUES (?, ?)', data);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.log(err);
    }
  } catch (err) {
    throw err;
  } finally {
    conn?.end();
  }

  await pool.end();
}

main();