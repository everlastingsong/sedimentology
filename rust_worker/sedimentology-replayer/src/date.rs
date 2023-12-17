use chrono::{Utc, TimeZone};

pub fn convert_unixtime_to_yyyymmdd(unixtime: i64) -> u32 {
    let dt = Utc.timestamp_opt(unixtime, 0).unwrap();
    let yyyymmdd = dt.format("%Y%m%d").to_string();
    return yyyymmdd.parse::<u32>().unwrap();
}

pub fn truncate_unixtime_to_date(unixtime: i64) -> i64 {
    let rem = unixtime % (24 * 60 * 60);
    return unixtime - rem;
}

pub fn is_next_date(current_unixtime_date: i64, next_unixtime_date: i64) -> bool {
    return next_unixtime_date == current_unixtime_date + 24 * 60 * 60;
}