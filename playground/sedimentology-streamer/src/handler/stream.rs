use std::collections::VecDeque;
use axum::{
    extract::{Query, State}, response::sse::{Event, KeepAlive, Sse}
};
use mysql::*;
use futures::stream::{self, Stream};
use tokio_stream::StreamExt as _;
use std::{convert::Infallible, time::Duration};
use serde::Deserialize;

use super::{duration_to_string, with_separator};
use crate::{io, ServerState};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct StreamQuery {
    slot: Option<u64>,
    limit: Option<u64>,
}

pub(crate) async fn handler(
    State(state): State<ServerState>,
    Query(query): Query<StreamQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let request_id = state.request_id_stream.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    println!("stream({}): query {:?}", request_id, query);

    fn handle(state: ServerState, query: StreamQuery, request_id: u64) -> impl Stream<Item = Result<Event, Infallible>> {
        // ATTENTION: limit includes no data response
        let limit = usize::try_from(query.limit.unwrap_or(256)).unwrap();

        let latest_fetched_slot = if let Some(slot) = query.slot {
            slot
        } else {
            let mut conn = state.pool.get_conn().unwrap();
            io::fetch_checkpoint_block_slot(&mut conn)
        };

        println!("stream({}): slot: {}, limit: {}", request_id, latest_fetched_slot, limit);

        struct StreamState {
            // meta
            request_id: u64,
            since_connected: std::time::Instant,
            last_reported: std::time::Instant,
            response_count_data: u64,
            response_count_nodata: u64,
            response_bytes: u64,
            // work
            pool: Pool,
            fetched: Box<VecDeque<String>>,
            latest_fetched_slot: u64,
        }

        let initial_stream_state = Box::new(StreamState {
            request_id,
            since_connected: std::time::Instant::now(),
            last_reported: std::time::Instant::now(),
            response_count_data: 0,
            response_count_nodata: 0,
            response_bytes: 0,
            pool: state.pool,
            fetched: Box::new(VecDeque::new()),
            latest_fetched_slot,
        });

        const FETCH_CHUNK_SIZE: u16 = 128; // jsonl average length: 8KB
        const NO_MORE_SLOT_WAIT_LIMIT_MS: u128 = 5000;
        const NO_MORE_SLOT_WAIT_MS: u64 = 500;
        const REPORT_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60);
        stream::unfold(initial_stream_state, move |mut stream_state| async move {
            if stream_state.last_reported.elapsed() >= REPORT_INTERVAL {
                println!(
                    "stream({}): connected: {}, last_fetched_slot: {}, count: {}/{}, bytes: {} KB",
                    stream_state.request_id,
                    duration_to_string(&stream_state.since_connected.elapsed()),
                    stream_state.latest_fetched_slot,
                    with_separator(stream_state.response_count_data),
                    with_separator(stream_state.response_count_nodata),
                    with_separator(stream_state.response_bytes / 1024),
                );
                stream_state.last_reported = std::time::Instant::now();
            }

            if stream_state.fetched.is_empty() {
                let trying = std::time::Instant::now();
                loop {
                    let mut conn = stream_state.pool.get_conn().unwrap();
                    let mut next_slots = io::fetch_next_slot_infos(stream_state.latest_fetched_slot, FETCH_CHUNK_SIZE, &mut conn);
                    
                    assert_eq!(next_slots[0].slot, stream_state.latest_fetched_slot);
                    next_slots.remove(0);

                    if next_slots.len() >= 1 {
                        io::fetch_transactions(&next_slots, &mut stream_state.fetched, &mut conn);
                        stream_state.latest_fetched_slot = next_slots[next_slots.len() - 1].slot;
                        break;
                    }

                    tokio::time::sleep(Duration::from_millis(NO_MORE_SLOT_WAIT_MS)).await;
                    if trying.elapsed().as_millis() >= NO_MORE_SLOT_WAIT_LIMIT_MS {
                        break;
                    }
                }
            }
            
            if let Some(data) = stream_state.fetched.pop_front() {
                stream_state.response_count_data += 1;
                stream_state.response_bytes += u64::try_from(data.len()).unwrap();
                Some((Event::default().data(data), stream_state))
            }
            else {
                stream_state.response_count_nodata += 1;
                Some((Event::default().data(""), stream_state))
            }
        })
        .map(Ok)
        .take(limit)
    }

    let stream = handle(state, query, request_id);
    Sse::new(stream).keep_alive(KeepAlive::default())
}
