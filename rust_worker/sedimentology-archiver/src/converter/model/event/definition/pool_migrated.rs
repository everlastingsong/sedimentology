use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct PoolMigratedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: PoolMigratedEventOrigin,

    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum PoolMigratedEventOrigin {
    #[serde(rename = "mrras")]
    MigrateRepurposeRewardAuthoritySpace,
}
