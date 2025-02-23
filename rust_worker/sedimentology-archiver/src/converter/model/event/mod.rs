pub mod convert;
pub mod definition;
pub mod group;

use definition::*;
use serde_derive::{Serialize, Deserialize};

/*

Whirlpool Event JSON Lines Format

To reduce data size, we use short field names.
Each line is a JSON object with the following schema:

{
  slot(s): u64,
  blockHeight(h): u64,
  blockTime(t): i64,
  transactions(x): [
    {
      signature(s): String(base58 encoding),
      payer(p): String(base58 encoding),
      events(e): [
        { name(n): String, payload(p): Value },
        { name(n): String, payload(p): Value },
        ...
      ],
    },
    ...
  ]
}

*/

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct WhirlpoolEventBlock {
    #[serde(rename = "s")]
    pub slot: u64,
    #[serde(rename = "h")]
    pub block_height: u64,
    #[serde(rename = "t")]
    pub block_time: i64,
    #[serde(rename = "x")]
    pub transactions: Vec<WhirlpoolEventTransaction>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct WhirlpoolEventTransaction {
    #[serde(rename = "s")]
    pub signature: String,
    #[serde(rename = "p")]
    pub payer: String,
    #[serde(rename = "e")]
    pub events: Vec<WhirlpoolEvent>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[serde(tag = "n", content = "p")]
pub enum WhirlpoolEvent {
    // Program Deploy or Upgrade
    #[serde(rename = "PD")]
    ProgramDeployed(ProgramDeployedEventPayload),

    // Trade
    #[serde(rename = "T")]
    Traded(TradedEventPayload),

    // Liquidity
    #[serde(rename = "LD")]
    LiquidityDeposited(LiquidityDepositedEventPayload),
    #[serde(rename = "LW")]
    LiquidityWithdrawn(LiquidityWithdrawnEventPayload),

    // New Pool
    #[serde(rename = "PI")]
    PoolInitialized(PoolInitializedEventPayload),

    // Reward
    #[serde(rename = "RI")]
    RewardInitialized(RewardInitializedEventPayload),
    #[serde(rename = "REU")]
    RewardEmissionsUpdated(RewardEmissionsUpdatedEventPayload),
    #[serde(rename = "RAU")]
    RewardAuthorityUpdated(RewardAuthorityUpdatedEventPayload),

    // Harvest
    #[serde(rename = "PHU")]
    PositionHarvestUpdated(PositionHarvestUpdatedEventPayload),
    #[serde(rename = "PFH")]
    PositionFeesHarvested(PositionFeesHarvestedEventPayload),
    #[serde(rename = "PRH")]
    PositionRewardHarvested(PositionRewardHarvestedEventPayload),

    // Protocol Fees
    #[serde(rename = "PFC")]
    ProtocolFeesCollected(ProtocolFeesCollectedEventPayload),

    // Position
    #[serde(rename = "PO")]
    PositionOpened(PositionOpenedEventPayload),
    #[serde(rename = "PC")]
    PositionClosed(PositionClosedEventPayload),
    #[serde(rename = "PL")]
    PositionLocked(PositionLockedEventPayload),

    // Position Bundle
    #[serde(rename = "PBI")]
    PositionBundleInitialized(PositionBundleInitializedEventPayload),
    #[serde(rename = "PBD")]
    PositionBundleDeleted(PositionBundleDeletedEventPayload),

    // Pool Fee Rate & Pool Protocol Fee Rate
    #[serde(rename = "PFRU")]
    PoolFeeRateUpdated(PoolFeeRateUpdatedEventPayload),
    #[serde(rename = "PPFRU")]
    PoolProtocolFeeRateUpdated(PoolProtocolFeeRateUpdatedEventPayload),

    // TickArray
    #[serde(rename = "TAI")]
    TickArrayInitialized(TickArrayInitializedEventPayload),

    // Config
    #[serde(rename = "CI")]
    ConfigInitialized(ConfigInitializedEventPayload),
    #[serde(rename = "CU")]
    ConfigUpdated(ConfigUpdatedEventPayload),

    // FeeTier
    #[serde(rename = "FTI")]
    FeeTierInitialized(FeeTierInitializedEventPayload),
    #[serde(rename = "FTU")]
    FeeTierUpdated(FeeTierUpdatedEventPayload),

    // ConfigExtension
    #[serde(rename = "CEI")]
    ConfigExtensionInitialized(ConfigExtensionInitializedEventPayload),
    #[serde(rename = "CEU")]
    ConfigExtensionUpdated(ConfigExtensionUpdatedEventPayload),

    // TokenBadge
    #[serde(rename = "TBI")]
    TokenBadgeInitialized(TokenBadgeInitializedEventPayload),
    #[serde(rename = "TBD")]
    TokenBadgeDeleted(TokenBadgeDeletedEventPayload),

    // Patch
    #[serde(rename = "LP")]
    LiquidityPatched(LiquidityPatchedEventPayload),
}
