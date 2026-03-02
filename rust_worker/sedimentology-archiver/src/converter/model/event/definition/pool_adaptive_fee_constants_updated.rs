use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PoolAdaptiveFeeConstantsUpdatedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PoolAdaptiveFeeConstantsUpdatedEventOrigin,

    #[serde(rename = "c")]
    pub config: PubkeyString,
    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,

    #[serde(rename = "ofp")]
    pub old_filter_period: u16,
    #[serde(rename = "nfp")]
    pub new_filter_period: u16,
    #[serde(rename = "odp")]
    pub old_decay_period: u16,
    #[serde(rename = "ndp")]
    pub new_decay_period: u16,
    #[serde(rename = "orf")]
    pub old_reduction_factor: u16,
    #[serde(rename = "nrf")]
    pub new_reduction_factor: u16,
    #[serde(rename = "oafcf")]
    pub old_adaptive_fee_control_factor: u32,
    #[serde(rename = "nafcf")]
    pub new_adaptive_fee_control_factor: u32,
    #[serde(rename = "omva")]
    pub old_max_volatility_accumulator: u32,
    #[serde(rename = "nmva")]
    pub new_max_volatility_accumulator: u32,
    #[serde(rename = "otgs")]
    pub old_tick_group_size: u16,
    #[serde(rename = "ntgs")]
    pub new_tick_group_size: u16,
    #[serde(rename = "omstt")]
    pub old_major_swap_threshold_ticks: u16,
    #[serde(rename = "nmstt")]
    pub new_major_swap_threshold_ticks: u16,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PoolAdaptiveFeeConstantsUpdatedEventOrigin {
    #[serde(rename = "safc")]
    SetAdaptiveFeeConstants,
}