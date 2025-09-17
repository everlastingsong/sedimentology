use mysql::*;
use clap::Parser;
use std::str::FromStr;

use sedimentology_archiver::io;

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

    #[clap(long, id = "state")]
    state: bool,
    #[clap(long, id = "token")]
    token: bool,
    #[clap(long, id = "transaction")]
    transaction: bool,

    #[clap(id = "yyyymmdd")]
    yyyymmdd: String,
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

    let exporting_yyyymmdd_date = u32::from_str(&args.yyyymmdd).unwrap();

    println!("exporting {} ...", exporting_yyyymmdd_date);

    // export token & state & transaction to file

    if args.token {
        let token_file_expfile = format!("whirlpool-token-{}.json.gz", exporting_yyyymmdd_date);
        println!("exporting token ...");
        io::export_token(exporting_yyyymmdd_date, &token_file_expfile, &mut conn);
        println!("exported token to {}.", token_file_expfile);
    }

    if args.state {
        let state_file_expfile = format!("whirlpool-state-{}.json.gz", exporting_yyyymmdd_date);
        println!("exporting state ...");
        io::export_state(exporting_yyyymmdd_date, &state_file_expfile, &mut conn);
        println!("exported state to {}.", state_file_expfile);
    }

    if args.transaction {
        let transaction_file_expfile = format!("whirlpool-transaction-{}.jsonl.gz", exporting_yyyymmdd_date);
        println!("exporting transaction ...");
        io::export_transaction(exporting_yyyymmdd_date, &transaction_file_expfile, &mut conn);
        println!("exported transaction to {}.", transaction_file_expfile);
    }
}
