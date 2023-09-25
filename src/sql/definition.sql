# ************************************************************
# Sequel Ace SQL dump
# バージョン 20046
#
# https://sequel-ace.com/
# https://github.com/Sequel-Ace/Sequel-Ace
#
# ホスト: localhost (MySQL 11.1.2-MariaDB-1:11.1.2+maria~ubu2204)
# データベース: solana
# 生成時間: 2023-09-25 06:55:12 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
SET NAMES utf8mb4;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE='NO_AUTO_VALUE_ON_ZERO', SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# テーブルのダンプ balances
# ------------------------------------------------------------

CREATE TABLE `balances` (
  `txid` bigint(11) unsigned NOT NULL,
  `account` int(11) unsigned NOT NULL,
  `pre` bigint(11) unsigned NOT NULL,
  `post` bigint(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ blocks
# ------------------------------------------------------------

CREATE TABLE `blocks` (
  `slot` bigint(11) unsigned NOT NULL,
  `gzJsonString` longblob NOT NULL,
  PRIMARY KEY (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsAdminIncreaseLiquidity
# ------------------------------------------------------------

CREATE TABLE `ixsAdminIncreaseLiquidity` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataLiquidity` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsCloseBundledPosition
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsClosePosition
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsCollectFees
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsCollectProtocolFees
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsCollectReward
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsDecreaseLiquidity
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsDeletePositionBundle
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsIncreaseLiquidity
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializeConfig
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializeFeeTier
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializePool
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializePositionBundle
# ------------------------------------------------------------

CREATE TABLE `ixsInitializePositionBundle` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyPositionBundle` int(11) unsigned NOT NULL,
  `keyPositionBundleMint` int(11) unsigned NOT NULL,
  `keyPositionBundleTokenAccount` int(11) unsigned NOT NULL,
  `keyPositionBundleOwner` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyTokenProgram` int(11) unsigned NOT NULL,
  `keySytemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializePositionBundleWithMetadata
# ------------------------------------------------------------

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
  `keySytemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  `keyMetadataProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializeReward
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsInitializeTickArray
# ------------------------------------------------------------

CREATE TABLE `ixsInitializeTickArray` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataStartTickIndex` int(11) NOT NULL COMMENT 'i32',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFunder` int(11) unsigned NOT NULL,
  `keyTickArray` int(11) unsigned NOT NULL,
  `keySystemProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsOpenBundledPosition
# ------------------------------------------------------------

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
  `keySytemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsOpenPosition
# ------------------------------------------------------------

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
  `keySytemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsOpenPositionWithMetadata
# ------------------------------------------------------------

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
  `keySytemProgram` int(11) unsigned NOT NULL,
  `keyRent` int(11) unsigned NOT NULL,
  `keyAssociatedTokenProgram` int(11) unsigned NOT NULL,
  `keyMetadataProgram` int(11) unsigned NOT NULL,
  `keyMetadataUpdateAuth` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetCollectProtocolFeesAuthority
# ------------------------------------------------------------

CREATE TABLE `ixsSetCollectProtocolFeesAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  `keyNewCollectProtocolFeesAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetDefaultFeeRate
# ------------------------------------------------------------

CREATE TABLE `ixsSetDefaultFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataDefaultFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeTier` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetDefaultProtocolFeeRate
# ------------------------------------------------------------

CREATE TABLE `ixsSetDefaultProtocolFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataDefaultProtocolFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetFeeAuthority
# ------------------------------------------------------------

CREATE TABLE `ixsSetFeeAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  `keyNewFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetFeeRate
# ------------------------------------------------------------

CREATE TABLE `ixsSetFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetProtocolFeeRate
# ------------------------------------------------------------

CREATE TABLE `ixsSetProtocolFeeRate` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataProtocolFeeRate` smallint(11) unsigned NOT NULL COMMENT 'u16',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyFeeAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetRewardAuthority
# ------------------------------------------------------------

CREATE TABLE `ixsSetRewardAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetRewardAuthorityBySuperAuthority
# ------------------------------------------------------------

CREATE TABLE `ixsSetRewardAuthorityBySuperAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetRewardEmissions
# ------------------------------------------------------------

CREATE TABLE `ixsSetRewardEmissions` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `dataRewardIndex` tinyint(11) unsigned NOT NULL COMMENT 'u8',
  `dataEmissionsPerSecondX64` decimal(39,0) unsigned NOT NULL COMMENT 'u128',
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyRewardAuthority` int(11) unsigned NOT NULL,
  `keyRewardVault` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSetRewardEmissionsSuperAuthority
# ------------------------------------------------------------

CREATE TABLE `ixsSetRewardEmissionsSuperAuthority` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpoolsConfig` int(11) unsigned NOT NULL,
  `keyRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  `keyNewRewardEmissionsSuperAuthority` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsSwap
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsTwoHopSwap
# ------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ ixsUpdateFeesAndRewards
# ------------------------------------------------------------

CREATE TABLE `ixsUpdateFeesAndRewards` (
  `txid` bigint(11) unsigned NOT NULL,
  `order` tinyint(11) unsigned NOT NULL,
  `keyWhirlpool` int(11) unsigned NOT NULL,
  `keyPosition` int(11) unsigned NOT NULL,
  `keyTickArrayLower` int(11) unsigned NOT NULL,
  `keyTickArrayUpper` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`,`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ pubkeys
# ------------------------------------------------------------

CREATE TABLE `pubkeys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pubkey` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pubkey` (`pubkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ slots
# ------------------------------------------------------------

CREATE TABLE `slots` (
  `slot` bigint(11) unsigned NOT NULL,
  `blockHeight` bigint(11) unsigned NOT NULL,
  `blockTime` int(11) unsigned DEFAULT NULL,
  `state` tinyint(11) unsigned NOT NULL DEFAULT 0 COMMENT '0: added, 1: fetched',
  PRIMARY KEY (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ state
# ------------------------------------------------------------

CREATE TABLE `state` (
  `latestBlockSlot` bigint(11) unsigned NOT NULL,
  `latestBlockHeight` bigint(11) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



# テーブルのダンプ txs
# ------------------------------------------------------------

CREATE TABLE `txs` (
  `txid` bigint(11) unsigned NOT NULL,
  `signature` varchar(96) NOT NULL,
  `payer` int(11) unsigned NOT NULL,
  PRIMARY KEY (`txid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;




--
-- Dumping routines (PROCEDURE) for database 'solana'
--
DELIMITER ;;

# Dump of PROCEDURE addPubkeyIfNotExists
# ------------------------------------------------------------

/*!50003 SET SESSION SQL_MODE="STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`root`@`localhost`*/ /*!50003 PROCEDURE `addPubkeyIfNotExists`(pubkeyBase58 VARCHAR(48))
BEGIN
   DECLARE pubkeyId INT;
   SELECT id into pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58;
   IF pubkeyId IS NULL THEN
     INSERT INTO pubkeys (pubkey) VALUES (pubkeyBase58) ON DUPLICATE KEY UPDATE id = id;
   END IF;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
DELIMITER ;

--
-- Dumping routines (FUNCTION) for database 'solana'
--
DELIMITER ;;

# Dump of FUNCTION addAndCountPubkey
# ------------------------------------------------------------

/*!50003 SET SESSION SQL_MODE="STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`root`@`localhost`*/ /*!50003 FUNCTION `addAndCountPubkey`(in in_pubkey VARCHAR(256)) RETURNS int(11)
BEGIN
   DECLARE cnt INT;
   INSERT INTO pubkeys (pubkey) VALUES(in_pubkey);
   SELECT COUNT(*) INTO cnt FROM pubkeys WHERE pubkey = in_pubkey;
   return cnt;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
# Dump of FUNCTION countPubkey
# ------------------------------------------------------------

/*!50003 SET SESSION SQL_MODE="STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`root`@`localhost`*/ /*!50003 FUNCTION `countPubkey`(in in_pubkey VARCHAR(256)) RETURNS int(11)
    DETERMINISTIC
BEGIN
   DECLARE cnt INT;
   SELECT COUNT(*) INTO cnt FROM pubkeys WHERE pubkey = in_pubkey;
   return cnt;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
# Dump of FUNCTION fromPubkeyBase58
# ------------------------------------------------------------

/*!50003 SET SESSION SQL_MODE="STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`root`@`localhost`*/ /*!50003 FUNCTION `fromPubkeyBase58`(pubkeyBase58 VARCHAR(64)) RETURNS int(11)
BEGIN
   DECLARE pubkeyId INT;
   SELECT id into pubkeyId FROM pubkeys WHERE pubkey = pubkeyBase58;
   return pubkeyId;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
# Dump of FUNCTION pubkey2id
# ------------------------------------------------------------

/*!50003 SET SESSION SQL_MODE="STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`root`@`localhost`*/ /*!50003 FUNCTION `pubkey2id`(in in_pubkey VARCHAR(256)) RETURNS int(11)
BEGIN
   DECLARE out_id INT;
   SELECT id INTO out_id FROM pubkeys WHERE pubkey = in_pubkey;
   return out_id;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
DELIMITER ;

/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
