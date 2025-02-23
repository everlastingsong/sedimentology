use super::WhirlpoolEvent;

#[derive(Debug)]
pub enum WhirlpoolEventGroup {
    Trade,
    Liquidity,
    #[allow(dead_code)]
    All,
}

impl WhirlpoolEventGroup {
    pub fn contains(&self, event: &WhirlpoolEvent) -> bool {
        match self {
            WhirlpoolEventGroup::Trade => matches!(event, WhirlpoolEvent::Traded(_)),
            WhirlpoolEventGroup::Liquidity => matches!(
                event,
                WhirlpoolEvent::Traded(_)
                    | WhirlpoolEvent::LiquidityDeposited(_)
                    | WhirlpoolEvent::LiquidityWithdrawn(_)
                    | WhirlpoolEvent::LiquidityPatched(_)
                    | WhirlpoolEvent::PoolInitialized(_)
                    | WhirlpoolEvent::PoolFeeRateUpdated(_)
                    | WhirlpoolEvent::PoolProtocolFeeRateUpdated(_)
                    | WhirlpoolEvent::ConfigInitialized(_)
                    | WhirlpoolEvent::ConfigUpdated(_)
                    | WhirlpoolEvent::ConfigExtensionInitialized(_)
                    | WhirlpoolEvent::ConfigExtensionUpdated(_)
                    | WhirlpoolEvent::FeeTierInitialized(_)
                    | WhirlpoolEvent::FeeTierUpdated(_)
                    | WhirlpoolEvent::TokenBadgeInitialized(_)
                    | WhirlpoolEvent::TokenBadgeDeleted(_)
                    | WhirlpoolEvent::TickArrayInitialized(_)
                    | WhirlpoolEvent::RewardInitialized(_)
                    | WhirlpoolEvent::RewardEmissionsUpdated(_)
                    | WhirlpoolEvent::RewardAuthorityUpdated(_)
                    | WhirlpoolEvent::PositionLocked(_)
            ),
            WhirlpoolEventGroup::All => true,
        }
    }
}
