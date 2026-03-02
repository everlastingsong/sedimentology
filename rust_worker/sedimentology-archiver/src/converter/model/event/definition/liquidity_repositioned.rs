use super::super::super::serde::{string_u128, string_decimal_price};
use super::{DecimalPrice, PubkeyString, TransferInfo};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct LiquidityRepositionedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: LiquidityRepositionedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "pa")]
    pub position_authority: PubkeyString,
    #[serde(rename = "p")]
    pub position: PubkeyString,

    #[serde(rename = "olta")]
    pub old_lower_tick_array: PubkeyString,
    #[serde(rename = "outa")]
    pub old_upper_tick_array: PubkeyString,
    #[serde(rename = "nlta")]
    pub new_lower_tick_array: PubkeyString,
    #[serde(rename = "nuta")]
    pub new_upper_tick_array: PubkeyString,

    // transfer info
    #[serde(rename = "ta")]
    pub transfer_a: TransferInfo,
    #[serde(rename = "tfoa")]
    pub transfer_from_owner_a: bool,
    #[serde(rename = "tb")]
    pub transfer_b: TransferInfo,
    #[serde(rename = "tfob")]
    pub transfer_from_owner_b: bool,

    // position state
    #[serde(rename = "olti")]
    pub old_lower_tick_index: i32,
    #[serde(rename = "outi")]
    pub old_upper_tick_index: i32,
    #[serde(rename = "oldp", with = "string_decimal_price")]
    pub old_lower_decimal_price: DecimalPrice,
    #[serde(rename = "oudp", with = "string_decimal_price")]
    pub old_upper_decimal_price: DecimalPrice,

    #[serde(rename = "nlti")]
    pub new_lower_tick_index: i32,
    #[serde(rename = "nuti")]
    pub new_upper_tick_index: i32,
    #[serde(rename = "nldp", with = "string_decimal_price")]
    pub new_lower_decimal_price: DecimalPrice,
    #[serde(rename = "nudp", with = "string_decimal_price")]
    pub new_upper_decimal_price: DecimalPrice,

    #[serde(rename = "opl", with = "string_u128")]
    pub old_position_liquidity: u128,
    #[serde(rename = "npl", with = "string_u128")]
    pub new_position_liquidity: u128,

    // pool state
    #[serde(rename = "owl", with = "string_u128")]
    pub old_whirlpool_liquidity: u128,
    #[serde(rename = "nwl", with = "string_u128")]
    pub new_whirlpool_liquidity: u128,
    #[serde(rename = "wsp", with = "string_u128")]
    pub whirlpool_sqrt_price: u128,
    #[serde(rename = "wcti")]
    pub whirlpool_current_tick_index: i32,
    #[serde(rename = "wdp", with = "string_decimal_price")]
    pub whirlpool_decimal_price: DecimalPrice,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum LiquidityRepositionedEventOrigin {
    #[serde(rename = "rlv2")]
    RepositionLiquidityV2,
}
