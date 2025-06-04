use super::{AdaptiveFeeConstants, PubkeyString};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct AdaptiveFeeTierUpdatedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: AdaptiveFeeTierUpdatedEventOrigin,

    #[serde(rename = "c")]
    pub config: PubkeyString,

    #[serde(rename = "aft")]
    pub adaptive_fee_tier: PubkeyString,

    #[serde(rename = "fti")]
    pub fee_tier_index: u16,

    #[serde(rename = "ts")]
    pub tick_spacing: u16,

    #[serde(rename = "oipa")]
    pub old_initialize_pool_authority: PubkeyString,
    #[serde(rename = "nipa")]
    pub new_initialize_pool_authority: PubkeyString,

    #[serde(rename = "odfa")]
    pub old_delegated_fee_authority: PubkeyString,
    #[serde(rename = "ndfa")]
    pub new_delegated_fee_authority: PubkeyString,

    #[serde(rename = "odbfr")]
    pub old_default_base_fee_rate: u16,
    #[serde(rename = "ndbfr")]
    pub new_default_base_fee_rate: u16,

    #[serde(rename = "oafc")]
    pub old_adaptive_fee_constants: AdaptiveFeeConstants,
    #[serde(rename = "nafc")]
    pub new_adaptive_fee_constants: AdaptiveFeeConstants,
}

#[allow(clippy::enum_variant_names)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum AdaptiveFeeTierUpdatedEventOrigin {
    #[serde(rename = "sipa")]
    SetInitializePoolAuthority,
    #[serde(rename = "sdfa")]
    SetDelegatedFeeAuthority,
    #[serde(rename = "sdbfr")]
    SetDefaultBaseFeeRate,
    #[serde(rename = "spafc")]
    SetPresetAdaptiveFeeConstants,
}
