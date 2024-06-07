use std::thread::sleep;
use std::time::Duration;
use ctrlc;
use replay_engine::types::Slot;
use std::sync::mpsc::channel;
use chrono::{Utc, TimeZone};

use mysql::*;
use clap::Parser;

use replay_engine::replay_engine::ReplayEngine;
use replay_engine::decoded_instructions::DecodedInstruction::{ProgramDeployInstruction, WhirlpoolInstruction};

mod io;
mod date;

#[derive(Parser, Debug)]
struct Args {
    #[clap(long, id = "mariadb-host", default_value = "localhost")]
    mariadb_host: Option<String>,

    #[clap(long, id = "mariadb-port", default_value = "3306")]
    mariadb_port: Option<u16>,

    #[clap(long, id = "mariadb-user", default_value = "root")]
    mariadb_user: Option<String>,

    #[clap(long, id = "mariadb-password", default_value = "password")]
    mariadb_password: Option<String>,

    #[clap(long, id = "mariadb-database", default_value = "whirlpool")]
    mariadb_database: Option<String>,
}

fn main() {
    // connect to mariadb
    let args = Args::parse();
    let mariadb_url = format!("mysql://{}:{}@{}:{}/{}",
                      args.mariadb_user.unwrap(),
                      args.mariadb_password.unwrap(),
                      args.mariadb_host.unwrap(),
                      args.mariadb_port.unwrap(),
                      args.mariadb_database.unwrap());
    let pool = Pool::new(mariadb_url.as_str()).unwrap();
    let mut conn = pool.get_conn().unwrap();

    // initial state loading
    let initial_latest_replayed_date = io::fetch_latest_replayed_date(&mut conn);
    println!("latest_replayed_date = {}", initial_latest_replayed_date);

    let state = io::fetch_state(initial_latest_replayed_date, &mut conn);
    let initial_slot = state.slot;
    println!("state.slot = {:?}", state.slot);
    println!("state.block_height = {:?}", state.block_height);
    println!("state.block_time = {:?}", state.block_time);
    println!("state.program_data = {:?}", state.program_data.len());
    println!("state.accounts");

    // build replay engine
    let mut replay_engine = ReplayEngine::new(
        Slot::new(
            state.slot,
            state.block_height,
            state.block_time,
        ),
        state.program_data,
        state.accounts,
    );

    // setup handler for graceful shutdown
    let (tx, rx) = channel();
    ctrlc::set_handler(move || {
        println!("received Ctrl-C!");
        tx.send(()).unwrap();
    }).expect("Error setting Ctrl-C handler");

    // replay loop
    let fetch_chunk_size = 1024u16;
    let sleep_duration = Duration::from_secs(10);
    loop {
        // graceful shutdown
        let should_shutdown = rx.try_recv().is_ok();
        if should_shutdown {
            println!("shutting down ...");
            break;
        }

        // fetch next slots
        println!("fetching next slots start_slot = {}({}) ...",
            replay_engine.get_slot().slot,
            Utc.timestamp_opt(replay_engine.get_slot().block_time, 0).unwrap().format("%Y/%m/%d %T").to_string()
        );

        let mut next_slots = io::fetch_next_slot_infos(replay_engine.get_slot().slot, fetch_chunk_size, &mut conn);
        let is_full_fetch = next_slots.len() == fetch_chunk_size as usize;

        assert_eq!(next_slots[0].slot, replay_engine.get_slot().slot);
        next_slots.remove(0);

        if next_slots.len() == 0 {
            println!("no more slots to replay now");
        } else {
            println!("replaying {} slots ...", next_slots.len());
        }

        // process each slot
        for slot in next_slots {
            assert!(slot.block_height == replay_engine.get_slot().block_height + 1, "block_height is not sequential!");

            // save state if date is changing
            let current_unixtime_date = date::truncate_unixtime_to_date(replay_engine.get_slot().block_time);
            let next_unixtime_date = date::truncate_unixtime_to_date(slot.block_time);
            if current_unixtime_date != next_unixtime_date && replay_engine.get_slot().slot > initial_slot {
                assert!(date::is_next_date(current_unixtime_date, next_unixtime_date), "date is not sequential!");

                let current_yyyymmdd_date = date::convert_unixtime_to_yyyymmdd(current_unixtime_date);
                let next_yyyymmdd_date = date::convert_unixtime_to_yyyymmdd(next_unixtime_date);

                println!("changing date from {}({}) to {}({})",
                    current_yyyymmdd_date,
                    current_unixtime_date,
                    next_yyyymmdd_date,
                    next_unixtime_date
                );

                println!("saving state of {} ...", current_yyyymmdd_date);
                println!("last slot of {} is {:?}", current_yyyymmdd_date, replay_engine.get_slot());

                io::advance_replayer_state(
                    current_yyyymmdd_date,
                    replay_engine.get_slot(),
                    replay_engine.get_program_data(),
                    replay_engine.get_accounts(),
                    &mut conn
                ).unwrap();

                println!("saved state of {}", current_yyyymmdd_date);
            }

            // replay instructions in the slot
            let ixs_in_slot = io::fetch_instructions_in_slot(slot.slot, &mut conn);
            replay_engine.update_slot(slot.slot, slot.block_height, slot.block_time);
            for ix in ixs_in_slot {
                match ix.ix {
                    ProgramDeployInstruction(deploy_instruction) => {
                        replay_engine.update_program_data(deploy_instruction.program_data);
                    }
                    WhirlpoolInstruction(whirlpool_instruction) => {
                        replay_engine.replay_instruction(&whirlpool_instruction).unwrap();
                    }
                }
            }
        }

        if !is_full_fetch {
            println!("sleeping for {} seconds ...", sleep_duration.as_secs());
            sleep(sleep_duration);
        }
    }
}
