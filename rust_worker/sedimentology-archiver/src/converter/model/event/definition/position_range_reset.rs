use super::super::super::serde::string_decimal_price;
use super::{DecimalPrice, PubkeyString};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PositionRangeResetEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PositionRangeResetEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "p")]
    pub position: PubkeyString,

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

    #[serde(rename = "pa")]
    pub position_authority: PubkeyString,
}

#[allow(clippy::enum_variant_names)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PositionRangeResetEventOrigin {
    #[serde(rename = "rpr")]
    ResetPositionRange,
}
