use std::collections::VecDeque;
use axum::{
    extract::{Query, State}, response::sse::{Event, KeepAlive, Sse}
};
use mysql::*;
use futures::stream::{self, Stream};
use tokio_stream::StreamExt as _;
use std::{convert::Infallible, time::Duration};
use serde::Deserialize;

use crate::ServerState;
use crate::io;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct StreamQuery {
    slot: u64,
    limit: Option<u64>,
}

pub(crate) async fn handler(
    State(state): State<ServerState>,
    Query(query): Query<StreamQuery>, //Query<serde_json::Value>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    println!("stream: {:?}", query);

    fn handle(state: ServerState, query: StreamQuery) -> impl Stream<Item = Result<Event, Infallible>> {
        let limit = usize::try_from(query.limit.unwrap_or(256)).unwrap();

        struct StreamState {
            pool: Pool,
            fetched: Box<VecDeque<String>>,
            latest_fetched_slot: u64,
        }

        let initial_stream_state = Box::new(StreamState {
            pool: state.pool,
            fetched: Box::new(VecDeque::new()),
            latest_fetched_slot: query.slot,
        });

        const FETCH_CHUNK_SIZE: u16 = 128; // jsonl average length: 8KB
        const NO_MORE_SLOT_DELAY_MS: u64 = 1000;
        stream::unfold(initial_stream_state, move |mut stream_state| async move {
            if stream_state.fetched.is_empty() {
                let mut conn = stream_state.pool.get_conn().unwrap();
                let mut next_slots = io::fetch_next_slot_infos(stream_state.latest_fetched_slot, FETCH_CHUNK_SIZE, &mut conn);
                
                assert_eq!(next_slots[0].slot, stream_state.latest_fetched_slot);
                next_slots.remove(0);

                io::fetch_transactions(&next_slots, &mut stream_state.fetched, &mut conn);

                stream_state.latest_fetched_slot = next_slots[next_slots.len() - 1].slot;
            }
            
            if stream_state.fetched.is_empty() {
                tokio::time::sleep(Duration::from_millis(NO_MORE_SLOT_DELAY_MS)).await;
                Some((Event::default().data(""), stream_state))
            } else {
                Some((Event::default().data(stream_state.fetched.pop_front().unwrap()), stream_state))
            }
        })
        .map(Ok)
        .take(limit)
    }

    let stream = handle(state, query);
    Sse::new(stream).keep_alive(KeepAlive::default())
}
