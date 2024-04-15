use axum::{
    body::Body, extract::{Query, State}, http::{header, Response}, response::IntoResponse,
};
use mysql::*;
use serde::Deserialize;

use crate::ServerState;
use crate::io;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct StateQuery {
    yyyymmdd: Option<u32>,
}

pub(crate) async fn handler(
    State(state): State<ServerState>,
    Query(query): Query<StateQuery>, //Query<serde_json::Value>,
) -> impl IntoResponse {
    println!("state: {:?}", query);

    let mut conn = state.pool.get_conn().unwrap();

    let yyyymmdd = query.yyyymmdd.unwrap_or(io::fetch_latest_state_date(&mut conn));
    println!("yyyymmdd: {}", yyyymmdd);

    let mut file_buffer = Vec::<u8>::new();
    io::fetch_state(yyyymmdd, &mut file_buffer, &mut conn);

    let body = Body::from(file_buffer);
    let mut response = Response::new(body);
    let headers = response.headers_mut();

    headers.insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("application/gzip")
    );

    response
}
