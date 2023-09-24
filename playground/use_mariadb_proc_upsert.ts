import mariadb from 'mariadb';

// 重複可能性が高い pukey は pubkey (32byte in binary, ~45 bytes in base58) ではなく u32 で保存する。
// u32 の範囲を超えるアカウントはしばらくはできないと思うし、検索性能に影響する。最悪 u64 に変更も可能。
// 4G個のアカウントがあるとしたら、4G * 32byte = 128GB になる。これだけでかなり重荷になる。
// 4G個は現状十分すぎる数値だと思う。

// pubkey to u32 の処理はクライアントサイドでは行わず、DBのストアド・プロシージャで行う。
// 存在しなければ insert して、存在すれば u32 をそのまま返す。

// insert on duplicate update id=id で何もしないことができる
// 挿入済みと確認できたレコードについては LRU で管理してなにもしないようにする
// 上記はいくらでもリランできるのでトランザクションでは管理しない
//
// SQLをシンプルにするために関数を定義しておく (NULLでないかぎり deterministic)
// 見つからない場合は NULL を返す (テーブルに入り込むのは non null 制約で弾く)
/*
delimiter //

CREATE FUNCTION fromPubkeyBase58(pubkeyBase58 VARCHAR(48)) RETURNS INT
BEGIN
   DECLARE pubkeyId INT;
   SELECT id into pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58;
   return pubkeyId;
END
//

CREATE PROCEDURE addPubkeyIfNotExists(pubkeyBase58 VARCHAR(48))
BEGIN
   DECLARE pubkeyId INT;
   SELECT id into pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58;
   IF pubkeyId IS NULL THEN
     INSERT INTO pubkeys (pubkey) VALUES (pubkeyBase58) ON DUPLICATE KEY UPDATE id = id;
   END IF;
END
//

*/

