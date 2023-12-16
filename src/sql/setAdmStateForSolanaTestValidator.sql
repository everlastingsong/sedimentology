-- Just for solana-test-validator
-- slot 0 and slot 1 have no transactions, so we start at slot 2 (note: VALUES (1, 1) is valid for this purpose)
INSERT INTO admState (latestBlockSlot, latestBlockHeight, checkpointBlockSlot, checkpointBlockHeight) VALUES (1, 1, 1, 1);
