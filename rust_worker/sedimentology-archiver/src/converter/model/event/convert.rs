use core::panic;
use std::collections::HashMap;

use bigdecimal::BigDecimal;
use replay_engine::{
    account_data_store::AccountDataStore,
    decoded_instructions::TransferAmountWithTransferFeeConfig, types::WritableAccountSnapshot,
};
use whirlpool_replayer::schema::DecodedWhirlpoolInstruction;

use super::{definition::*, WhirlpoolEvent};
use anchor_lang::prelude::*;
use whirlpool_base::{
    math::sqrt_price_from_tick_index,
    state::{FeeTier, LockConfig, Position, Whirlpool, WhirlpoolsConfig, WhirlpoolsConfigExtension},
};

pub fn build_whirlpool_events(
    whirlpool_instruction: &DecodedWhirlpoolInstruction,
    decimals: &HashMap<String, u8>,
    accounts: &AccountDataStore,
    writable_account_snapshot: &WritableAccountSnapshot,
) -> Vec<WhirlpoolEvent> {
    let mut events = vec![];

    match whirlpool_instruction {
        ////////////////////////////////////////////////////////////////////////////////
        // Traded: Swap, SwapV2, TwoHopSwap, TwoHopSwapV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::Swap(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let (mint_in, mint_out) = if params.data_a_to_b {
                (&old_whirlpool.token_mint_a, &old_whirlpool.token_mint_b)
            } else {
                (&old_whirlpool.token_mint_b, &old_whirlpool.token_mint_a)
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::Swap,
                trade_direction: if params.data_a_to_b {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool.clone(),
                old_sqrt_price: old_whirlpool.sqrt_price,
                new_sqrt_price: new_whirlpool.sqrt_price,
                old_current_tick_index: old_whirlpool.tick_current_index,
                new_current_tick_index: new_whirlpool.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool.sqrt_price,
                    &old_whirlpool.token_mint_a,
                    &old_whirlpool.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool.sqrt_price,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool.fee_rate,
                protocol_fee_rate: old_whirlpool.protocol_fee_rate,
                transfer_in: from_v1_transfer(params.transfer_amount_0, mint_in, decimals),
                transfer_out: from_v1_transfer(params.transfer_amount_1, mint_out, decimals),
            }));
        }
        DecodedWhirlpoolInstruction::SwapV2(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let (mint_in, mint_out) = if params.data_a_to_b {
                (&old_whirlpool.token_mint_a, &old_whirlpool.token_mint_b)
            } else {
                (&old_whirlpool.token_mint_b, &old_whirlpool.token_mint_a)
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::SwapV2,
                trade_direction: if params.data_a_to_b {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool.clone(),
                old_sqrt_price: old_whirlpool.sqrt_price,
                new_sqrt_price: new_whirlpool.sqrt_price,
                old_current_tick_index: old_whirlpool.tick_current_index,
                new_current_tick_index: new_whirlpool.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool.sqrt_price,
                    &old_whirlpool.token_mint_a,
                    &old_whirlpool.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool.sqrt_price,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool.fee_rate,
                protocol_fee_rate: old_whirlpool.protocol_fee_rate,
                transfer_in: from_v2_transfer(&params.transfer_0, mint_in, decimals),
                transfer_out: from_v2_transfer(&params.transfer_1, mint_out, decimals),
            }));
        }
        DecodedWhirlpoolInstruction::TwoHopSwap(params) => {
            let old_whirlpool_one =
                get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool_one);
            let new_whirlpool_one = get_new_whirlpool(accounts, &params.key_whirlpool_one);

            let (mint_in_one, mint_out_one) = if params.data_a_to_b_one {
                (
                    &old_whirlpool_one.token_mint_a,
                    &old_whirlpool_one.token_mint_b,
                )
            } else {
                (
                    &old_whirlpool_one.token_mint_b,
                    &old_whirlpool_one.token_mint_a,
                )
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::TwoHopSwapOne,
                trade_direction: if params.data_a_to_b_one {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool_one.clone(),
                old_sqrt_price: old_whirlpool_one.sqrt_price,
                new_sqrt_price: new_whirlpool_one.sqrt_price,
                old_current_tick_index: old_whirlpool_one.tick_current_index,
                new_current_tick_index: new_whirlpool_one.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool_one.sqrt_price,
                    &old_whirlpool_one.token_mint_a,
                    &old_whirlpool_one.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool_one.sqrt_price,
                    &new_whirlpool_one.token_mint_a,
                    &new_whirlpool_one.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool_one.fee_rate,
                protocol_fee_rate: old_whirlpool_one.protocol_fee_rate,
                transfer_in: from_v1_transfer(params.transfer_amount_0, mint_in_one, decimals),
                transfer_out: from_v1_transfer(params.transfer_amount_1, mint_out_one, decimals),
            }));

            let old_whirlpool_two =
                get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool_two);
            let new_whirlpool_two = get_new_whirlpool(accounts, &params.key_whirlpool_two);

            let (mint_in_two, mint_out_two) = if params.data_a_to_b_two {
                (
                    &old_whirlpool_two.token_mint_a,
                    &old_whirlpool_two.token_mint_b,
                )
            } else {
                (
                    &old_whirlpool_two.token_mint_b,
                    &old_whirlpool_two.token_mint_a,
                )
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::TwoHopSwapTwo,
                trade_direction: if params.data_a_to_b_two {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool_two.clone(),
                old_sqrt_price: old_whirlpool_two.sqrt_price,
                new_sqrt_price: new_whirlpool_two.sqrt_price,
                old_current_tick_index: old_whirlpool_two.tick_current_index,
                new_current_tick_index: new_whirlpool_two.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool_two.sqrt_price,
                    &old_whirlpool_two.token_mint_a,
                    &old_whirlpool_two.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool_two.sqrt_price,
                    &new_whirlpool_two.token_mint_a,
                    &new_whirlpool_two.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool_two.fee_rate,
                protocol_fee_rate: old_whirlpool_two.protocol_fee_rate,
                transfer_in: from_v1_transfer(params.transfer_amount_2, mint_in_two, decimals),
                transfer_out: from_v1_transfer(params.transfer_amount_3, mint_out_two, decimals),
            }));
        }
        DecodedWhirlpoolInstruction::TwoHopSwapV2(params) => {
            let old_whirlpool_one =
                get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool_one);
            let new_whirlpool_one = get_new_whirlpool(accounts, &params.key_whirlpool_one);

            let (mint_in_one, mint_out_one) = if params.data_a_to_b_one {
                (
                    &old_whirlpool_one.token_mint_a,
                    &old_whirlpool_one.token_mint_b,
                )
            } else {
                (
                    &old_whirlpool_one.token_mint_b,
                    &old_whirlpool_one.token_mint_a,
                )
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::TwoHopSwapV2One,
                trade_direction: if params.data_a_to_b_one {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool_one.clone(),
                old_sqrt_price: old_whirlpool_one.sqrt_price,
                new_sqrt_price: new_whirlpool_one.sqrt_price,
                old_current_tick_index: old_whirlpool_one.tick_current_index,
                new_current_tick_index: new_whirlpool_one.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool_one.sqrt_price,
                    &old_whirlpool_one.token_mint_a,
                    &old_whirlpool_one.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool_one.sqrt_price,
                    &new_whirlpool_one.token_mint_a,
                    &new_whirlpool_one.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool_one.fee_rate,
                protocol_fee_rate: old_whirlpool_one.protocol_fee_rate,
                transfer_in: from_v2_transfer(&params.transfer_0, mint_in_one, decimals),
                transfer_out: from_v2_transfer(&params.transfer_1, mint_out_one, decimals),
            }));

            let old_whirlpool_two =
                get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool_two);
            let new_whirlpool_two = get_new_whirlpool(accounts, &params.key_whirlpool_two);

            let (mint_in_two, mint_out_two) = if params.data_a_to_b_two {
                (
                    &old_whirlpool_two.token_mint_a,
                    &old_whirlpool_two.token_mint_b,
                )
            } else {
                (
                    &old_whirlpool_two.token_mint_b,
                    &old_whirlpool_two.token_mint_a,
                )
            };

            events.push(WhirlpoolEvent::Traded(TradedEventPayload {
                origin: TradedEventOrigin::TwoHopSwapV2Two,
                trade_direction: if params.data_a_to_b_two {
                    TradeDirection::AtoB
                } else {
                    TradeDirection::BtoA
                },
                trade_mode: if params.data_amount_specified_is_input {
                    TradeMode::ExactInput
                } else {
                    TradeMode::ExactOutput
                },
                token_authority: params.key_token_authority.clone(),
                whirlpool: params.key_whirlpool_two.clone(),
                old_sqrt_price: old_whirlpool_two.sqrt_price,
                new_sqrt_price: new_whirlpool_two.sqrt_price,
                old_current_tick_index: old_whirlpool_two.tick_current_index,
                new_current_tick_index: new_whirlpool_two.tick_current_index,
                old_decimal_price: sqrt_price_to_decimal_price(
                    old_whirlpool_two.sqrt_price,
                    &old_whirlpool_two.token_mint_a,
                    &old_whirlpool_two.token_mint_b,
                    decimals,
                ),
                new_decimal_price: sqrt_price_to_decimal_price(
                    new_whirlpool_two.sqrt_price,
                    &new_whirlpool_two.token_mint_a,
                    &new_whirlpool_two.token_mint_b,
                    decimals,
                ),
                fee_rate: old_whirlpool_two.fee_rate,
                protocol_fee_rate: old_whirlpool_two.protocol_fee_rate,
                transfer_in: from_v2_transfer(&params.transfer_1, mint_in_two, decimals),
                transfer_out: from_v2_transfer(&params.transfer_2, mint_out_two, decimals),
            }));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // LiquidityDeposited: IncreaseLiquidity, IncreaseLiquidityV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::IncreaseLiquidity(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_position = get_new_position(accounts, &params.key_position);
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::LiquidityDeposited(
                LiquidityDepositedEventPayload {
                    origin: LiquidityDepositedEventOrigin::IncreaseLiquidity,
                    liquidity_delta: params.data_liquidity_amount,
                    whirlpool: params.key_whirlpool.clone(),
                    position_authority: params.key_position_authority.clone(),
                    position: params.key_position.clone(),
                    lower_tick_array: params.key_tick_array_lower.clone(),
                    upper_tick_array: params.key_tick_array_upper.clone(),
                    lower_tick_index: old_position.tick_lower_index,
                    upper_tick_index: old_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_lower_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_upper_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_position_liquidity: old_position.liquidity,
                    new_position_liquidity: new_position.liquidity,
                    transfer_a: from_v1_transfer(
                        params.transfer_amount_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v1_transfer(
                        params.transfer_amount_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_whirlpool_liquidity: old_whirlpool.liquidity,
                    new_whirlpool_liquidity: new_whirlpool.liquidity,
                    whirlpool_sqrt_price: new_whirlpool.sqrt_price,
                    whirlpool_current_tick_index: new_whirlpool.tick_current_index,
                    whirlpool_decimal_price: sqrt_price_to_decimal_price(
                        new_whirlpool.sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        DecodedWhirlpoolInstruction::IncreaseLiquidityV2(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_position = get_new_position(accounts, &params.key_position);
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::LiquidityDeposited(
                LiquidityDepositedEventPayload {
                    origin: LiquidityDepositedEventOrigin::IncreaseLiquidityV2,
                    liquidity_delta: params.data_liquidity_amount,
                    whirlpool: params.key_whirlpool.clone(),
                    position_authority: params.key_position_authority.clone(),
                    position: params.key_position.clone(),
                    lower_tick_array: params.key_tick_array_lower.clone(),
                    upper_tick_array: params.key_tick_array_upper.clone(),
                    lower_tick_index: old_position.tick_lower_index,
                    upper_tick_index: old_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_lower_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_upper_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_position_liquidity: old_position.liquidity,
                    new_position_liquidity: new_position.liquidity,
                    transfer_a: from_v2_transfer(
                        &params.transfer_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v2_transfer(
                        &params.transfer_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_whirlpool_liquidity: old_whirlpool.liquidity,
                    new_whirlpool_liquidity: new_whirlpool.liquidity,
                    whirlpool_sqrt_price: new_whirlpool.sqrt_price,
                    whirlpool_current_tick_index: new_whirlpool.tick_current_index,
                    whirlpool_decimal_price: sqrt_price_to_decimal_price(
                        new_whirlpool.sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // LiquidityWithdrawn: DecreaseLiquidity, DecreaseLiquidityV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::DecreaseLiquidity(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_position = get_new_position(accounts, &params.key_position);
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::LiquidityWithdrawn(
                LiquidityWithdrawnEventPayload {
                    origin: LiquidityWithdrawnEventOrigin::DecreaseLiquidity,
                    liquidity_delta: params.data_liquidity_amount,
                    whirlpool: params.key_whirlpool.clone(),
                    position_authority: params.key_position_authority.clone(),
                    position: params.key_position.clone(),
                    lower_tick_array: params.key_tick_array_lower.clone(),
                    upper_tick_array: params.key_tick_array_upper.clone(),
                    lower_tick_index: old_position.tick_lower_index,
                    upper_tick_index: old_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_lower_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_upper_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_position_liquidity: old_position.liquidity,
                    new_position_liquidity: new_position.liquidity,
                    transfer_a: from_v1_transfer(
                        params.transfer_amount_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v1_transfer(
                        params.transfer_amount_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_whirlpool_liquidity: old_whirlpool.liquidity,
                    new_whirlpool_liquidity: new_whirlpool.liquidity,
                    whirlpool_sqrt_price: new_whirlpool.sqrt_price,
                    whirlpool_current_tick_index: new_whirlpool.tick_current_index,
                    whirlpool_decimal_price: sqrt_price_to_decimal_price(
                        new_whirlpool.sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        DecodedWhirlpoolInstruction::DecreaseLiquidityV2(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_position = get_new_position(accounts, &params.key_position);
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::LiquidityWithdrawn(
                LiquidityWithdrawnEventPayload {
                    origin: LiquidityWithdrawnEventOrigin::DecreaseLiquidityV2,
                    liquidity_delta: params.data_liquidity_amount,
                    whirlpool: params.key_whirlpool.clone(),
                    position_authority: params.key_position_authority.clone(),
                    position: params.key_position.clone(),
                    lower_tick_array: params.key_tick_array_lower.clone(),
                    upper_tick_array: params.key_tick_array_upper.clone(),
                    lower_tick_index: old_position.tick_lower_index,
                    upper_tick_index: old_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_lower_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_upper_index,
                        &old_whirlpool.token_mint_a,
                        &old_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_position_liquidity: old_position.liquidity,
                    new_position_liquidity: new_position.liquidity,
                    transfer_a: from_v2_transfer(
                        &params.transfer_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v2_transfer(
                        &params.transfer_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_whirlpool_liquidity: old_whirlpool.liquidity,
                    new_whirlpool_liquidity: new_whirlpool.liquidity,
                    whirlpool_sqrt_price: new_whirlpool.sqrt_price,
                    whirlpool_current_tick_index: new_whirlpool.tick_current_index,
                    whirlpool_decimal_price: sqrt_price_to_decimal_price(
                        new_whirlpool.sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PoolInitialized: InitializePool, InitializePoolV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializePool(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PoolInitialized(
                PoolInitializedEventPayload {
                    origin: PoolInitializedEventOrigin::InitializePool,
                    tick_spacing: params.data_tick_spacing,
                    sqrt_price: params.data_initial_sqrt_price,
                    decimal_price: sqrt_price_to_decimal_price(
                        params.data_initial_sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    current_tick_index: new_whirlpool.tick_current_index,
                    config: params.key_whirlpools_config.clone(),
                    token_mint_a: params.key_token_mint_a.clone(),
                    token_mint_b: params.key_token_mint_b.clone(),
                    funder: params.key_funder.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    fee_tier: params.key_fee_tier.clone(),
                    token_program_a: TokenProgram::Token,
                    token_program_b: TokenProgram::Token,
                    token_decimals_a: get_decimals(&params.key_token_mint_a, decimals),
                    token_decimals_b: get_decimals(&params.key_token_mint_b, decimals),
                    fee_rate: new_whirlpool.fee_rate,
                    protocol_fee_rate: new_whirlpool.protocol_fee_rate,
                },
            ));
        }
        DecodedWhirlpoolInstruction::InitializePoolV2(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PoolInitialized(
                PoolInitializedEventPayload {
                    origin: PoolInitializedEventOrigin::InitializePoolV2,
                    tick_spacing: params.data_tick_spacing,
                    sqrt_price: params.data_initial_sqrt_price,
                    decimal_price: sqrt_price_to_decimal_price(
                        params.data_initial_sqrt_price,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    current_tick_index: new_whirlpool.tick_current_index,
                    config: params.key_whirlpools_config.clone(),
                    token_mint_a: params.key_token_mint_a.clone(),
                    token_mint_b: params.key_token_mint_b.clone(),
                    funder: params.key_funder.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    fee_tier: params.key_fee_tier.clone(),
                    token_program_a: get_token_program(&params.key_token_program_a),
                    token_program_b: get_token_program(&params.key_token_program_b),
                    token_decimals_a: get_decimals(&params.key_token_mint_a, decimals),
                    token_decimals_b: get_decimals(&params.key_token_mint_b, decimals),
                    fee_rate: new_whirlpool.fee_rate,
                    protocol_fee_rate: new_whirlpool.protocol_fee_rate,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // RewardInitialized: InitializeReward, InitializeRewardV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeReward(params) => {
            events.push(WhirlpoolEvent::RewardInitialized(
                RewardInitializedEventPayload {
                    origin: RewardInitializedEventOrigin::InitializeReward,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    reward_mint: params.key_reward_mint.clone(),
                    reward_token_program: get_token_program(&params.key_token_program),
                    reward_decimal: get_decimals(&params.key_reward_mint, decimals),
                },
            ));
        }
        DecodedWhirlpoolInstruction::InitializeRewardV2(params) => {
            events.push(WhirlpoolEvent::RewardInitialized(
                RewardInitializedEventPayload {
                    origin: RewardInitializedEventOrigin::InitializeRewardV2,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    reward_mint: params.key_reward_mint.clone(),
                    reward_token_program: get_token_program(&params.key_reward_token_program),
                    reward_decimal: get_decimals(&params.key_reward_mint, decimals),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // RewardEmissionsUpdated: SetRewardEmissions, SetRewardEmissionsV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetRewardEmissions(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let reward_index_usize = params.data_reward_index as usize;
            let reward_mint = new_whirlpool.reward_infos[reward_index_usize]
                .mint
                .to_string();

            events.push(WhirlpoolEvent::RewardEmissionsUpdated(
                RewardEmissionsUpdatedEventPayload {
                    origin: RewardEmissionsUpdatedEventOrigin::SetRewardEmissions,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    reward_mint: reward_mint.clone(),
                    reward_decimals: get_decimals(&reward_mint, decimals),
                    old_emissions_per_second_x64: old_whirlpool.reward_infos[reward_index_usize]
                        .emissions_per_second_x64,
                    new_emissions_per_second_x64: new_whirlpool.reward_infos[reward_index_usize]
                        .emissions_per_second_x64,
                },
            ));
        }
        DecodedWhirlpoolInstruction::SetRewardEmissionsV2(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let reward_index_usize = params.data_reward_index as usize;
            let reward_mint = new_whirlpool.reward_infos[reward_index_usize]
                .mint
                .to_string();

            events.push(WhirlpoolEvent::RewardEmissionsUpdated(
                RewardEmissionsUpdatedEventPayload {
                    origin: RewardEmissionsUpdatedEventOrigin::SetRewardEmissionsV2,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    reward_mint: reward_mint.clone(),
                    reward_decimals: get_decimals(&reward_mint, decimals),
                    old_emissions_per_second_x64: old_whirlpool.reward_infos[reward_index_usize]
                        .emissions_per_second_x64,
                    new_emissions_per_second_x64: new_whirlpool.reward_infos[reward_index_usize]
                        .emissions_per_second_x64,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionFeesHarvested: CollectFees, CollectFeesV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::CollectFees(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PositionFeesHarvested(
                PositionFeesHarvestedEventPayload {
                    origin: PositionFeesHarvestedEventOrigin::CollectFees,
                    whirlpool: params.key_whirlpool.clone(),
                    position: params.key_position.clone(),
                    position_authority: params.key_position_authority.clone(),
                    transfer_a: from_v1_transfer(
                        params.transfer_amount_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v1_transfer(
                        params.transfer_amount_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        DecodedWhirlpoolInstruction::CollectFeesV2(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PositionFeesHarvested(
                PositionFeesHarvestedEventPayload {
                    origin: PositionFeesHarvestedEventOrigin::CollectFeesV2,
                    whirlpool: params.key_whirlpool.clone(),
                    position: params.key_position.clone(),
                    position_authority: params.key_position_authority.clone(),
                    transfer_a: from_v2_transfer(
                        &params.transfer_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v2_transfer(
                        &params.transfer_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionRewardHarvested: CollectReward, CollectRewardV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::CollectReward(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let reward_index_usize = params.data_reward_index as usize;

            events.push(WhirlpoolEvent::PositionRewardHarvested(
                PositionRewardHarvestedEventPayload {
                    origin: PositionRewardHarvestedEventOrigin::CollectReward,
                    whirlpool: params.key_whirlpool.clone(),
                    position: params.key_position.clone(),
                    position_authority: params.key_position_authority.clone(),
                    reward_index: params.data_reward_index,
                    transfer_reward: from_v1_transfer(
                        params.transfer_amount_0,
                        &new_whirlpool.reward_infos[reward_index_usize].mint,
                        decimals,
                    ),
                },
            ));
        }
        DecodedWhirlpoolInstruction::CollectRewardV2(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            let reward_index_usize = params.data_reward_index as usize;

            events.push(WhirlpoolEvent::PositionRewardHarvested(
                PositionRewardHarvestedEventPayload {
                    origin: PositionRewardHarvestedEventOrigin::CollectRewardV2,
                    whirlpool: params.key_whirlpool.clone(),
                    position: params.key_position.clone(),
                    position_authority: params.key_position_authority.clone(),
                    reward_index: params.data_reward_index,
                    transfer_reward: from_v2_transfer(
                        &params.transfer_0,
                        &new_whirlpool.reward_infos[reward_index_usize].mint,
                        decimals,
                    ),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // ProtocolFeesCollected: CollectProtocolFees, CollectProtocolFeesV2
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::CollectProtocolFees(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::ProtocolFeesCollected(
                ProtocolFeesCollectedEventPayload {
                    origin: ProtocolFeesCollectedEventOrigin::CollectProtocolFees,
                    config: params.key_whirlpools_config.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    collect_protocol_fees_authority: params
                        .key_collect_protocol_fees_authority
                        .clone(),
                    transfer_a: from_v1_transfer(
                        params.transfer_amount_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v1_transfer(
                        params.transfer_amount_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        DecodedWhirlpoolInstruction::CollectProtocolFeesV2(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::ProtocolFeesCollected(
                ProtocolFeesCollectedEventPayload {
                    origin: ProtocolFeesCollectedEventOrigin::CollectProtocolFeesV2,
                    config: params.key_whirlpools_config.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    collect_protocol_fees_authority: params
                        .key_collect_protocol_fees_authority
                        .clone(),
                    transfer_a: from_v2_transfer(
                        &params.transfer_0,
                        &new_whirlpool.token_mint_a,
                        decimals,
                    ),
                    transfer_b: from_v2_transfer(
                        &params.transfer_1,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionOpened: OpenPosition, OpenPositionWithMetadata, OpenBundledPosition, OpenPositionWithTokenExtensions
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::OpenPosition(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PositionOpened(PositionOpenedEventPayload {
                origin: PositionOpenedEventOrigin::OpenPosition,
                whirlpool: params.key_whirlpool.clone(),
                position: params.key_position.clone(),
                lower_tick_index: params.data_tick_lower_index,
                upper_tick_index: params.data_tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_owner.clone(),
                position_type: PositionType::Position,
                position_mint: Some(params.key_position_mint.clone()),
                position_bundle_mint: None,
                position_bundle: None,
                position_bundle_index: None,
            }));
        }
        DecodedWhirlpoolInstruction::OpenPositionWithMetadata(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PositionOpened(PositionOpenedEventPayload {
                origin: PositionOpenedEventOrigin::OpenPositionWithMetadata,
                whirlpool: params.key_whirlpool.clone(),
                position: params.key_position.clone(),
                lower_tick_index: params.data_tick_lower_index,
                upper_tick_index: params.data_tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_owner.clone(),
                position_type: PositionType::Position,
                position_mint: Some(params.key_position_mint.clone()),
                position_bundle_mint: None,
                position_bundle: None,
                position_bundle_index: None,
            }));
        }
        DecodedWhirlpoolInstruction::OpenBundledPosition(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);
            let new_position = get_new_position(accounts, &params.key_bundled_position);

            events.push(WhirlpoolEvent::PositionOpened(PositionOpenedEventPayload {
                origin: PositionOpenedEventOrigin::OpenBundledPosition,
                whirlpool: params.key_whirlpool.clone(),
                position: params.key_bundled_position.clone(),
                lower_tick_index: params.data_tick_lower_index,
                upper_tick_index: params.data_tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_position_bundle_authority.clone(),
                position_type: PositionType::BundledPosition,
                position_mint: None,
                position_bundle_mint: Some(new_position.position_mint.to_string()),
                position_bundle: Some(params.key_position_bundle.clone()),
                position_bundle_index: Some(params.data_bundle_index),
            }));
        }
        DecodedWhirlpoolInstruction::OpenPositionWithTokenExtensions(params) => {
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PositionOpened(PositionOpenedEventPayload {
                origin: PositionOpenedEventOrigin::OpenPositionWithTokenExtensions,
                whirlpool: params.key_whirlpool.clone(),
                position: params.key_position.clone(),
                lower_tick_index: params.data_tick_lower_index,
                upper_tick_index: params.data_tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    params.data_tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_owner.clone(),
                position_type: PositionType::Position,
                position_mint: Some(params.key_position_mint.clone()),
                position_bundle_mint: None,
                position_bundle: None,
                position_bundle_index: None,
            }));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionClosed: ClosePosition, CloseBundledPosition, ClosePositionWithTokenExtensions
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::ClosePosition(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_whirlpool = get_new_whirlpool(accounts, &old_position.whirlpool.to_string());

            events.push(WhirlpoolEvent::PositionClosed(PositionClosedEventPayload {
                origin: PositionClosedEventOrigin::ClosePosition,
                whirlpool: old_position.whirlpool.to_string(),
                position: params.key_position.clone(),
                lower_tick_index: old_position.tick_lower_index,
                upper_tick_index: old_position.tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_position_authority.clone(),
                position_type: PositionType::Position,
                position_mint: Some(params.key_position_mint.clone()),
                position_bundle_mint: None,
                position_bundle: None,
                position_bundle_index: None,
            }));
        }
        DecodedWhirlpoolInstruction::CloseBundledPosition(params) => {
            let old_position =
                get_old_position(writable_account_snapshot, &params.key_bundled_position);
            let new_whirlpool = get_new_whirlpool(accounts, &old_position.whirlpool.to_string());

            events.push(WhirlpoolEvent::PositionClosed(PositionClosedEventPayload {
                origin: PositionClosedEventOrigin::CloseBundledPosition,
                whirlpool: old_position.whirlpool.to_string(),
                position: params.key_bundled_position.clone(),
                lower_tick_index: old_position.tick_lower_index,
                upper_tick_index: old_position.tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_position_bundle_authority.clone(),
                position_type: PositionType::BundledPosition,
                position_mint: None,
                position_bundle_mint: Some(old_position.position_mint.to_string()),
                position_bundle: Some(params.key_position_bundle.clone()),
                position_bundle_index: Some(params.data_bundle_index),
            }));
        }
        DecodedWhirlpoolInstruction::ClosePositionWithTokenExtensions(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_whirlpool = get_new_whirlpool(accounts, &old_position.whirlpool.to_string());

            events.push(WhirlpoolEvent::PositionClosed(PositionClosedEventPayload {
                origin: PositionClosedEventOrigin::ClosePositionWithTokenExtensions,
                whirlpool: old_position.whirlpool.to_string(),
                position: params.key_position.clone(),
                lower_tick_index: old_position.tick_lower_index,
                upper_tick_index: old_position.tick_upper_index,
                lower_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_lower_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                upper_decimal_price: tick_index_to_decimal_price(
                    old_position.tick_upper_index,
                    &new_whirlpool.token_mint_a,
                    &new_whirlpool.token_mint_b,
                    decimals,
                ),
                position_authority: params.key_position_authority.clone(),
                position_type: PositionType::Position,
                position_mint: Some(params.key_position_mint.clone()),
                position_bundle_mint: None,
                position_bundle: None,
                position_bundle_index: None,
            }));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionRangeReset: ResetPositionRange
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::ResetPositionRange(params) => {
            let old_position = get_old_position(writable_account_snapshot, &params.key_position);
            let new_position = get_new_position(accounts, &params.key_position);
            let new_whirlpool = get_new_whirlpool(accounts, &new_position.whirlpool.to_string());

            events.push(WhirlpoolEvent::PositionRangeReset(
                PositionRangeResetEventPayload {
                    origin: PositionRangeResetEventOrigin::ResetPositionRange,
                    whirlpool: new_position.whirlpool.to_string(),
                    position: params.key_position.clone(),
                    old_lower_tick_index: old_position.tick_lower_index,
                    old_upper_tick_index: old_position.tick_upper_index,
                    old_lower_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_lower_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    old_upper_decimal_price: tick_index_to_decimal_price(
                        old_position.tick_upper_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    new_lower_tick_index: new_position.tick_lower_index,
                    new_upper_tick_index: new_position.tick_upper_index,
                    new_lower_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_lower_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    new_upper_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_upper_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    position_authority: params.key_position_authority.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionLocked: LockPosition
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::LockPosition(params) => {
            let new_position = get_new_position(accounts, &params.key_position);
            let new_whirlpool = get_new_whirlpool(accounts, &new_position.whirlpool.to_string());
            let new_lock_config = get_new_lock_config(accounts, &params.key_lock_config);
            
            events.push(WhirlpoolEvent::PositionLocked(
                PositionLockedEventPayload {
                    origin: PositionLockedEventOrigin::LockPosition,
                    whirlpool: new_position.whirlpool.to_string(),
                    position: params.key_position.clone(),
                    lock_type: match params.data_lock_type {
                        replay_engine::decoded_instructions::LockType::Permanent => PositionLockType::Permanent,
                    },
                    lock_config: params.key_lock_config.clone(),
                    lower_tick_index: new_position.tick_lower_index,
                    upper_tick_index: new_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_lower_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_upper_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    locked_liquidity: new_position.liquidity,
                    position_owner: new_lock_config.position_owner.to_string(),
                    position_mint: params.key_position_mint.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionLockedTransferred: TransferLockedPosition
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::TransferLockedPosition(params) => {
            let old_lock_config = get_old_lock_config(writable_account_snapshot, &params.key_lock_config);
            let new_position = get_new_position(accounts, &params.key_position);
            let new_whirlpool = get_new_whirlpool(accounts, &new_position.whirlpool.to_string());
            let new_lock_config = get_new_lock_config(accounts, &params.key_lock_config);

            events.push(WhirlpoolEvent::PositionLockedTransferred(
                PositionLockedTransferredEventPayload {
                    origin: PositionLockedTransferredEventOrigin::TranssferLockedPosition,
                    whirlpool: new_position.whirlpool.to_string(),
                    position: params.key_position.clone(),
                    lock_type: match new_lock_config.lock_type {
                        whirlpool_base::state::LockTypeLabel::Permanent => PositionLockType::Permanent,
                        _ => unreachable!(),
                    },
                    lock_config: params.key_lock_config.clone(),
                    lower_tick_index: new_position.tick_lower_index,
                    upper_tick_index: new_position.tick_upper_index,
                    lower_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_lower_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    upper_decimal_price: tick_index_to_decimal_price(
                        new_position.tick_upper_index,
                        &new_whirlpool.token_mint_a,
                        &new_whirlpool.token_mint_b,
                        decimals,
                    ),
                    locked_liquidity: new_position.liquidity,
                    old_position_owner: old_lock_config.position_owner.to_string(),
                    new_position_owner: new_lock_config.position_owner.to_string(),
                    position_mint: params.key_position_mint.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionBundleInitialized: InitializePositionBundle, InitializePositionBundleWithMetadata
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializePositionBundle(params) => {
            events.push(WhirlpoolEvent::PositionBundleInitialized(
                PositionBundleInitializedEventPayload {
                    origin: PositionBundleInitializedEventOrigin::InitializePositionBundle,
                    position_bundle: params.key_position_bundle.clone(),
                    position_bundle_mint: params.key_position_bundle_mint.clone(),
                    position_bundle_owner: params.key_position_bundle_owner.clone(),
                },
            ));
        }
        DecodedWhirlpoolInstruction::InitializePositionBundleWithMetadata(params) => {
            events.push(WhirlpoolEvent::PositionBundleInitialized(
                PositionBundleInitializedEventPayload {
                    origin:
                        PositionBundleInitializedEventOrigin::InitializePositionBundleWithMetadata,
                    position_bundle: params.key_position_bundle.clone(),
                    position_bundle_mint: params.key_position_bundle_mint.clone(),
                    position_bundle_owner: params.key_position_bundle_owner.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionBundleDeleted: DeletePositionBundle
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::DeletePositionBundle(params) => {
            events.push(WhirlpoolEvent::PositionBundleDeleted(
                PositionBundleDeletedEventPayload {
                    origin: PositionBundleDeletedEventOrigin::DeletePositionBundle,
                    position_bundle: params.key_position_bundle.clone(),
                    position_bundle_mint: params.key_position_bundle_mint.clone(),
                    position_bundle_owner: params.key_position_bundle_owner.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PoolFeeRateUpdated: SetFeeRate
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetFeeRate(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PoolFeeRateUpdated(
                PoolFeeRateUpdatedEventPayload {
                    origin: PoolFeeRateUpdatedEventOrigin::SetFeeRate,
                    config: params.key_whirlpools_config.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    old_fee_rate: old_whirlpool.fee_rate,
                    new_fee_rate: new_whirlpool.fee_rate,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PoolProtocolFeeRateUpdated: SetProtocolFeeRate
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetProtocolFeeRate(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::PoolProtocolFeeRateUpdated(
                PoolProtocolFeeRateUpdatedEventPayload {
                    origin: PoolProtocolFeeRateUpdatedEventOrigin::SetProtocolFeeRate,
                    config: params.key_whirlpools_config.clone(),
                    whirlpool: params.key_whirlpool.clone(),
                    old_protocol_fee_rate: old_whirlpool.protocol_fee_rate,
                    new_protocol_fee_rate: new_whirlpool.protocol_fee_rate,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // TickArrayInitialized: InitializeTickArray
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeTickArray(params) => {
            events.push(WhirlpoolEvent::TickArrayInitialized(
                TickArrayInitializedEventPayload {
                    origin: TickArrayInitializedEventOrigin::InitializeTickArray,
                    whirlpool: params.key_whirlpool.clone(),
                    start_tick_index: params.data_start_tick_index,
                    tick_array: params.key_tick_array.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // ConfigInitialized: InitializeConfig
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeConfig(params) => {
            events.push(WhirlpoolEvent::ConfigInitialized(
                ConfigInitializedEventPayload {
                    origin: ConfigInitializedEventOrigin::InitializeConfig,
                    config: params.key_whirlpools_config.clone(),
                    fee_authority: params.data_fee_authority.clone(),
                    collect_protocol_fees_authority: params
                        .data_collect_protocol_fees_authority
                        .clone(),
                    reward_emissions_super_authority: params
                        .data_reward_emissions_super_authority
                        .clone(),
                    default_protocol_fee_rate: params.data_default_protocol_fee_rate,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // ConfigUpdated: SetCollectProtocolFeesAuthority, SetDefaultProtocolFeeRate, SetFeeAuthority, SetRewardEmissionsSuperAuthority
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetCollectProtocolFeesAuthority(params) => {
            let old_config =
                get_old_config(writable_account_snapshot, &params.key_whirlpools_config);
            let new_config = get_new_config(accounts, &params.key_whirlpools_config);

            events.push(WhirlpoolEvent::ConfigUpdated(ConfigUpdatedEventPayload {
                origin: ConfigUpdatedEventOrigin::SetCollectProtocolFeesAuthority,
                config: params.key_whirlpools_config.clone(),
                old_fee_authority: old_config.fee_authority.to_string(),
                old_collect_protocol_fees_authority: old_config
                    .collect_protocol_fees_authority
                    .to_string(),
                old_reward_emissions_super_authority: old_config
                    .reward_emissions_super_authority
                    .to_string(),
                old_default_protocol_fee_rate: old_config.default_protocol_fee_rate,
                new_fee_authority: new_config.fee_authority.to_string(),
                new_collect_protocol_fees_authority: new_config
                    .collect_protocol_fees_authority
                    .to_string(),
                new_reward_emissions_super_authority: new_config
                    .reward_emissions_super_authority
                    .to_string(),
                new_default_protocol_fee_rate: new_config.default_protocol_fee_rate,
            }));
        }
        DecodedWhirlpoolInstruction::SetDefaultProtocolFeeRate(params) => {
            let old_config =
                get_old_config(writable_account_snapshot, &params.key_whirlpools_config);
            let new_config = get_new_config(accounts, &params.key_whirlpools_config);

            events.push(WhirlpoolEvent::ConfigUpdated(ConfigUpdatedEventPayload {
                origin: ConfigUpdatedEventOrigin::SetDefaultProtocolFeeRate,
                config: params.key_whirlpools_config.clone(),
                old_fee_authority: old_config.fee_authority.to_string(),
                old_collect_protocol_fees_authority: old_config
                    .collect_protocol_fees_authority
                    .to_string(),
                old_reward_emissions_super_authority: old_config
                    .reward_emissions_super_authority
                    .to_string(),
                old_default_protocol_fee_rate: old_config.default_protocol_fee_rate,
                new_fee_authority: new_config.fee_authority.to_string(),
                new_collect_protocol_fees_authority: new_config
                    .collect_protocol_fees_authority
                    .to_string(),
                new_reward_emissions_super_authority: new_config
                    .reward_emissions_super_authority
                    .to_string(),
                new_default_protocol_fee_rate: new_config.default_protocol_fee_rate,
            }));
        }
        DecodedWhirlpoolInstruction::SetFeeAuthority(params) => {
            let old_config =
                get_old_config(writable_account_snapshot, &params.key_whirlpools_config);
            let new_config = get_new_config(accounts, &params.key_whirlpools_config);

            events.push(WhirlpoolEvent::ConfigUpdated(ConfigUpdatedEventPayload {
                origin: ConfigUpdatedEventOrigin::SetFeeAuthority,
                config: params.key_whirlpools_config.clone(),
                old_fee_authority: old_config.fee_authority.to_string(),
                old_collect_protocol_fees_authority: old_config
                    .collect_protocol_fees_authority
                    .to_string(),
                old_reward_emissions_super_authority: old_config
                    .reward_emissions_super_authority
                    .to_string(),
                old_default_protocol_fee_rate: old_config.default_protocol_fee_rate,
                new_fee_authority: new_config.fee_authority.to_string(),
                new_collect_protocol_fees_authority: new_config
                    .collect_protocol_fees_authority
                    .to_string(),
                new_reward_emissions_super_authority: new_config
                    .reward_emissions_super_authority
                    .to_string(),
                new_default_protocol_fee_rate: new_config.default_protocol_fee_rate,
            }));
        }
        DecodedWhirlpoolInstruction::SetRewardEmissionsSuperAuthority(params) => {
            let old_config =
                get_old_config(writable_account_snapshot, &params.key_whirlpools_config);
            let new_config = get_new_config(accounts, &params.key_whirlpools_config);

            events.push(WhirlpoolEvent::ConfigUpdated(ConfigUpdatedEventPayload {
                origin: ConfigUpdatedEventOrigin::SetRewardEmissionsSuperAuthority,
                config: params.key_whirlpools_config.clone(),
                old_fee_authority: old_config.fee_authority.to_string(),
                old_collect_protocol_fees_authority: old_config
                    .collect_protocol_fees_authority
                    .to_string(),
                old_reward_emissions_super_authority: old_config
                    .reward_emissions_super_authority
                    .to_string(),
                old_default_protocol_fee_rate: old_config.default_protocol_fee_rate,
                new_fee_authority: new_config.fee_authority.to_string(),
                new_collect_protocol_fees_authority: new_config
                    .collect_protocol_fees_authority
                    .to_string(),
                new_reward_emissions_super_authority: new_config
                    .reward_emissions_super_authority
                    .to_string(),
                new_default_protocol_fee_rate: new_config.default_protocol_fee_rate,
            }));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // FeeTierInitialized: InitializeFeeTier
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeFeeTier(params) => {
            events.push(WhirlpoolEvent::FeeTierInitialized(
                FeeTierInitializedEventPayload {
                    origin: FeeTierInitializedEventOrigin::InitializeFeeTier,
                    config: params.key_whirlpools_config.clone(),
                    tick_spacing: params.data_tick_spacing,
                    fee_tier: params.key_fee_tier.clone(),
                    default_fee_rate: params.data_default_fee_rate,
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // FeeTierUpdated: SetDefaultFeeRate
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetDefaultFeeRate(params) => {
            let old_fee_tier = get_old_fee_tier(writable_account_snapshot, &params.key_fee_tier);
            let new_fee_tier = get_new_fee_tier(accounts, &params.key_fee_tier);

            events.push(WhirlpoolEvent::FeeTierUpdated(FeeTierUpdatedEventPayload {
                origin: FeeTierUpdatedEventOrigin::SetDefaultFeeRate,
                config: params.key_whirlpools_config.clone(),
                tick_spacing: old_fee_tier.tick_spacing,
                fee_tier: params.key_fee_tier.clone(),
                old_default_fee_rate: old_fee_tier.default_fee_rate,
                new_default_fee_rate: new_fee_tier.default_fee_rate,
            }));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // RewardAuthorityUpdated: SetRewardAuthority, SetRewardAuthorityBySuperAuthority
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetRewardAuthority(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);
            let reward_index_usize = params.data_reward_index as usize;

            events.push(WhirlpoolEvent::RewardAuthorityUpdated(
                RewardAuthorityUpdatedEventPayload {
                    origin: RewardAuthorityUpdatedEventOrigin::SetRewardAuthority,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    old_reward_authority: old_whirlpool.reward_infos[reward_index_usize]
                        .authority
                        .to_string(),
                    new_reward_authority: new_whirlpool.reward_infos[reward_index_usize]
                        .authority
                        .to_string(),
                },
            ));
        }
        DecodedWhirlpoolInstruction::SetRewardAuthorityBySuperAuthority(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);
            let reward_index_usize = params.data_reward_index as usize;

            events.push(WhirlpoolEvent::RewardAuthorityUpdated(
                RewardAuthorityUpdatedEventPayload {
                    origin: RewardAuthorityUpdatedEventOrigin::SetRewardAuthorityBySuperAuthority,
                    whirlpool: params.key_whirlpool.clone(),
                    reward_index: params.data_reward_index,
                    old_reward_authority: old_whirlpool.reward_infos[reward_index_usize]
                        .authority
                        .to_string(),
                    new_reward_authority: new_whirlpool.reward_infos[reward_index_usize]
                        .authority
                        .to_string(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // ConfigExtensionInitialized: InitializeConfigExtension
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeConfigExtension(params) => {
            let new_config_extension =
                get_new_config_extension(accounts, &params.key_whirlpools_config_extension);

            events.push(WhirlpoolEvent::ConfigExtensionInitialized(
                ConfigExtensionInitializedEventPayload {
                    origin: ConfigExtensionInitializedEventOrigin::InitializeConfigExtension,
                    config: params.key_whirlpools_config.clone(),
                    config_extension: params.key_whirlpools_config_extension.clone(),
                    config_extension_authority: new_config_extension
                        .config_extension_authority
                        .to_string(),
                    token_badge_authority: new_config_extension.token_badge_authority.to_string(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // ConfigExtensionUpdated: SetConfigExtensionAuthority, SetTokenBadgeAuthority
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::SetConfigExtensionAuthority(params) => {
            let old_config_extension = get_old_config_extension(
                writable_account_snapshot,
                &params.key_whirlpools_config_extension,
            );
            let new_config_extension =
                get_new_config_extension(accounts, &params.key_whirlpools_config_extension);

            events.push(WhirlpoolEvent::ConfigExtensionUpdated(
                ConfigExtensionUpdatedEventPayload {
                    origin: ConfigExtensionUpdatedEventOrigin::SetConfigExtensionAuthority,
                    config: params.key_whirlpools_config.clone(),
                    config_extension: params.key_whirlpools_config_extension.clone(),
                    old_config_extension_authority: old_config_extension
                        .config_extension_authority
                        .to_string(),
                    new_config_extension_authority: new_config_extension
                        .config_extension_authority
                        .to_string(),
                    old_token_badge_authority: old_config_extension
                        .token_badge_authority
                        .to_string(),
                    new_token_badge_authority: new_config_extension
                        .token_badge_authority
                        .to_string(),
                },
            ));
        }
        DecodedWhirlpoolInstruction::SetTokenBadgeAuthority(params) => {
            let old_config_extension = get_old_config_extension(
                writable_account_snapshot,
                &params.key_whirlpools_config_extension,
            );
            let new_config_extension =
                get_new_config_extension(accounts, &params.key_whirlpools_config_extension);

            events.push(WhirlpoolEvent::ConfigExtensionUpdated(
                ConfigExtensionUpdatedEventPayload {
                    origin: ConfigExtensionUpdatedEventOrigin::SetTokenBadgeAuthority,
                    config: params.key_whirlpools_config.clone(),
                    config_extension: params.key_whirlpools_config_extension.clone(),
                    old_config_extension_authority: old_config_extension
                        .config_extension_authority
                        .to_string(),
                    new_config_extension_authority: new_config_extension
                        .config_extension_authority
                        .to_string(),
                    old_token_badge_authority: old_config_extension
                        .token_badge_authority
                        .to_string(),
                    new_token_badge_authority: new_config_extension
                        .token_badge_authority
                        .to_string(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // TokenBadgeInitialized: InitializeTokenBadge
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::InitializeTokenBadge(params) => {
            events.push(WhirlpoolEvent::TokenBadgeInitialized(
                TokenBadgeInitializedEventPayload {
                    origin: TokenBadgeInitializedEventOrigin::InitializeTokenBadge,
                    config: params.key_whirlpools_config.clone(),
                    config_extension: params.key_whirlpools_config_extension.clone(),
                    token_mint: params.key_token_mint.clone(),
                    token_badge: params.key_token_badge.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // TokenBadgeDeleted: DeleteTokenBadge
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::DeleteTokenBadge(params) => {
            events.push(WhirlpoolEvent::TokenBadgeDeleted(
                TokenBadgeDeletedEventPayload {
                    origin: TokenBadgeDeletedEventOrigin::DeleteTokenBadge,
                    config: params.key_whirlpools_config.clone(),
                    config_extension: params.key_whirlpools_config_extension.clone(),
                    token_mint: params.key_token_mint.clone(),
                    token_badge: params.key_token_badge.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // PositionHarvestUpdated: UpdateFeesAndRewards
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::UpdateFeesAndRewards(params) => {
            events.push(WhirlpoolEvent::PositionHarvestUpdated(
                PositionHarvestUpdatedEventPayload {
                    origin: PositionHarvestUpdatedEventOrigin::UpdateFeesAndRewards,
                    whirlpool: params.key_whirlpool.clone(),
                    position: params.key_position.clone(),
                },
            ));
        }
        ////////////////////////////////////////////////////////////////////////////////
        // LiquidityPatched: AdminIncreaseLiquidity
        ////////////////////////////////////////////////////////////////////////////////
        DecodedWhirlpoolInstruction::AdminIncreaseLiquidity(params) => {
            let old_whirlpool = get_old_whirlpool(writable_account_snapshot, &params.key_whirlpool);
            let new_whirlpool = get_new_whirlpool(accounts, &params.key_whirlpool);

            events.push(WhirlpoolEvent::LiquidityPatched(
                LiquidityPatchedEventPayload {
                    origin: LiquidityPatchedEventOrigin::AdminIncreaseLiquidity,
                    liquidity_delta: params.data_liquidity,
                    whirlpool: params.key_whirlpool.clone(),
                    old_whirlpool_liquidity: old_whirlpool.liquidity,
                    new_whirlpool_liquidity: new_whirlpool.liquidity,
                },
            ));
        }
    }

    events
}

fn get_decimals(mint: &PubkeyString, decimals: &HashMap<String, u8>) -> u8 {
    *decimals.get(mint).unwrap()
}

fn from_v1_transfer(
    amount: u64,
    mint: &Pubkey,
    decimals_map: &HashMap<String, u8>,
) -> TransferInfo {
    let mint = mint.to_string();
    let decimals = *decimals_map.get(&mint).unwrap();
    TransferInfo {
        mint,
        amount,
        decimals,
        transfer_fee_bps: None,
        transfer_fee_max: None,
    }
}

fn from_v2_transfer(
    transfer: &TransferAmountWithTransferFeeConfig,
    mint: &Pubkey,
    decimals_map: &HashMap<String, u8>,
) -> TransferInfo {
    let mint = mint.to_string();
    let decimals = *decimals_map.get(&mint).unwrap();
    TransferInfo {
        mint,
        amount: transfer.amount,
        decimals,
        transfer_fee_bps: if transfer.transfer_fee_config_opt {
            Some(transfer.transfer_fee_config_bps)
        } else {
            None
        },
        transfer_fee_max: if transfer.transfer_fee_config_opt {
            Some(transfer.transfer_fee_config_max)
        } else {
            None
        },
    }
}

fn get_token_program(token_program_id: &PubkeyString) -> TokenProgram {
    if token_program_id == "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" {
        TokenProgram::Token
    } else if token_program_id == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" {
        TokenProgram::Token2022
    } else {
        panic!("unknown token program key: {}", token_program_id);
    }
}

fn get_old_whirlpool(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> Whirlpool {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    Whirlpool::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_whirlpool(accounts: &AccountDataStore, pubkey: &PubkeyString) -> Whirlpool {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    Whirlpool::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn get_old_position(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> Position {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    Position::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_position(accounts: &AccountDataStore, pubkey: &PubkeyString) -> Position {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    Position::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn get_old_config(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> WhirlpoolsConfig {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    WhirlpoolsConfig::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_config(accounts: &AccountDataStore, pubkey: &PubkeyString) -> WhirlpoolsConfig {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    WhirlpoolsConfig::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn get_old_fee_tier(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> FeeTier {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    FeeTier::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_fee_tier(accounts: &AccountDataStore, pubkey: &PubkeyString) -> FeeTier {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    FeeTier::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn get_old_config_extension(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> WhirlpoolsConfigExtension {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    WhirlpoolsConfigExtension::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_config_extension(
    accounts: &AccountDataStore,
    pubkey: &PubkeyString,
) -> WhirlpoolsConfigExtension {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    WhirlpoolsConfigExtension::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn get_old_lock_config(
    writable_account_snapshot: &WritableAccountSnapshot,
    pubkey: &PubkeyString,
) -> LockConfig {
    let pre_data = writable_account_snapshot.pre_snapshot.get(pubkey).unwrap();
    LockConfig::try_deserialize(&mut pre_data.as_slice()).unwrap()
}

fn get_new_lock_config(
    accounts: &AccountDataStore,
    pubkey: &PubkeyString,
) -> LockConfig {
    let post_data = accounts.get(pubkey).unwrap().unwrap();
    LockConfig::try_deserialize(&mut post_data.as_slice()).unwrap()
}

fn tick_index_to_decimal_price(
    tick_index: i32,
    mint_a: &Pubkey,
    mint_b: &Pubkey,
    decimals_map: &HashMap<String, u8>,
) -> DecimalPrice {
    let sqrt_price = sqrt_price_from_tick_index(tick_index);
    sqrt_price_to_decimal_price(sqrt_price, mint_a, mint_b, decimals_map)
}

static X64: std::sync::OnceLock<BigDecimal> = std::sync::OnceLock::new();
fn sqrt_price_to_decimal_price(
    sqrt_price: u128,
    mint_a: &Pubkey,
    mint_b: &Pubkey,
    decimals_map: &HashMap<String, u8>,
) -> DecimalPrice {
    let x64 = X64.get_or_init(|| BigDecimal::from(1u128 << 64));
    let price = (BigDecimal::from(sqrt_price) / x64).square();

    let decimals_a = i64::from(*decimals_map.get(&mint_a.to_string()).unwrap());
    let decimals_b = i64::from(*decimals_map.get(&mint_b.to_string()).unwrap());

    let (i, scale) = price.as_bigint_and_exponent();
    BigDecimal::new(i, scale - (decimals_a - decimals_b))
}
