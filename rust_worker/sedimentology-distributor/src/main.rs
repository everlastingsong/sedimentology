use std::sync::{atomic::AtomicU64, Arc};

use axum::{
    routing::get,
    Router,
};

use mysql::*;
use clap::Parser;

mod io;
mod schema;
mod handler;

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

    #[clap(long, id = "port", default_value = "7683")]
    port: Option<u16>,
}

#[derive(Clone)]
pub(crate) struct ServerState {
    // mysql::Pool is thread-safe cloneable smart pointer
    // https://docs.rs/mysql/24.0.0/mysql/struct.Pool.html
    pub pool: Pool,

    pub request_id_state: Arc<AtomicU64>,
    pub request_id_stream: Arc<AtomicU64>,
}

#[tokio::main]
async fn main() {
    // connect to mariadb
    let args = Args::parse();
    let mariadb_url = format!("mysql://{}:{}@{}:{}/{}",
                      args.mariadb_user.unwrap(),
                      args.mariadb_password.unwrap(),
                      args.mariadb_host.unwrap(),
                      args.mariadb_port.unwrap(),
                      args.mariadb_database.unwrap());
    let pool = Pool::new(mariadb_url.as_str()).unwrap();

    let port = args.port.unwrap();

    let state = ServerState {
        pool,
        request_id_state: Arc::new(AtomicU64::new(0)),
        request_id_stream: Arc::new(AtomicU64::new(0)),
    };

    let router = Router::new()
        .route("/state", get(handler::state::handler))
        .route("/stream", get(handler::stream::handler))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap();

    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, router).await.unwrap();
}
