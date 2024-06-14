use std::borrow::Cow;
use std::path::PathBuf;
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
    #[clap(long, id = "profile")]
    profile: String,

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

    #[clap(long, id = "dest-mariadb-host", default_value = "localhost")]
    dest_mariadb_host: Option<String>,

    #[clap(long, id = "dest-mariadb-port", default_value = "3306")]
    dest_mariadb_port: Option<u16>,

    #[clap(long, id = "dest-mariadb-user", default_value = "distributor")]
    dest_mariadb_user: Option<String>,

    #[clap(long, id = "dest-mariadb-password", default_value = "password")]
    dest_mariadb_password: Option<String>,

    #[clap(long, id = "dest-mariadb-database", default_value = "sedimentology")]
    dest_mariadb_database: Option<String>,

    // 648000 = 2.5 * 3600 * 24 * 3 (at least 3 days)
    // 10KB/slot * 648000 = 6,480,000 KB ~ 6.33 GB
    #[clap(long, id = "keep-block-height", default_value = "648000")]
    keep_block_height: Option<u64>,

    // acceptable combination:
    // --ssl --client-cert-path <path> --client-key-path <path>
    // --ssl --client-cert-path <path> --client-key-path <path> --root-cert-path <path>
    #[clap(long, id = "ssl", requires_all = ["client-cert-path", "client-key-path"])]
    ssl: bool,

    // must be DER file format
    // convert from PEM: openssl x509 -in ca-cert.pem -outform der -out ca-cert.der
    #[clap(long, id = "root-cert-path", requires = "ssl", help = "file format must be DER")]
    root_cert_path: Option<String>,

    // must be DER file format
    // convert from PEM:  openssl x509 -in cert.pem -outform der -out cert.der
    #[clap(long, id = "client-cert-path", requires = "ssl", help = "file format must be DER")]
    client_cert_path: Option<String>,

    // must be DER file format
    // convert from PEM: openssl rsa -in key.pem -outform der -out key.der
    #[clap(long, id = "client-key-path", requires = "ssl", help = "file format must be DER")]
    client_key_path: Option<String>,
}

const FETCH_CHUNK_SIZE: u16 = 192; // > 2.5 * 60 (blocks per minute)

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

    // connect to dest mariadb (with SSL if params provided)
    let mut dest_mariadb_opts_builder = OptsBuilder::new();
    dest_mariadb_opts_builder = dest_mariadb_opts_builder
        .ip_or_hostname(Some(args.dest_mariadb_host.unwrap()))
        .tcp_port(args.dest_mariadb_port.unwrap())
        .user(Some(args.dest_mariadb_user.unwrap()))
        .pass(Some(args.dest_mariadb_password.unwrap()))
        .db_name(Some(args.dest_mariadb_database.unwrap()))
        // large data will be compressed using zstd, so not use compression on mariadb connection
        .compress(Some(Compression::new(0)));
    if args.ssl {
        // client authentication is must if SSL is used
        let client_cert_path = Cow::Owned(PathBuf::from(args.client_cert_path.unwrap()));
        let client_key_path = Cow::Owned(PathBuf::from(args.client_key_path.unwrap()));
        let identity = ClientIdentity::new(
            client_cert_path,
            client_key_path,
        );

        let root_cert_path = if let Some(root_cert_path) = args.root_cert_path {
            Some(Cow::Owned(PathBuf::from(root_cert_path)))
        } else {
            None
        };

        let mut ssl_opts = SslOpts::default();
        ssl_opts = ssl_opts
            .with_client_identity(Some(identity))
            .with_root_cert_path(root_cert_path);
        
        dest_mariadb_opts_builder = dest_mariadb_opts_builder.ssl_opts(ssl_opts);
    }
    let dest_pool = Pool::new(dest_mariadb_opts_builder).unwrap();
    let mut dest_conn = dest_pool.get_conn().unwrap();

    let profile = args.profile;
    let keep_block_height = args.keep_block_height.unwrap();

    // initial state loading
    let (initial_latest_distributed_slot, initial_latest_distributed_block_height) = io::fetch_latest_distributed_slot(&profile, &mut conn);
    println!("latest_distributed(src)  slot = {}, height = {}", initial_latest_distributed_slot, initial_latest_distributed_block_height);
    let (initial_dest_latest_distributed_slot, initial_dest_latest_distributed_block_height) = io::fetch_dest_latest_distributed_slot(&mut dest_conn);
    println!("latest_distributed(dest) slot = {}, height = {}", initial_dest_latest_distributed_slot, initial_dest_latest_distributed_block_height);

    assert!(initial_dest_latest_distributed_slot >= initial_latest_distributed_slot);
    assert!(
        // normal case
        initial_dest_latest_distributed_slot == initial_latest_distributed_slot ||
        // failed to update (local) distributor state only
        initial_dest_latest_distributed_block_height <= initial_latest_distributed_block_height + u64::from(FETCH_CHUNK_SIZE)
    );

    // setup handler for graceful shutdown
    let (tx, rx) = channel();
    ctrlc::set_handler(move || {
        println!("received Ctrl-C!");
        tx.send(()).unwrap();
    }).expect("Error setting Ctrl-C handler");

    // use "dest" as start point
    let mut latest_distributed_slot = io::fetch_slot_info(initial_dest_latest_distributed_slot, &mut conn);
    assert_eq!(latest_distributed_slot.slot, initial_dest_latest_distributed_slot);
    assert_eq!(latest_distributed_slot.block_height, initial_dest_latest_distributed_block_height);

    // patch gap
    if initial_dest_latest_distributed_slot > initial_latest_distributed_slot {
        io::advance_distributor_state(&profile, &latest_distributed_slot, &mut conn).unwrap();
    }

    // distributor loop
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

        let mut next_slots = io::fetch_next_slot_infos(latest_distributed_slot.slot, FETCH_CHUNK_SIZE, &mut conn);
        let is_full_fetch = next_slots.len() == FETCH_CHUNK_SIZE as usize;

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

            // update admDistributorDestState, then update admDistributorState (maximum difference should be <= FETCH_CHUNK_SIZE)
            let sent_size = io::advance_distributor_dest_state(&transactions, keep_block_height, &mut dest_conn).unwrap();
            io::advance_distributor_state(&profile, &next_latest_distributed_slot, &mut conn).unwrap();

            latest_distributed_slot = next_latest_distributed_slot;

            println!(
                "distributed bytes={}(avg {}) slot={}, height={}, time={}({})",
                sent_size.1,
                sent_size.1 / transactions.len(),
                latest_distributed_slot.slot,
                latest_distributed_slot.block_height,
                latest_distributed_slot.block_time,
                Utc.timestamp_opt(latest_distributed_slot.block_time, 0).unwrap().format("%Y/%m/%d %T").to_string()
            );
        }

        if !is_full_fetch {
            println!("sleeping for {} ms ...", sleep_duration.as_millis());
            sleep(sleep_duration);
        }
    }
}
