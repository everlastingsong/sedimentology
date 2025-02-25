use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PositionBundleDeletedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PositionBundleDeletedEventOrigin,

    #[serde(rename = "pb")]
    pub position_bundle: PubkeyString,

    #[serde(rename = "pbm")]
    pub position_bundle_mint: PubkeyString,

    #[serde(rename = "pbo")]
    pub position_bundle_owner: PubkeyString,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PositionBundleDeletedEventOrigin {
    #[serde(rename = "dpb")]
    DeletePositionBundle,
}
