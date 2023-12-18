use std::thread::sleep;
use std::time::Duration;
use ctrlc;
use std::sync::mpsc::channel;

use mysql::*;
use clap::Parser;

use replay_engine::decoded_instructions::DecodedInstruction::{ProgramDeployInstruction, WhirlpoolInstruction};

mod io;
mod date;
mod schema;
mod command;

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

    #[clap(long, id = "profile")]
    profile: String,

    // rclone copyto <localfile> <rclone-remote-path>/<filename>
    // e.g. r2:sedimentology/alpha
    #[clap(long, id = "rclone-remote-path")]
    rclone_remote_path: String,

    #[clap(long, id = "working-directory")]
    working_directory: String,
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

    let profile = args.profile;
    let rclone_remote_path = args.rclone_remote_path;
    let tmpdir = args.working_directory;

    // setup handler for graceful shutdown
    let (tx, rx) = channel();
    ctrlc::set_handler(move || {
        println!("received Ctrl-C!");
        tx.send(()).unwrap();
    }).expect("Error setting Ctrl-C handler");

    // archive loop
    let sleep_duration = Duration::from_secs(3600);
    loop {
        // graceful shutdown
        let should_shutdown = rx.try_recv().is_ok();
        if should_shutdown {
            println!("shutting down ...");
            break;
        }

        // fetch latest replayed date
        let latest_replayed_yyyymmdd_date = io::fetch_latest_replayed_date(&mut conn);

        // fetch latest archived date
        let latest_archived_yyyymmdd_date = io::fetch_latest_archived_date(&profile,&mut conn);

        let mut is_full_archived = latest_archived_yyyymmdd_date >= latest_replayed_yyyymmdd_date; // > is fail safe

        if !is_full_archived {
            // process 1 day for each loop
            let archiving_yyyymmdd_date = date::next_yyyymmdd_date(latest_archived_yyyymmdd_date);

            println!("archiving {} ...", archiving_yyyymmdd_date);

            // export state & transaction to tmp file
            println!("exporting state to tmp file ...");
            let state_file_tmpfile = format!("{}/{}.state.tmp", tmpdir, profile);
            io::export_state(archiving_yyyymmdd_date, &state_file_tmpfile, &mut conn);
            let state_hash = command::sha256sum(&state_file_tmpfile);

            println!("exporting transaction to tmp file ...");
            let transaction_file_tmpfile = format!("{}/{}.transaction.tmp", tmpdir, profile);
            io::export_transaction(archiving_yyyymmdd_date, &transaction_file_tmpfile, &mut conn);
            let transaction_hash = command::sha256sum(&transaction_file_tmpfile);

            println!("state_hash = {}", state_hash);
            println!("transaction_hash = {}", transaction_hash);

            let yyyy = archiving_yyyymmdd_date.to_string().chars().take(4).collect::<String>();
            let mmdd = archiving_yyyymmdd_date.to_string().chars().skip(4).collect::<String>();
            let state_file_dest = format!("{}/{}/{}/whirlpool-state-{}.json.gz", rclone_remote_path, yyyy, mmdd, archiving_yyyymmdd_date);
            let transaction_file_dest = format!("{}/{}/{}/whirlpool-transaction-{}.jsonl.gz", rclone_remote_path, yyyy, mmdd, archiving_yyyymmdd_date);

            println!("uploading {} to {} ...", state_file_tmpfile, state_file_dest);
            command::rclone_copyto(&state_file_tmpfile, &state_file_dest);

            println!("uploading {} to {} ...", transaction_file_tmpfile, transaction_file_dest);
            command::rclone_copyto(&transaction_file_tmpfile, &transaction_file_dest);

            let state_file_verify = format!("{}/{}.state.verify", tmpdir, profile);
            let transaction_file_verify = format!("{}/{}.transaction.verify", tmpdir, profile);

            println!("downloading {} to {} ...", state_file_dest, state_file_verify);
            command::rclone_copyto(&state_file_dest, &state_file_verify);

            println!("downloading {} to {} ...", transaction_file_dest, transaction_file_verify);
            command::rclone_copyto(&transaction_file_dest, &transaction_file_verify);

            println!("verifying ...");
            let state_verify_hash = command::sha256sum(&state_file_verify);
            let transaction_verify_hash = command::sha256sum(&transaction_file_verify);
            assert!(state_hash == state_verify_hash, "state_hash != state_verify_hash");
            assert!(transaction_hash == transaction_verify_hash, "transaction_hash != transaction_verify_hash");

            // remove tmp & verify files
            std::fs::remove_file(&state_file_tmpfile).unwrap();
            std::fs::remove_file(&transaction_file_tmpfile).unwrap();
            std::fs::remove_file(&state_file_verify).unwrap();
            std::fs::remove_file(&transaction_file_verify).unwrap();

            // update latest archived date
            println!("updating latest archived date to {} ...", archiving_yyyymmdd_date);
            io::advance_archiver_state(&profile, archiving_yyyymmdd_date, &mut conn).unwrap();
            println!("updated latest archived date to {}", archiving_yyyymmdd_date);

            // check if full archived
            is_full_archived = archiving_yyyymmdd_date >= latest_replayed_yyyymmdd_date;
        }

        if is_full_archived {
            // TODO: avoid long sleep (for graceful shutdown)
            println!("sleeping for {} seconds ...", sleep_duration.as_secs());
            sleep(sleep_duration);
        }
    }    
}
