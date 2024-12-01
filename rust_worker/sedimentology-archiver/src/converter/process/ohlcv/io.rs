use anyhow::Result;
use flate2::read::GzDecoder;
use std::{
  collections::HashMap,
  fs::File,
  io::{BufRead, BufReader},
};
use super::super::super::model::event::WhirlpoolEventBlock;
use whirlpool_replayer::{schema::WhirlpoolState, serde::AccountDataStoreConfig};

pub fn build_with_local_file_storage(
  whirlpool_state_file_path: String,
  whirlpool_token_file_path: String,
  whirlpool_event_file_path: String,
  account_data_store_config: &AccountDataStoreConfig,
) -> (
  WhirlpoolState,
  Box<dyn Iterator<Item = WhirlpoolEventBlock> + Send>,
  HashMap<String, u8>,
) {
  let state = whirlpool_replayer::io::load_from_local_whirlpool_state_file(
      &whirlpool_state_file_path,
      account_data_store_config,
  );
  let token =
      whirlpool_replayer::io::load_from_local_whirlpool_token_file(&whirlpool_token_file_path);
  let event_iter = load_from_local_whirlpool_event_file(
      &whirlpool_event_file_path,
  );

  let decimals = token
      .tokens
      .iter()
      .map(|t| (t.mint.clone(), t.decimals))
      .collect();

  (state, Box::new(event_iter), decimals)
}

fn load_from_local_whirlpool_event_file(
  whirlpool_event_file_path: &str,
) -> impl Iterator<Item = WhirlpoolEventBlock> {
  let file = File::open(whirlpool_event_file_path).unwrap();

  let decoder = GzDecoder::new(file);
  let buf = BufReader::new(decoder);

  let iter = buf.lines().map(|jsonl| jsonl.unwrap()).map(|jsonl| {
      let t: Result<WhirlpoolEventBlock, serde_json::Error> =
          serde_json::from_str(jsonl.as_str());
      t.unwrap()
  });

  iter
}
