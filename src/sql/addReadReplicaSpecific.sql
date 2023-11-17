--
-- INDEX
--
-- admState
-- admQueuedSlots
-- admBackfillSlots

-- slots
CREATE UNIQUE INDEX blockHeight ON slots (blockHeight);
CREATE INDEX blockTime ON slots (blockTime);

-- txs
CREATE UNIQUE INDEX signature ON txs (signature);
CREATE INDEX payer ON txs (payer);

-- pubkeys
-- balances

-- ixsAdminIncreaseLiquidity
CREATE INDEX keyWhirlpool ON ixsAdminIncreaseLiquidity (keyWhirlpool);

-- ixsCloseBundledPosition
CREATE INDEX keyBundledPosition ON ixsCloseBundledPosition (keyBundledPosition);
CREATE INDEX keyPositionBundle ON ixsCloseBundledPosition (keyPositionBundle);
CREATE INDEX keyPositionBundleAuthority ON ixsCloseBundledPosition (keyPositionBundleAuthority);

-- ixsClosePosition
CREATE INDEX keyPositionAuthority ON ixsClosePosition (keyPositionAuthority);
CREATE INDEX keyPosition ON ixsClosePosition (keyPosition);
CREATE INDEX keyPositionMint ON ixsClosePosition (keyPositionMint);

-- ixsCollectFees
CREATE INDEX keyWhirlpool ON ixsCollectFees (keyWhirlpool);
CREATE INDEX keyPositionAuthority ON ixsCollectFees (keyPositionAuthority);
CREATE INDEX keyPosition ON ixsCollectFees (keyPosition);

-- ixsCollectProtocolFees
CREATE INDEX keyWhirlpool ON ixsCollectProtocolFees (keyWhirlpool);
CREATE INDEX keyCollectProtocolFeesAuthority ON ixsCollectProtocolFees (keyCollectProtocolFeesAuthority);

-- ixsCollectReward
CREATE INDEX keyWhirlpool ON ixsCollectReward (keyWhirlpool);
CREATE INDEX keyPositionAuthority ON ixsCollectReward (keyPositionAuthority);
CREATE INDEX keyPosition ON ixsCollectReward (keyPosition);

-- ixsDecreaseLiquidity
CREATE INDEX keyWhirlpool ON ixsDecreaseLiquidity (keyWhirlpool);
CREATE INDEX keyPositionAuthority ON ixsDecreaseLiquidity (keyPositionAuthority);
CREATE INDEX keyPosition ON ixsDecreaseLiquidity (keyPosition);
CREATE INDEX keyTickArrayLower ON ixsDecreaseLiquidity (keyTickArrayLower);
CREATE INDEX keyTickArrayUpper ON ixsDecreaseLiquidity (keyTickArrayUpper);

-- ixsDeletePositionBundle
CREATE INDEX keyPositionBundle ON ixsDeletePositionBundle (keyPositionBundle);
CREATE INDEX keyPositionBundleMint ON ixsDeletePositionBundle (keyPositionBundleMint);
CREATE INDEX keyPositionBundleOwner ON ixsDeletePositionBundle (keyPositionBundleOwner);

-- ixsIncreaseLiquidity
CREATE INDEX keyWhirlpool ON ixsIncreaseLiquidity (keyWhirlpool);
CREATE INDEX keyPositionAuthority ON ixsIncreaseLiquidity (keyPositionAuthority);
CREATE INDEX keyPosition ON ixsIncreaseLiquidity (keyPosition);
CREATE INDEX keyTickArrayLower ON ixsIncreaseLiquidity (keyTickArrayLower);
CREATE INDEX keyTickArrayUpper ON ixsIncreaseLiquidity (keyTickArrayUpper);

-- ixsInitializeConfig
-- ixsInitializeFeeTier

-- ixsInitializePool
CREATE INDEX keyWhirlpoolsConfig ON ixsInitializePool (keyWhirlpoolsConfig);
CREATE INDEX keyTokenMintA ON ixsInitializePool (keyTokenMintA);
CREATE INDEX keyTokenMintB ON ixsInitializePool (keyTokenMintB);
CREATE INDEX keyWhirlpool ON ixsInitializePool (keyWhirlpool);
CREATE INDEX keyFeeTier ON ixsInitializePool (keyFeeTier);

-- ixsInitializePositionBundle
CREATE INDEX keyPositionBundle ON ixsInitializePositionBundle (keyPositionBundle);
CREATE INDEX keyPositionBundleMint ON ixsInitializePositionBundle (keyPositionBundleMint);
CREATE INDEX keyPositionBundleOwner ON ixsInitializePositionBundle (keyPositionBundleOwner);

-- ixsInitializePositionBundleWithMetadata
CREATE INDEX keyPositionBundle ON ixsInitializePositionBundleWithMetadata (keyPositionBundle);
CREATE INDEX keyPositionBundleMint ON ixsInitializePositionBundleWithMetadata (keyPositionBundleMint);
CREATE INDEX keyPositionBundleOwner ON ixsInitializePositionBundleWithMetadata (keyPositionBundleOwner);

-- ixsInitializeReward
CREATE INDEX keyWhirlpool ON ixsInitializeReward (keyWhirlpool);
CREATE INDEX keyRewardMint ON ixsInitializeReward (keyRewardMint);

-- ixsInitializeTickArray
CREATE INDEX keyWhirlpool ON ixsInitializeTickArray (keyWhirlpool);
CREATE INDEX keyTickArray ON ixsInitializeTickArray (keyTickArray);

-- ixsOpenBundledPosition
CREATE INDEX keyBundledPosition ON ixsOpenBundledPosition (keyBundledPosition);
CREATE INDEX keyPositionBundle ON ixsOpenBundledPosition (keyPositionBundle);
CREATE INDEX keyPositionBundleAuthority ON ixsOpenBundledPosition (keyPositionBundleAuthority);
CREATE INDEX keyWhirlpool ON ixsOpenBundledPosition (keyWhirlpool);

-- ixsOpenPosition
CREATE INDEX keyOwner ON ixsOpenPosition (keyOwner);
CREATE INDEX keyPosition ON ixsOpenPosition (keyPosition);
CREATE INDEX keyPositionMint ON ixsOpenPosition (keyPositionMint);
CREATE INDEX keyWhirlpool ON ixsOpenPosition (keyWhirlpool);

-- ixsOpenPositionWithMetadata
CREATE INDEX keyOwner ON ixsOpenPositionWithMetadata (keyOwner);
CREATE INDEX keyPosition ON ixsOpenPositionWithMetadata (keyPosition);
CREATE INDEX keyPositionMint ON ixsOpenPositionWithMetadata (keyPositionMint);
CREATE INDEX keyWhirlpool ON ixsOpenPositionWithMetadata (keyWhirlpool);

-- ixsSetCollectProtocolFeesAuthority
-- ixsSetDefaultFeeRate
-- ixsSetDefaultProtocolFeeRate
-- ixsSetFeeAuthority
-- ixsSetFeeRate
-- ixsSetProtocolFeeRate
-- ixsSetRewardAuthority
-- ixsSetRewardAuthorityBySuperAuthority

-- ixsSetRewardEmissions
CREATE INDEX keyWhirlpool ON ixsSetRewardEmissions (keyWhirlpool);

-- ixsSetRewardEmissionsSuperAuthority

-- ixsSwap
CREATE INDEX keyTokenAuthority ON ixsSwap (keyTokenAuthority);
CREATE INDEX keyWhirlpool ON ixsSwap (keyWhirlpool);

-- ixsTwoHopSwap
CREATE INDEX keyTokenAuthority ON ixsTwoHopSwap (keyTokenAuthority);
CREATE INDEX keyWhirlpoolOne ON ixsTwoHopSwap (keyWhirlpoolOne);
CREATE INDEX keyWhirlpoolTwo ON ixsTwoHopSwap (keyWhirlpoolTwo);

-- ixsUpdateFeesAndRewards
CREATE INDEX keyWhirlpool ON ixsUpdateFeesAndRewards (keyWhirlpool);
CREATE INDEX keyPosition ON ixsUpdateFeesAndRewards (keyPosition);

--
-- FUNCTION
--
DELIMITER ;;

CREATE FUNCTION toSignatureBase58(txidBigint bigint) RETURNS varchar(96) CHARSET utf8mb4 COLLATE utf8mb4_bin
DETERMINISTIC
BEGIN
   DECLARE signatureBase58 varchar(96) CHARSET utf8mb4 COLLATE utf8mb4_bin;
   SELECT signature INTO signatureBase58 FROM txs WHERE txid = txidBigint;
   RETURN signatureBase58;
END;;

CREATE FUNCTION fromSignatureBase58(signatureBase58 varchar(96) CHARSET utf8mb4 COLLATE utf8mb4_bin) RETURNS bigint(11)
DETERMINISTIC
BEGIN
   DECLARE txidBigint bigint;
   SELECT txid INTO txidBigint FROM txs WHERE signature = signatureBase58;
   RETURN txidBigint;
END;;

CREATE FUNCTION toSlot(txid bigint) RETURNS bigint(11)
DETERMINISTIC
BEGIN
   RETURN txid >> 24;
END;;

CREATE FUNCTION fromSlot(slot bigint) RETURNS bigint(11)
DETERMINISTIC
BEGIN
   RETURN slot << 24;
END;;

-- shorthand
CREATE FUNCTION toSignature(txid bigint) RETURNS varchar(96) CHARSET utf8mb4 COLLATE utf8mb4_bin
DETERMINISTIC
BEGIN
   RETURN toSignatureBase58(txid);
END;;

CREATE FUNCTION fromSignature(signature varchar(96) CHARSET utf8mb4 COLLATE utf8mb4_bin) RETURNS bigint(11)
DETERMINISTIC
BEGIN
   RETURN fromSignatureBase58(signature);
END;;

CREATE FUNCTION toPubkey(pubkeyId int) RETURNS varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin
DETERMINISTIC
BEGIN
   RETURN toPubkeyBase58(pubkeyId);
END;;

CREATE FUNCTION fromPubkey(pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin) RETURNS int(11)
DETERMINISTIC
BEGIN
   RETURN fromPubkeyBase58(pubkeyBase58);
END;;

DELIMITER ;
