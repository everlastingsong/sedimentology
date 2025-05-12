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
  `latestBlockHeight` bigint(11) unsigned NOT NULL,
  `checkpointBlockSlot` bigint(11) unsigned NOT NULL,
  `checkpointBlockHeight` bigint(11) unsigned NOT NULL
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
  PRIMARY KEY (`slot`),
  KEY `blockTime` (`blockTime`)
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

CREATE TABLE `decimals` (
  `mint` int(11) unsigned NOT NULL,
  `decimals` tinyint(11) unsigned NOT NULL,
  PRIMARY KEY (`mint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsProgramDeploy` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `programData` longtext NOT NULL,
  PRIMARY KEY (`txid`,`order`)
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

CREATE TABLE `ixsCollectFeesV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCollectProtocolFeesV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTokenDestinationA` int(11) unsigned NOT NULL,
  `keyTokenDestinationB` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsCollectRewardV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyRewardOwnerAccount` int(11) unsigned NOT NULL,
  `keyRewardMint` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  `keyRewardTokenProgram` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsDecreaseLiquidityV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidityAmount` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataTokenAmountMinA` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataTokenAmountMinB` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,  
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsIncreaseLiquidityV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidityAmount` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataTokenAmountMaxA` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataTokenAmountMaxB` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,  
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSwapV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataAmount` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataOtherAmountThreshold` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataSqrtPriceLimit` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataAmountSpecifiedIsInput` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToB` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `keyTokenAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountA` int(11) unsigned NOT NULL,
  `keyVaultA` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountB` int(11) unsigned NOT NULL,
  `keyVaultB` int(11) unsigned NOT NULL,
  `keyTickArray0` int(11) unsigned NOT NULL,
  `keyTickArray1` int(11) unsigned NOT NULL,
  `keyTickArray2` int(11) unsigned NOT NULL,
  `keyOracle` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsTwoHopSwapV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataAmount` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataOtherAmountThreshold` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `dataAmountSpecifiedIsInput` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToBOne` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataAToBTwo` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `dataSqrtPriceLimitOne` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataSqrtPriceLimitTwo` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpoolOne` int(11) unsigned NOT NULL,
  `keyWhirlpoolTwo` int(11) unsigned NOT NULL,
  `keyTokenMintInput` int(11) unsigned NOT NULL,
  `keyTokenMintIntermediate` int(11) unsigned NOT NULL,
  `keyTokenMintOutput` int(11) unsigned NOT NULL,
  `keyTokenProgramInput` int(11) unsigned NOT NULL,
  `keyTokenProgramIntermediate` int(11) unsigned NOT NULL,
  `keyTokenProgramOutput` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountInput` int(11) unsigned NOT NULL,
  `keyVaultOneInput` int(11) unsigned NOT NULL,
  `keyVaultOneIntermediate` int(11) unsigned NOT NULL,
  `keyVaultTwoIntermediate` int(11) unsigned NOT NULL,
  `keyVaultTwoOutput` int(11) unsigned NOT NULL,
  `keyTokenOwnerAccountOutput` int(11) unsigned NOT NULL,
  `keyTokenAuthority` int(11) unsigned NOT NULL,
  `keyTickArrayOne0` int(11) unsigned NOT NULL,
  `keyTickArrayOne1` int(11) unsigned NOT NULL,
  `keyTickArrayOne2` int(11) unsigned NOT NULL,
  `keyTickArrayTwo0` int(11) unsigned NOT NULL,
  `keyTickArrayTwo1` int(11) unsigned NOT NULL,
  `keyTickArrayTwo2` int(11) unsigned NOT NULL,
  `keyOracleOne` int(11) unsigned NOT NULL,
  `keyOracleTwo` int(11) unsigned NOT NULL,
  `keyMemoProgram` int(11) unsigned NOT NULL,
  `remainingAccountsInfo` varbinary(32) NOT NULL,
  `remainingAccountsKeys` varbinary(256) NOT NULL,
  `transferAmount0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt0` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps0` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax0` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt1` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps1` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax1` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferAmount2` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `transferFeeConfigOpt2` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `transferFeeConfigBps2` smallint(6) unsigned NOT NULL COMMENT 'u16',
  `transferFeeConfigMax2` bigint(11) unsigned NOT NULL COMMENT 'u64',
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializePoolV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickSpacing` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataInitialSqrtPrice` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyTokenBadgeA` int(11) unsigned NOT NULL,
  `keyTokenBadgeB` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyFeeTier` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeRewardV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardMint` int(11) unsigned NOT NULL,
  `keyRewardTokenBadge` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  `keyRewardTokenProgram` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetRewardEmissionsV2` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `dataEmissionsPerSecondX64` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeConfigExtension` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpoolsConfigExtension` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeTokenBadge` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpoolsConfigExtension` int(11) unsigned NOT NULL,
  `keyTokenBadgeAuthority` int(11) unsigned NOT NULL,
  `keyTokenMint` int(11) unsigned NOT NULL,
  `keyTokenBadge` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsDeleteTokenBadge` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpoolsConfigExtension` int(11) unsigned NOT NULL,
  `keyTokenBadgeAuthority` int(11) unsigned NOT NULL,
  `keyTokenMint` int(11) unsigned NOT NULL,
  `keyTokenBadge` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetConfigExtensionAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpoolsConfigExtension` int(11) unsigned NOT NULL,
  `keyConfigExtensionAuthority` int(11) unsigned NOT NULL,
  `keyNewConfigExtensionAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsSetTokenBadgeAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpoolsConfigExtension` int(11) unsigned NOT NULL,
  `keyConfigExtensionAuthority` int(11) unsigned NOT NULL,
  `keyNewTokenBadgeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsOpenPositionWithTokenExtensions` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataTickLowerIndex` int(11) NOT NULL COMMENT 'i32',
  `dataTickUpperIndex` int(11) NOT NULL COMMENT 'i32',
  `dataWithTokenMetadataExtension` tinyint(1) unsigned NOT NULL COMMENT 'boolean',
  `keyFunder` int(11) unsigned NOT NULL,
  `keyOwner` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyToken2022Program` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  `keyMetadataUpdateAuth` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsClosePositionWithTokenExtensions` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyToken2022Program` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsLockPosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLockType` JSON NOT NULL COMMENT 'LockType enum',
  `keyFunder` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyLockConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyToken2022Program` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `auxKeyPositionTokenAccountOwner` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsResetPositionRange` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataNewTickLowerIndex` int(11) NOT NULL COMMENT 'i32',
  `dataNewTickUpperIndex` int(11) NOT NULL COMMENT 'i32',
  `keyFunder` int(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsTransferLockedPosition` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionAuthority` int(11) unsigned NOT NULL,
  `keyReceiver` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyPositionMint` int(11) unsigned NOT NULL,
  `keyPositionTokenAccount` int(11) unsigned NOT NULL,
  `keyDestinationTokenAccount` int(11) unsigned NOT NULL,
  `keyLockConfig` int(11) unsigned NOT NULL,
  `keyToken2022Program` int(11) unsigned NOT NULL,
  `auxKeyDestinationTokenAccountOwner` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializeAdaptiveFeeTier` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataFeeTierIndex` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataTickSpacing` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataDefaultBaseFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataFilterPeriod` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataDecayPeriod` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataReductionFactor` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataAdaptiveFeeControlFactor` int(11) unsigned NOT NULL COMMENT 'u32',
  `dataMaxVolatilityAccumulator` int(11) unsigned NOT NULL COMMENT 'u32',
  `dataTickGroupSize` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataMajorSwapThresholdTicks` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `dataInitializePoolAuthority` int(11) unsigned NOT NULL COMMENT 'pubkey',
  `dataDelegatedFeeAuthority` int(11) unsigned NOT NULL COMMENT 'pubkey',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyAdaptiveFeeTier` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `ixsInitializePoolWithAdaptiveFee` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataInitialSqrtPrice` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `dataTradeEnableTimestamp` bigint(11) unsigned NOT NULL COMMENT 'u64',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyTokenMintA` int(11) unsigned NOT NULL,
  `keyTokenMintB` int(11) unsigned NOT NULL,
  `keyTokenBadgeA` int(11) unsigned NOT NULL,
  `keyTokenBadgeB` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyInitializePoolAuthority` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyOracle` int(11) unsigned NOT NULL,
  `keyTokenVaultA` int(11) unsigned NOT NULL,
  `keyTokenVaultB` int(11) unsigned NOT NULL,
  `keyAdaptiveFeeTier` int(11) unsigned NOT NULL,
  `keyTokenProgramA` int(11) unsigned NOT NULL,
  `keyTokenProgramB` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

--
-- PROCEDURE
--
DELIMITER ;;

CREATE OR REPLACE PROCEDURE addPubkeyIfNotExists(pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin)
BEGIN
   DECLARE pubkeyId INT;
   SELECT id INTO pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58 COLLATE utf8mb4_bin;
   IF pubkeyId IS NULL THEN
     INSERT INTO pubkeys (pubkey) VALUES (pubkeyBase58) ON DUPLICATE KEY UPDATE id = id;
   END IF;
END;;

CREATE OR REPLACE PROCEDURE addDecimalsIfNotExists(mintPubkeyId int unsigned, tokenDecimals tinyint unsigned)
BEGIN
   DECLARE foundDecimals TINYINT;
   SELECT decimals INTO foundDecimals FROM decimals WHERE mint = mintPubkeyId;
   IF foundDecimals IS NULL THEN
     INSERT INTO decimals (mint, decimals) VALUES (mintPubkeyId, tokenDecimals) ON DUPLICATE KEY UPDATE mint = mint;
   END IF;
END;;

CREATE OR REPLACE PROCEDURE advanceCheckpoint()
BEGIN
   DECLARE currentCheckpointBlockSlot BIGINT UNSIGNED;
   DECLARE minFetchingSlot BIGINT UNSIGNED;

   DECLARE nextCheckpointBlockSlot BIGINT UNSIGNED;
   DECLARE nextCheckpointBlockHeight BIGINT UNSIGNED;

   SELECT checkpointBlockSlot INTO currentCheckpointBlockSlot FROM admState;

   SELECT IFNULL(MIN(slot), 18446744073709551615) INTO minFetchingSlot FROM admQueuedSlots WHERE isBackfillSlot IS FALSE;

   SELECT IFNULL(MAX(slot), currentCheckpointBlockSlot) INTO nextCheckpointBlockSlot FROM slots WHERE slot < minFetchingSlot;

   IF nextCheckpointBlockSlot > currentCheckpointBlockSlot THEN
      SELECT blockHeight INTO nextCheckpointBlockHeight FROM slots WHERE slot = nextCheckpointBlockSlot;

      UPDATE
         admState
      SET
         checkpointBlockSlot = GREATEST(nextCheckpointBlockSlot, checkpointBlockSlot),
         checkpointBlockHeight = GREATEST(nextCheckpointBlockHeight, checkpointBlockHeight)
      ;
   END IF;
END;;

DELIMITER ;


--
-- FUNCTION
--
DELIMITER ;;

CREATE OR REPLACE FUNCTION fromPubkeyBase58(pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin) RETURNS int(11)
BEGIN
   DECLARE pubkeyId int;
   SELECT id INTO pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58 COLLATE utf8mb4_bin;
   RETURN pubkeyId;
END;;

CREATE OR REPLACE FUNCTION toPubkeyBase58(pubkeyId int) RETURNS varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin
BEGIN
   DECLARE pubkeyBase58 varchar(64) CHARSET utf8mb4 COLLATE utf8mb4_bin;
   SELECT pubkey INTO pubkeyBase58 FROM pubkeys WHERE id = pubkeyId;
   RETURN pubkeyBase58;
END;;

CREATE OR REPLACE FUNCTION resolveDecimals(mintPubkeyId int) RETURNS tinyint unsigned
BEGIN
   DECLARE foundDecimals TINYINT;
   SELECT decimals INTO foundDecimals FROM decimals WHERE mint = mintPubkeyId;
   RETURN foundDecimals;
END;;

CREATE OR REPLACE FUNCTION encodeU32(n int unsigned) RETURNS varbinary(4)
BEGIN
    -- little endian
    RETURN CONCAT(
        CHAR(n MOD 256),
        CHAR(FLOOR(n / 256) MOD 256),
        CHAR(FLOOR(n / 65536) MOD 256),
        CHAR(FLOOR(n / 16777216) MOD 256)
    );
END;;

CREATE OR REPLACE FUNCTION decodeU32(a varbinary(4)) RETURNS int unsigned
BEGIN
    -- little endian
    RETURN
        ORD(SUBSTRING(a, 1, 1)) +
        ORD(SUBSTRING(a, 2, 1)) * 256 +
        ORD(SUBSTRING(a, 3, 1)) * 65536 +
        ORD(SUBSTRING(a, 4, 1)) * 16777216;
END;;

CREATE OR REPLACE FUNCTION encodeBase58PubkeyArray(pubkeys JSON)
RETURNS VARBINARY(256)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE arrayLength INT;
    DECLARE pubkeyBase58 VARCHAR(64);
    DECLARE pubkeyId INT;
    DECLARE encoded VARBINARY(256) DEFAULT '';

    SET arrayLength = JSON_LENGTH(pubkeys);
    IF arrayLength > 64 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pubkeys length exceeds 64';
    END IF;

    WHILE i < arrayLength DO
        SET pubkeyBase58 = CAST(JSON_UNQUOTE(JSON_EXTRACT(pubkeys, CONCAT('$[', i, ']'))) AS VARCHAR(64));
        SET pubkeyId = fromPubkeyBase58(pubkeyBase58);
        IF pubkeyId IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'unknown pubkey detected';
        END IF;
        SET encoded = CONCAT(encoded, encodeU32(pubkeyId));
        SET i = i + 1;
    END WHILE;

    RETURN encoded;
END;;

CREATE OR REPLACE FUNCTION decodeBase58PubkeyArray(encoded varbinary(256))
RETURNS JSON
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE arrayLength INT;
    DECLARE pubkeyBase58 VARCHAR(64);
    DECLARE pubkeyId INT UNSIGNED;
    DECLARE pubkeys JSON DEFAULT '[]';

    SET arrayLength = LENGTH(encoded) / 4;
    WHILE i < arrayLength DO
        SET pubkeyId = decodeU32(SUBSTRING(encoded, i * 4 + 1, 4));
        SET pubkeyBase58 = toPubkeyBase58(pubkeyId);
        IF pubkeyBase58 IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'unknown pubkey detected';
        END IF;

        SET pubkeys = JSON_ARRAY_APPEND(pubkeys, '$', pubkeyBase58);
        SET i = i + 1;
    END WHILE;

    RETURN pubkeys;
END;;

CREATE OR REPLACE FUNCTION encodeU8U8TupleArray(tuples JSON)
RETURNS varbinary(32)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE arrayLength INT;
    DECLARE tupleLength INT;
    DECLARE tuple JSON;
    DECLARE tuple0 TINYINT UNSIGNED;
    DECLARE tuple1 TINYINT UNSIGNED;
    DECLARE encoded VARBINARY(64) DEFAULT '';

    SET arrayLength = JSON_LENGTH(tuples);
    IF arrayLength > 16 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tuples length exceeds 16';
    END IF;

    WHILE i < arrayLength DO
        SET tuple = JSON_EXTRACT(tuples, CONCAT('$[', i, ']'));
        SET tupleLength = JSON_LENGTH(tuple);
        IF tupleLength <> 2 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'tuple length must be 2';
        END IF;
        SET tuple0 = JSON_EXTRACT(tuple, "$[0]");
        SET tuple1 = JSON_EXTRACT(tuple, "$[1]");
        SET encoded = CONCAT(encoded, CHAR(tuple0), CHAR(tuple1));
        SET i = i + 1;
    END WHILE;

    RETURN encoded;
END;;

CREATE OR REPLACE FUNCTION decodeU8U8TupleArray(encoded varbinary(32))
RETURNS JSON
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE arrayLength INT;
    DECLARE tuple0 TINYINT UNSIGNED;
    DECLARE tuple1 TINYINT UNSIGNED;
    DECLARE tuples JSON DEFAULT '[]';

    SET arrayLength = LENGTH(encoded) / 2;
    WHILE i < arrayLength DO
        SET tuple0 = ORD(SUBSTRING(encoded, i * 2 + 1, 1));
        SET tuple1 = ORD(SUBSTRING(encoded, i * 2 + 2, 1));
        SET tuples = JSON_ARRAY_APPEND(tuples, '$', JSON_ARRAY(CAST(tuple0 as unsigned int), CAST(tuple1 as unsigned int)));
        SET i = i + 1;
    END WHILE;

    RETURN tuples;
END;;

DELIMITER ;


/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
