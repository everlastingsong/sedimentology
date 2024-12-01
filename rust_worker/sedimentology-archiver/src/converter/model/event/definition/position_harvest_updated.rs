use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PositionHarvestUpdatedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PositionHarvestUpdatedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "p")]
    pub position: PubkeyString,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PositionHarvestUpdatedEventOrigin {
    #[serde(rename = "ufar")]
    UpdateFeesAndRewards,
}
