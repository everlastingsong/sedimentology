mod adaptive_fee_tier_initialized;
mod adaptive_fee_tier_updated;
mod config_extension_initialized;
mod config_extension_updated;
mod config_initialized;
mod config_updated;
mod fee_tier_initialized;
mod fee_tier_updated;
mod liquidity_deposited;
mod liquidity_patched;
mod liquidity_withdrawn;
mod pool_fee_rate_updated;
mod pool_initialized;
mod pool_protocol_fee_rate_updated;
mod pool_migrated;
mod position_bundle_deleted;
mod position_bundle_initialized;
mod position_closed;
mod position_fees_harvested;
mod position_harvest_updated;
mod position_locked;
mod position_opened;
mod position_range_reset;
mod position_reward_harvested;
mod position_locked_transferred;
mod protocol_fees_collected;
mod reward_authority_updated;
mod reward_emissions_updated;
mod reward_initialized;
mod tick_array_initialized;
mod token_badge_deleted;
mod token_badge_initialized;
mod token_badge_updated;
mod traded;

pub use adaptive_fee_tier_initialized::*;
pub use adaptive_fee_tier_updated::*;
pub use config_extension_initialized::*;
pub use config_extension_updated::*;
pub use config_initialized::*;
pub use config_updated::*;
pub use fee_tier_initialized::*;
pub use fee_tier_updated::*;
pub use liquidity_deposited::*;
pub use liquidity_patched::*;
pub use liquidity_withdrawn::*;
pub use pool_fee_rate_updated::*;
pub use pool_initialized::*;
pub use pool_protocol_fee_rate_updated::*;
pub use pool_migrated::*;
pub use position_bundle_deleted::*;
pub use position_bundle_initialized::*;
pub use position_closed::*;
pub use position_fees_harvested::*;
pub use position_harvest_updated::*;
pub use position_locked::*;
pub use position_opened::*;
pub use position_range_reset::*;
pub use position_reward_harvested::*;
pub use position_locked_transferred::*;
pub use protocol_fees_collected::*;
pub use reward_authority_updated::*;
pub use reward_emissions_updated::*;
pub use reward_initialized::*;
pub use tick_array_initialized::*;
pub use token_badge_deleted::*;
pub use token_badge_initialized::*;
pub use token_badge_updated::*;
pub use traded::*;

mod program_deployed;
pub use program_deployed::*;

use super::super::serde::{string_option_u64, string_u64};
use bigdecimal::BigDecimal;
use serde::{Serialize, Deserialize};

pub type PubkeyString = String;
pub type DecimalPrice = BigDecimal;
pub type Decimals = u8;

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct TransferInfo {
    #[serde(rename = "m")]
    pub mint: PubkeyString,

    #[serde(rename = "a", with = "string_u64")]
    pub amount: u64,

    #[serde(rename = "d")]
    pub decimals: Decimals,

    #[serde(rename = "tfb", skip_serializing_if = "Option::is_none", default = "Option::default")]
    pub transfer_fee_bps: Option<u16>,
    #[serde(
        rename = "tfm",
        skip_serializing_if = "Option::is_none",
        default = "Option::default",
        with = "string_option_u64"
    )]
    pub transfer_fee_max: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum TokenProgram {
    #[serde(rename = "t")]
    Token,
    #[serde(rename = "t2")]
    Token2022,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct AdaptiveFeeConstants {
    #[serde(rename = "fp")]
    pub filter_period: u16,
    #[serde(rename = "dp")]
    pub decay_period: u16,
    #[serde(rename = "rf")]
    pub reduction_factor: u16,
    #[serde(rename = "afcf")]
    pub adaptive_fee_control_factor: u32,
    #[serde(rename = "mva")]
    pub max_volatility_accumulator: u32,
    #[serde(rename = "tgs")]
    pub tick_group_size: u16,
    #[serde(rename = "mstt")]
    pub major_swap_threshold_ticks: u16,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct AdaptiveFeeVariables {
    #[serde(rename = "lrut", with = "string_u64")]
    pub last_reference_update_timestamp: u64,
    #[serde(rename = "lmst", with = "string_u64")]
    pub last_major_swap_timestamp: u64,
    #[serde(rename = "vr")]
    pub volatility_reference: u32,
    #[serde(rename = "tgir")]
    pub tick_group_index_reference: i32,
    #[serde(rename = "va")]
    pub volatility_accumulator: u32,
}
