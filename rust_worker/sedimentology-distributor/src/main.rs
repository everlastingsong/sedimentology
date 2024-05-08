use std::thread::sleep;
use std::time::Duration;
use ctrlc;
use std::sync::mpsc::channel;
use chrono::{Utc, TimeZone};

use mysql::*;
use clap::Parser;

mod io;
mod schema;

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

    #[clap(long, id = "distributor-mariadb-host", default_value = "localhost")]
    distributor_mariadb_host: Option<String>,

    #[clap(long, id = "distributor-mariadb-port", default_value = "3306")]
    distributor_mariadb_port: Option<u16>,

    #[clap(long, id = "distributor-mariadb-user", default_value = "root")]
    distributor_mariadb_user: Option<String>,

    #[clap(long, id = "distributor-mariadb-password", default_value = "password")]
    distributor_mariadb_password: Option<String>,

    #[clap(long, id = "distributor-mariadb-database", default_value = "whirlpool")]
    distributor_mariadb_database: Option<String>,

    // 648000 = 2.5 * 3600 * 24 * 3 (at least 3 days)
    // 10KB/message * 648000 = 6,480,000 KB
    #[clap(long, id = "keep-block-height", default_value = "648000")]
    keep_block_height: Option<u64>
}

fn main() {
    // connect to mariadb and distributor mariadb
    let args = Args::parse();
    let mariadb_url = format!("mysql://{}:{}@{}:{}/{}",
                      args.mariadb_user.unwrap(),
                      args.mariadb_password.unwrap(),
                      args.mariadb_host.unwrap(),
                      args.mariadb_port.unwrap(),
                      args.mariadb_database.unwrap());
    let pool = Pool::new(mariadb_url.as_str()).unwrap();
    let mut conn = pool.get_conn().unwrap();

    let distributor_mariadb_url = format!("mysql://{}:{}@{}:{}/{}",
                      args.distributor_mariadb_user.unwrap(),
                      args.distributor_mariadb_password.unwrap(),
                      args.distributor_mariadb_host.unwrap(),
                      args.distributor_mariadb_port.unwrap(),
                      args.distributor_mariadb_database.unwrap());
    let distributor_pool = Pool::new(distributor_mariadb_url.as_str()).unwrap();
    let mut distributor_conn = distributor_pool.get_conn().unwrap();

    let keep_block_height = args.keep_block_height.unwrap();

    // initial state loading
    let (initial_latest_distributed_slot, initial_latest_distributed_block_height) = io::fetch_latest_distributed_slot(&mut distributor_conn);
    println!("latest_distributed_slot = {}", initial_latest_distributed_slot);

    // setup handler for graceful shutdown
    let (tx, rx) = channel();
    ctrlc::set_handler(move || {
        println!("received Ctrl-C!");
        tx.send(()).unwrap();
    }).expect("Error setting Ctrl-C handler");

    let mut latest_distributed_slot = io::fetch_slot_info(initial_latest_distributed_slot, &mut conn);
    assert_eq!(latest_distributed_slot.slot, initial_latest_distributed_slot);
    assert_eq!(latest_distributed_slot.block_height, initial_latest_distributed_block_height);

    // distributor loop
    let fetch_chunk_size = 192u16; // > 2.5 * 60 (blocks per minute)
    let sleep_duration = Duration::from_millis(500);
    loop {
        // graceful shutdown
        let should_shutdown = rx.try_recv().is_ok();
        if should_shutdown {
            println!("shutting down ...");
            break;
        }

        // fetch next slots
        println!("fetching next slots start_slot = {}({}) ...",
            latest_distributed_slot.slot,
            Utc.timestamp_opt(latest_distributed_slot.block_time, 0).unwrap().format("%Y/%m/%d %T").to_string()
        );

        let mut next_slots = io::fetch_next_slot_infos(latest_distributed_slot.slot, fetch_chunk_size, &mut conn);
        let is_full_fetch = next_slots.len() == fetch_chunk_size as usize;

        assert_eq!(next_slots[0].slot, latest_distributed_slot.slot);
        next_slots.remove(0);

        if next_slots.len() == 0 {
            println!("no more slots to distribute now");
        } else {
            println!("distributing {} slots ...", next_slots.len());

            let transactions = io::fetch_transactions(&next_slots, &mut conn);

            let block_height_delta = transactions.last().unwrap().0.block_height - transactions.first().unwrap().0.block_height;
            assert_eq!(block_height_delta, u64::try_from(transactions.len()).unwrap() - 1);

            let next_latest_distributed_slot = transactions.last().unwrap().0;

            io::advance_distributor_state(&transactions, keep_block_height, &mut distributor_conn).unwrap();

            latest_distributed_slot = next_latest_distributed_slot;
        }

        if !is_full_fetch {
            println!("sleeping for {} ms ...", sleep_duration.as_millis());
            sleep(sleep_duration);
        }
    }
}
