use super::super::super::serde::string_u128;
use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct LiquidityPatchedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: LiquidityPatchedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,

    #[serde(rename = "ld", with = "string_u128")]
    pub liquidity_delta: u128,

    #[serde(rename = "owl", with = "string_u128")]
    pub old_whirlpool_liquidity: u128,
    #[serde(rename = "nwl", with = "string_u128")]
    pub new_whirlpool_liquidity: u128,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum LiquidityPatchedEventOrigin {
    #[serde(rename = "ail")]
    AdminIncreaseLiquidity,
}
