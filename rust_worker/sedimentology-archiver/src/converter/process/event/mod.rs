use super::super::model::event::{
  convert::build_whirlpool_events, definition::ProgramDeployedEventPayload, WhirlpoolEvent,
  WhirlpoolEventBlock, WhirlpoolEventTransaction,
};
use anyhow::Result;
use flate2::write::GzEncoder;
use replay_engine::decoded_instructions;
use std::{fs::File, io::LineWriter, io::Write};
use whirlpool_replayer::{serde::AccountDataStoreConfig, Slot};

mod io;

pub async fn process(
  in_whirlpool_state_file_path: String,
  in_whirlpool_token_file_path: String,
  in_whirlpool_transaction_file_path: String,
  out_whirlpool_event_file_path: String,
) -> Result<()> {
  let f = File::create(out_whirlpool_event_file_path).unwrap();
  let encoder = GzEncoder::new(f, flate2::Compression::default());
  let mut writer = LineWriter::new(encoder);

  // build replayer
  let (mut replay_engine, mut transaction_iter, decimals) = io::build_with_local_file_storage(
      in_whirlpool_state_file_path,
      in_whirlpool_token_file_path,
      in_whirlpool_transaction_file_path,
      &AccountDataStoreConfig::OnDisk(None),
  );

  let mut next_whirlpool_transaction = transaction_iter.next();
  while next_whirlpool_transaction.is_some() {
      let whirlpool_transaction = next_whirlpool_transaction.unwrap();

      let slot = Slot {
          slot: whirlpool_transaction.slot,
          block_height: whirlpool_transaction.block_height,
          block_time: whirlpool_transaction.block_time,
      };

      replay_engine.update_slot(slot.slot, slot.block_height, slot.block_time);

      let mut event_block_transactions: Vec<WhirlpoolEventTransaction> = Vec::new();

      for transaction in whirlpool_transaction.transactions {
          let mut events: Vec<WhirlpoolEvent> = vec![];

          for instruction in transaction.clone().instructions {
              let name = instruction.name;
              let payload = instruction.payload.to_string();
              let decoded = decoded_instructions::from_json(&name, &payload).unwrap();

              match decoded {
                  decoded_instructions::DecodedInstruction::ProgramDeployInstruction(
                      deploy_instruction,
                  ) => {
                      replay_engine.update_program_data(deploy_instruction.program_data);

                      events.push(WhirlpoolEvent::ProgramDeployed(
                          ProgramDeployedEventPayload {},
                      ));
                  }
                  decoded_instructions::DecodedInstruction::WhirlpoolInstruction(
                      whirlpool_instruction,
                  ) => {
                      let result = replay_engine
                          .replay_instruction(&whirlpool_instruction)
                          .unwrap();

                      events.extend(build_whirlpool_events(
                          &whirlpool_instruction,
                          &decimals,
                          replay_engine.get_accounts(),
                          &result.snapshot,
                      ));
                  }
              }
          }

          event_block_transactions.push(WhirlpoolEventTransaction {
              signature: transaction.signature,
              payer: transaction.payer,
              events,
          });
      }

      let event_block = WhirlpoolEventBlock {
          slot: whirlpool_transaction.slot,
          block_height: whirlpool_transaction.block_height,
          block_time: whirlpool_transaction.block_time,
          transactions: event_block_transactions,
      };

      let jsonl = serde_json::to_string(&event_block).unwrap();
      writer.write_all(jsonl.as_bytes()).unwrap();
      writer.write_all(b"\n").unwrap();

      next_whirlpool_transaction = transaction_iter.next();
  }

  writer.flush().unwrap();

  Ok(())
}
