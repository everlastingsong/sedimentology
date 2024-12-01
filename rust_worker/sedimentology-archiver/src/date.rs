use chrono::NaiveDate;

pub fn next_yyyymmdd_date(yyyymmdd: u32) -> u32 {
    let dt = NaiveDate::from_ymd_opt(
        (yyyymmdd / 10000) as i32,
        ((yyyymmdd % 10000) / 100) as u32,
        (yyyymmdd % 100) as u32,
    ).unwrap();
    let next_dt = dt.succ_opt().unwrap();
    return next_dt.format("%Y%m%d").to_string().parse::<u32>().unwrap();
}

pub fn prev_yyyymmdd_date(yyyymmdd: u32) -> u32 {
  let dt = NaiveDate::from_ymd_opt(
      (yyyymmdd / 10000) as i32,
      ((yyyymmdd % 10000) / 100) as u32,
      (yyyymmdd % 100) as u32,
  ).unwrap();
  let prev_dt = dt.pred_opt().unwrap();
  return prev_dt.format("%Y%m%d").to_string().parse::<u32>().unwrap();
}

pub fn convert_yyyymmdd_to_unixtime(yyyymmdd: u32) -> i64 {
  let dt = NaiveDate::from_ymd_opt(
    (yyyymmdd / 10000) as i32,
    ((yyyymmdd % 10000) / 100) as u32,
    (yyyymmdd % 100) as u32,
  ).unwrap();
  let dt = dt.and_hms(0, 0, 0);
  return dt.timestamp();
}
