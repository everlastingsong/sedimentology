use super::PubkeyString;
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct TokenBadgeUpdatedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: TokenBadgeUpdatedEventOrigin,

    #[serde(rename = "c")]
    pub config: PubkeyString,

    #[serde(rename = "tm")]
    pub token_mint: PubkeyString,

    #[serde(rename = "tb")]
    pub token_badge: PubkeyString,

    #[serde(rename = "oarntp")]
    pub old_attribute_require_non_transferable_position: bool,
    #[serde(rename = "narntp")]
    pub new_attribute_require_non_transferable_position: bool,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum TokenBadgeUpdatedEventOrigin {
    #[serde(rename = "stba")]
    SetTokenBadgeAttribute,
}
