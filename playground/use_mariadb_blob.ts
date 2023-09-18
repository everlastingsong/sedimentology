import mariadb from 'mariadb';
import { strToU8, strFromU8, gzipSync, gunzipSync } from "fflate";

// MEDIUMBLOB は 3 バイトで表せる長さまで, LONGBLOB は 4 バイトで表せる長さまで格納できる
// ストレージ容量はどちらも 3+L または 4+L で要するに 1 バイトの差しかない。
// 圧縮後に 3 バイトの範囲を超える長さになることは稀だと思うが、1バイトのためにエラーリスクを増やしたくないので LONGBLOB を使うのが良いと思う。
// https://dev.mysql.com/doc/refman/8.0/ja/storage-requirements.html

// max_allowed_packet というパラメータが実行できるSQLのサイズを決めている
// BLOB が大きい場合は大きくする必要がある。(SQLとして送られているから (テキストエンコードの影響もあるはず))
// Docker の mariadb のデフォルトは 16MB だった。
// 圧縮しても 16MB 近くになるということはまずないのでいったんそのまま。エラーがでたら拡大する。
// セッションごとに調整できる様子。
// https://www.sakatakoichi.com/entry/20100608/1276074246

type BlobTable = {
  id: number;
  data: Buffer; // The Buffer class is a subclass of JavaScript's Uint8Array class
  compressed: Buffer;
};

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

    const repeat = 10;

    const data = strToU8(`hello world at ${Date.now()}`.repeat(repeat));
    const buffer = Buffer.from(data); // mariadb(mysql) prefer Buffer than Uint8Array...
    const compressed = Buffer.from(gzipSync(data));

    // BINARY function is important!!
    const res = await conn.query('INSERT INTO blobtable (data, compressed) VALUES (BINARY(?), BINARY(?))', [buffer, compressed]);
    console.log(res);

    const rows: Array<BlobTable> = await conn.query('SELECT * FROM blobtable');
    for (const row of rows) {
      console.log("row id", row.id);
      console.log("row.data", row.data);
      console.log("row.compressed", row.compressed);
      console.log("strFromU8(data)", strFromU8(row.data));
      console.log("strFromU8(gunzip(compressed))", strFromU8(gunzipSync(row.compressed)));
    }
  } catch (err) {
    throw err;
  } finally {
    conn?.end();
  }

  await pool.end();
}

main();