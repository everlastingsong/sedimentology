use super::{PubkeyString, TransferInfo};
use serde_derive::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct ProtocolFeesCollectedEventPayload {
    // origin
    #[serde(rename = "o")]
    pub origin: ProtocolFeesCollectedEventOrigin,

    #[serde(rename = "c")]
    pub config: PubkeyString,
    #[serde(rename = "w")]
    pub whirlpool: PubkeyString,
    #[serde(rename = "cpfa")]
    pub collect_protocol_fees_authority: PubkeyString,

    // transfer info
    #[serde(rename = "ta")]
    pub transfer_a: TransferInfo,
    #[serde(rename = "tb")]
    pub transfer_b: TransferInfo,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum ProtocolFeesCollectedEventOrigin {
    #[serde(rename = "cpf")]
    CollectProtocolFees,
    #[serde(rename = "cpfv2")]
    CollectProtocolFeesV2,
}
