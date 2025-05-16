use super::{AdaptiveFeeConstants, PubkeyString};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct AdaptiveFeeTierInitializedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: AdaptiveFeeTierInitializedEventOrigin,

    #[serde(rename = "c")]
    pub config: PubkeyString,

    #[serde(rename = "aft")]
    pub adaptive_fee_tier: PubkeyString,

    #[serde(rename = "fti")]
    pub fee_tier_index: u16,

    #[serde(rename = "ts")]
    pub tick_spacing: u16,

    #[serde(rename = "ipa")]
    pub initialize_pool_authority: PubkeyString,
    #[serde(rename = "dfa")]
    pub delegated_fee_authority: PubkeyString,

    #[serde(rename = "dbfr")]
    pub default_base_fee_rate: u16,

    #[serde(rename = "afc")]
    pub adaptive_fee_constants: AdaptiveFeeConstants,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum AdaptiveFeeTierInitializedEventOrigin {
    #[serde(rename = "iaft")]
    InitializeAdaptiveFeeTier,
}
