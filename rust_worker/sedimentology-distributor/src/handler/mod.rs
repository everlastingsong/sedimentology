pub mod state;
pub mod stream;

fn duration_to_string(duration: &std::time::Duration) -> String {
  match duration.as_secs() {
      s if s < 10 * 60 /* 10m */ => format!("{}s", s),
      s if s < 120 * 60 /* 120m */ => format!("{}m{}s", s / 60, s % 60),
      s if s < 48 * 3600 /* 48h */ => format!("{}h{}m", s / 3600, s % 3600 / 60),
      s => format!("{}d{}h{}m", s / 86400, s % 86400 / 3600, s % 3600 / 60),
  }
}

fn with_separator(value: u64) -> String {
  use num_format::ToFormattedString;
  value.to_formatted_string(&num_format::Locale::en)
}
