use super::super::super::serde::string_decimal_price;
use super::position_opened::PositionType;
use super::{DecimalPrice, PubkeyString};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PositionClosedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PositionClosedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "p")]
    pub position: PubkeyString,

    #[serde(rename = "lti")]
    pub lower_tick_index: i32,
    #[serde(rename = "uti")]
    pub upper_tick_index: i32,
    #[serde(rename = "ldp", with = "string_decimal_price")]
    pub lower_decimal_price: DecimalPrice,
    #[serde(rename = "udp", with = "string_decimal_price")]
    pub upper_decimal_price: DecimalPrice,

    #[serde(rename = "pa")]
    pub position_authority: PubkeyString,

    #[serde(rename = "pt")]
    pub position_type: PositionType,

    // position only
    #[serde(rename = "pm", skip_serializing_if = "Option::is_none")]
    pub position_mint: Option<PubkeyString>,

    // bundled position only
    #[serde(rename = "pbm", skip_serializing_if = "Option::is_none")]
    pub position_bundle_mint: Option<PubkeyString>,
    #[serde(rename = "pb", skip_serializing_if = "Option::is_none")]
    pub position_bundle: Option<PubkeyString>,
    #[serde(rename = "pbi", skip_serializing_if = "Option::is_none")]
    pub position_bundle_index: Option<u16>,
}

#[allow(clippy::enum_variant_names)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PositionClosedEventOrigin {
    #[serde(rename = "cp")]
    ClosePosition,
    #[serde(rename = "cbp")]
    CloseBundledPosition,
    #[serde(rename = "cpwte")]
    ClosePositionWithTokenExtensions,
}
