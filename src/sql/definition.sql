/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
SET NAMES utf8mb4;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE='NO_AUTO_VALUE_ON_ZERO', SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


--
-- TABLE
--
CREATE TABLE `admState` (
  `latestBlockSlot` bigint(11) unsigned NOT NULL,
  `latestBlockHeight` bigint(11) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `admQueuedSlots` (
  `slot` bigint(11) unsigned NOT NULL,
  `blockHeight` bigint(11) unsigned NOT NULL,
  `isBackfillSlot` tinyint(1) unsigned NOT NULL,
  PRIMARY KEY (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `admBackfillSlots` (
  `slot` bigint(11) unsigned NOT NULL,
  `blockHeight` bigint(11) unsigned NOT NULL,
  PRIMARY KEY (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `slots` (
  `slot` bigint(11) unsigned NOT NULL,
  `blockHeight` bigint(11) unsigned NOT NULL,
  `blockTime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `txs` (
  `txid` bigint(11) unsigned NOT NULL,
  `signature` varchar(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payer` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `pubkeys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pubkey` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pubkey` (`pubkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `balances` (
  `txid` bigint(11) unsigned NOT NULL,
  `account` int(11) unsigned NOT NULL,
  `pre` bigint(11) unsigned NOT NULL,
  `post` bigint(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsAdminIncreaseLiquidity` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidity` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCloseBundledPosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataBundleIndex` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyBundledPosition` int(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleAuthority` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsClosePosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCollectFees` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCollectProtocolFees` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTokenDestinationA` int(11) unsigned NOT NULL,
  `keyTokenDestinationB` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCollectReward` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyRewardOwnerAccount` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsDecreaseLiquidity` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidityAmount` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataTokenAmountMinA` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataTokenAmountMinB` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsDeletePositionBundle` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleMint` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleOwner` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsIncreaseLiquidity` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidityAmount` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataTokenAmountMaxA` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataTokenAmountMaxB` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeConfig` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataDefaultProtocolFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataFeeAuthority` int(11) unsigned NOT NULL COMMENT 'pubkey',
  `dataCollectProtocolFeesAuthority` int(11) unsigned NOT NULL COMMENT 'pubkey',
  `dataRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL COMMENT 'pubkey',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeFeeTier` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickSpacing` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataDefaultFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeTier` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializePool` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickSpacing` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataInitialSqrtPrice` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyFeeTier` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializePositionBundle` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleMint` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleOwner` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializePositionBundleWithMetadata` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleMint` int(11) unsigned NOT NULL,
  `keyPositionBundleMetadata` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleOwner` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyMetadataUpdateAuth` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  `keyMetadataProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeReward` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardMint` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeTickArray` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataStartTickIndex` int(11) NOT NULL COMMENT 'i32',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyTickArray` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsOpenBundledPosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataBundleIndex` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataTickLowerIndex` int(11) NOT NULL COMMENT 'i32',
  `dataTickUpperIndex` int(11) NOT NULL COMMENT 'i32',
  `keyBundledPosition` int(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsOpenPosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickLowerIndex` int(11) NOT NULL COMMENT 'i32',
  `dataTickUpperIndex` int(11) NOT NULL COMMENT 'i32',
  `keyFunder` int(11) unsigned NOT NULL,
  `keyOwner` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsOpenPositionWithMetadata` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickLowerIndex` int(11) NOT NULL COMMENT 'i32',
  `dataTickUpperIndex` int(11) NOT NULL COMMENT 'i32',
  `keyFunder` int(11) unsigned NOT NULL,
  `keyOwner` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionMetadataAccount` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  `keyMetadataProgram` int(11) unsigned NOT NULL,
  `keyMetadataUpdateAuth` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetCollectProtocolFeesAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  `keyNewCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetDefaultFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataDefaultFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeTier` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetDefaultProtocolFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataDefaultProtocolFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetFeeAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  `keyNewFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetProtocolFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataProtocolFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetRewardAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetRewardAuthorityBySuperAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetRewardEmissions` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `dataEmissionsPerSecondX64` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetRewardEmissionsSuperAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSwap` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataAmount` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataOtherAmountThreshold` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataSqrtPriceLimit` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataAmountSpecifiedIsInput` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToB` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keyTokenAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyVaultA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyVaultB` int(11) unsigned NOT NULL,
  `keyTickArray0` int(11) unsigned NOT NULL,
  `keyTickArray1` int(11) unsigned NOT NULL,
  `keyTickArray2` int(11) unsigned NOT NULL,
  `keyOracle` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsTwoHopSwap` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataAmount` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataOtherAmountThreshold` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataAmountSpecifiedIsInput` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToBOne` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToBTwo` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataSqrtPriceLimitOne` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataSqrtPriceLimitTwo` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keyTokenAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpoolOne` int(11) unsigned NOT NULL,
  `keyWhirlpoolTwo` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountOneA` int(11) unsigned NOT NULL,
  `keyVaultOneA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountOneB` int(11) unsigned NOT NULL,
  `keyVaultOneB` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountTwoA` int(11) unsigned NOT NULL,
  `keyVaultTwoA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountTwoB` int(11) unsigned NOT NULL,
  `keyVaultTwoB` int(11) unsigned NOT NULL,
  `keyTickArrayOne0` int(11) unsigned NOT NULL,
  `keyTickArrayOne1` int(11) unsigned NOT NULL,
  `keyTickArrayOne2` int(11) unsigned NOT NULL,
  `keyTickArrayTwo0` int(11) unsigned NOT NULL,
  `keyTickArrayTwo1` int(11) unsigned NOT NULL,
  `keyTickArrayTwo2` int(11) unsigned NOT NULL,
  `keyOracleOne` int(11) unsigned NOT NULL,
  `keyOracleTwo` int(11) unsigned NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount2` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount3` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsUpdateFeesAndRewards` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


--
-- PROCEDURE
--
DELIMITER ;;

CREATE PROCEDURE addPubkeyIfNotExists(pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin)
BEGIN
   DECLARE pubkeyId INT;
   SELECT id INTO pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58 COLLATE utf8mb4_bin;
   IF pubkeyId IS NULL THEN
     INSERT INTO pubkeys (pubkey) VALUES (pubkeyBase58) ON DUPLICATE KEY UPDATE id = id;
   END IF;
END;;

DELIMITER ;


--
-- FUNCTION
--
DELIMITER ;;

CREATE FUNCTION fromPubkeyBase58(pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin) RETURNS int(11)
BEGIN
   DECLARE pubkeyId int;
   SELECT id INTO pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58 COLLATE utf8mb4_bin;
   RETURN pubkeyId;
END;;

CREATE FUNCTION toPubkeyBase58(pubkeyId int) RETURNS varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin
BEGIN
   DECLARE pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin;
   SELECT pubkey INTO pubkeyBase58 FROM pubkeys WHERE id = pubkeyId;
   RETURN pubkeyBase58;
END;;

DELIMITER ;


/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
