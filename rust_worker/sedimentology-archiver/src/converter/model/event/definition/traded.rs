use super::super::super::serde::{string_decimal_price, string_u128};
use super::{AdaptiveFeeVariables, DecimalPrice, PubkeyString, TransferInfo};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct TradedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: TradedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "ta")]
    pub token_authority: PubkeyString,

    #[serde(rename = "tm")]
    pub trade_mode: TradeMode,
    #[serde(rename = "td")]
    pub trade_direction: TradeDirection,

    // transfer info
    #[serde(rename = "ti")]
    pub transfer_in: TransferInfo,
    #[serde(rename = "to")]
    pub transfer_out: TransferInfo,

    // pool state
    #[serde(rename = "osp", with = "string_u128")]
    pub old_sqrt_price: u128,
    #[serde(rename = "nsp", with = "string_u128")]
    pub new_sqrt_price: u128,
    #[serde(rename = "octi")]
    pub old_current_tick_index: i32,
    #[serde(rename = "ncti")]
    pub new_current_tick_index: i32,
    #[serde(rename = "odp", with = "string_decimal_price")]
    pub old_decimal_price: DecimalPrice,
    #[serde(rename = "ndp", with = "string_decimal_price")]
    pub new_decimal_price: DecimalPrice,
    #[serde(rename = "fr")]
    pub fee_rate: u16,
    #[serde(rename = "pfr")]
    pub protocol_fee_rate: u16,

    // Adaptive Fee enabled pool only
    #[serde(rename = "oafv", skip_serializing_if = "Option::is_none")]
    pub old_adaptive_fee_variables: Option<AdaptiveFeeVariables>,
    #[serde(rename = "nafv", skip_serializing_if = "Option::is_none")]
    pub new_adaptive_fee_variables: Option<AdaptiveFeeVariables>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum TradedEventOrigin {
    #[serde(rename = "s")]
    Swap,
    #[serde(rename = "sv2")]
    SwapV2,
    #[serde(rename = "thso")]
    TwoHopSwapOne,
    #[serde(rename = "thst")]
    TwoHopSwapTwo,
    #[serde(rename = "thsv2o")]
    TwoHopSwapV2One,
    #[serde(rename = "thsv2t")]
    TwoHopSwapV2Two,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum TradeMode {
    #[serde(rename = "ei")]
    ExactInput,
    #[serde(rename = "eo")]
    ExactOutput,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum TradeDirection {
    #[serde(rename = "ab")]
    AtoB,
    #[serde(rename = "ba")]
    BtoA,
}
