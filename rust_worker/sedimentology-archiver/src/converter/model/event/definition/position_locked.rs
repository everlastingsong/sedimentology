use super::super::super::serde::{string_u128, string_decimal_price};
use super::{DecimalPrice, PubkeyString};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PositionLockedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PositionLockedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "p")]
    pub position: PubkeyString,

    #[serde(rename = "lt")]
    pub lock_type: PositionLockType,
    #[serde(rename = "lc")]
    pub lock_config: PubkeyString,

    #[serde(rename = "lti")]
    pub lower_tick_index: i32,
    #[serde(rename = "uti")]
    pub upper_tick_index: i32,
    #[serde(rename = "ldp", with = "string_decimal_price")]
    pub lower_decimal_price: DecimalPrice,
    #[serde(rename = "udp", with = "string_decimal_price")]
    pub upper_decimal_price: DecimalPrice,

    #[serde(rename = "ll", with = "string_u128")]
    pub locked_liquidity: u128,

    #[serde(rename = "po")]
    pub position_owner: PubkeyString,

    #[serde(rename = "pm")]
    pub position_mint: PubkeyString,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PositionLockedEventOrigin {
    #[serde(rename = "lp")]
    LockPosition,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[serde(tag = "n")]
pub enum PositionLockType {
    #[serde(rename = "p")]
    Permanent,
}
