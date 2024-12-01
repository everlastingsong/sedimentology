use super::super::model::{event::WhirlpoolEvent, ohlcv};
use anchor_lang::Discriminator;
use anyhow::Result;
use flate2::write::GzEncoder;
use std::{
  fs::File, io::LineWriter, io::Write,
};
use whirlpool_replayer::serde::AccountDataStoreConfig;
use anchor_lang::AccountDeserialize;

mod io;
mod data;

pub async fn process(
  in_whirlpool_state_file_path: String,
  in_whirlpool_token_file_path: String,
  in_whirlpool_event_file_path: String,
  out_whirlpool_ohlcv_daily_file_path: String,
  out_whirlpool_ohlcv_minutely_file_path: String,
) -> Result<()> {
  println!("open files...");
  let (state, event_block_iter, decimals) = io::build_with_local_file_storage(
    in_whirlpool_state_file_path,
    in_whirlpool_token_file_path,
    in_whirlpool_event_file_path,
    &AccountDataStoreConfig::OnDisk(None),
  );

  // state is at the end of yesterday
  let seconds_per_day = 60 * 60 * 24;
  let yesterday_timestamp = state.block_time / seconds_per_day * seconds_per_day;
  let daily_timestamp = yesterday_timestamp + seconds_per_day;

  let mut ohlcv_data_manager = data::OhlcvDataManager::new(daily_timestamp);

  println!("traverse accounts...");
  state.accounts.traverse(|pubkey, data| {
    if data.starts_with(&whirlpool_base::state::Whirlpool::DISCRIMINATOR) {
      let whirlpool = whirlpool_base::state::Whirlpool::try_deserialize(&mut data.as_slice()).unwrap();
      let mint_a = whirlpool.token_mint_a.to_string();
      let mint_b = whirlpool.token_mint_b.to_string();
      let decimals_a = *decimals.get(&mint_a).unwrap();
      let decimals_b = *decimals.get(&mint_b).unwrap();
      ohlcv_data_manager.initialize_with_previous_close(data::Metadata {
        whirlpool: pubkey.to_string(),
        whirlpools_config: whirlpool.whirlpools_config.to_string(),
        mint_a,
        mint_b,
        tick_spacing: whirlpool.tick_spacing,
        decimals_a,
        decimals_b,
      }, whirlpool.sqrt_price);
    }
    Ok(())
  })?;

  println!("process events...");
  for event_block in event_block_iter {
    event_block.transactions.iter().for_each(|transaction| {
      transaction.events.iter().for_each(|event| {
        match event {
          WhirlpoolEvent::Traded(traded) => {
            ohlcv_data_manager.process_traded_event(event_block.block_time, traded);
          }
          WhirlpoolEvent::PoolInitialized(pool_initialized) => {
            ohlcv_data_manager.process_pool_initialized_event(event_block.slot, event_block.block_time, pool_initialized);
          }
          _ => { /* ignore */ }
        }
      });
    });
  }

  // write daily file
  println!("write daily file...");
  let f = File::create(out_whirlpool_ohlcv_daily_file_path).unwrap();
  let encoder = GzEncoder::new(f, flate2::Compression::default());
  let mut writer = LineWriter::new(encoder);
  ohlcv_data_manager.data.values().map(ohlcv::WhirlpoolOhlcvDailyData::from).for_each(|data| {
    let jsonl = serde_json::to_string(&data).unwrap();
    writer.write_all(jsonl.as_bytes()).unwrap();
    writer.write_all(b"\n").unwrap();
  });
  writer.flush().unwrap();

  // write minutely file
  println!("write minutely file...");
  let f = File::create(out_whirlpool_ohlcv_minutely_file_path).unwrap();
  let encoder = GzEncoder::new(f, flate2::Compression::default());
  let mut writer = LineWriter::new(encoder);
  ohlcv_data_manager.data.values().map(ohlcv::WhirlpoolOhlcvMinutelyData::from).for_each(|data| {
    let jsonl = serde_json::to_string(&data).unwrap();
    writer.write_all(jsonl.as_bytes()).unwrap();
    writer.write_all(b"\n").unwrap();
  });
  writer.flush().unwrap();

  Ok(())
}
