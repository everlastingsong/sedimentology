use replay_engine::replay_engine::ReplayEngine;
use std::collections::HashMap;
use whirlpool_replayer::{schema::WhirlpoolTransaction, serde::AccountDataStoreConfig, Slot};

pub fn build_with_local_file_storage(
    whirlpool_state_file_path: String,
    whirlpool_token_file_path: String,
    whirlpool_transaction_file_path: String,
    account_data_store_config: &AccountDataStoreConfig,
) -> (
    ReplayEngine,
    Box<dyn Iterator<Item = WhirlpoolTransaction> + Send>,
    HashMap<String, u8>,
) {
    let state = whirlpool_replayer::io::load_from_local_whirlpool_state_file(
        &whirlpool_state_file_path,
        account_data_store_config,
    );
    let token =
        whirlpool_replayer::io::load_from_local_whirlpool_token_file(&whirlpool_token_file_path);
    let transaction_iter = whirlpool_replayer::io::load_from_local_whirlpool_transaction_file(
        &whirlpool_transaction_file_path,
    );

    let replay_engine = ReplayEngine::new(
        Slot::new(state.slot, state.block_height, state.block_time),
        state.program_data,
        state.accounts,
    );

    let decimals = token
        .tokens
        .iter()
        .map(|t| (t.mint.clone(), t.decimals))
        .collect();

    (replay_engine, Box::new(transaction_iter), decimals)
}
