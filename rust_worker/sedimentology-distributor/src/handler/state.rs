use axum::{
    body::Body, extract::{Query, State}, http::{header, Response}, response::IntoResponse,
};
use mysql::*;
use serde::Deserialize;

use super::with_separator;
use crate::{io, ServerState};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct StateQuery {
    yyyymmdd: Option<u32>,
}

pub(crate) async fn handler(
    State(state): State<ServerState>,
    Query(query): Query<StateQuery>,
) -> impl IntoResponse {
    let request_id = state.request_id_state.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    println!("state({}): query {:?}", request_id, query);

    let mut conn = state.pool.get_conn().unwrap();

    let yyyymmdd = query.yyyymmdd.unwrap_or(io::fetch_latest_state_date(&mut conn));
    println!("state({}): yyyymmdd: {}", request_id, yyyymmdd);

    let mut file_buffer = Vec::<u8>::new();
    let now = std::time::Instant::now();
    io::fetch_state(yyyymmdd, &mut file_buffer, &mut conn);
    println!(
        "state({}): elapsed: {} ms, size {} KB",
        request_id,
        with_separator(u64::try_from(now.elapsed().as_millis()).unwrap()),
        with_separator(u64::try_from(file_buffer.len() / 1024).unwrap()),
    );

    let body = Body::from(file_buffer);
    let mut response = Response::new(body);
    let headers = response.headers_mut();

    headers.insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("application/gzip")
    );

    response
}
