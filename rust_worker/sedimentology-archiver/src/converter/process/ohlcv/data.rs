use super::super::super::model::{event::definition::{PoolInitializedEventPayload, TradeDirection, TradedEventPayload}, ohlcv};
use bigdecimal::BigDecimal;
use std::collections::HashMap;

#[derive(Debug)]
pub struct OhlcvDataManager {
  pub timestamp: i64,
  pub data: HashMap<String, OhlcvData>,
}

impl OhlcvDataManager {
  pub fn new(timestamp: i64) -> Self {
    Self { timestamp, data: HashMap::new() }
  }

  pub fn initialize_with_previous_close(&mut self, metadata: Metadata, previous_close_sqrt_price: u128) {
    self.data.insert(metadata.whirlpool.clone(), OhlcvData {
      metadata,
      initial_state: InitialState::Existing(previous_close_sqrt_price),
      estimated_fees: EstimatedFees::default(),
      daily: SqrtPriceOhlcvDataUnit {
        timestamp: self.timestamp,
        open: previous_close_sqrt_price,
        high: previous_close_sqrt_price,
        low: previous_close_sqrt_price,
        close: previous_close_sqrt_price,
        volume_a_to_b: VolumeData::default(),
        volume_b_to_a: VolumeData::default(),
      },
      minutely: HashMap::new(),
    });
  }

  pub fn process_pool_initialized_event(&mut self, slot: u64, block_time: i64, pool_initialized: &PoolInitializedEventPayload) {
    let metadata = Metadata {
      whirlpool: pool_initialized.whirlpool.clone(),
      whirlpools_config: pool_initialized.config.clone(),
      mint_a: pool_initialized.token_mint_a.clone(),
      mint_b: pool_initialized.token_mint_b.clone(),
      tick_spacing: pool_initialized.tick_spacing,
      decimals_a: pool_initialized.token_decimals_a,
      decimals_b: pool_initialized.token_decimals_b,
    };
    let initial_sqrt_price = pool_initialized.sqrt_price;

    self.data.insert(metadata.whirlpool.clone(), OhlcvData {
      metadata,
      initial_state: InitialState::New(initial_sqrt_price, slot, block_time),
      estimated_fees: EstimatedFees::default(),
      daily: SqrtPriceOhlcvDataUnit {
        timestamp: self.timestamp,
        open: initial_sqrt_price,
        high: initial_sqrt_price,
        low: initial_sqrt_price,
        close: initial_sqrt_price,
        volume_a_to_b: VolumeData::default(),
        volume_b_to_a: VolumeData::default(),
      },
      minutely: HashMap::new(),
    });
  }

  pub fn process_traded_event(&mut self, block_time: i64, traded: &TradedEventPayload) {
    let whirlpool = self.data.get_mut(&traded.whirlpool).unwrap();

    // updating estimated_fees
    let post_transfer_fee = calculate_post_transfer_fee(traded.transfer_in.amount, traded.transfer_in.transfer_fee_bps, traded.transfer_in.transfer_fee_max);
    let trade_fee = calculate_trade_fee(post_transfer_fee, traded.fee_rate);
    let (liquidity_provider_fee, protocol_fee) = split_fee(trade_fee, traded.protocol_fee_rate);
    match traded.trade_direction {
      TradeDirection::AtoB => {
        whirlpool.estimated_fees.liquidity_provider_fee_a += liquidity_provider_fee;
        whirlpool.estimated_fees.protocol_fee_a += protocol_fee;
      }
      TradeDirection::BtoA => {
        whirlpool.estimated_fees.liquidity_provider_fee_b += liquidity_provider_fee;
        whirlpool.estimated_fees.protocol_fee_b += protocol_fee;
      }
    }

    // updating daily
    whirlpool.daily.high = whirlpool.daily.high.max(traded.new_sqrt_price);
    whirlpool.daily.low = whirlpool.daily.low.min(traded.new_sqrt_price);
    whirlpool.daily.close = traded.new_sqrt_price;
    match traded.trade_direction {
      TradeDirection::AtoB => {
        whirlpool.daily.volume_a_to_b.total_in += traded.transfer_in.amount as u128;
        whirlpool.daily.volume_a_to_b.total_out += traded.transfer_out.amount as u128;
        whirlpool.daily.volume_a_to_b.count += 1;
      }
      TradeDirection::BtoA => {
        whirlpool.daily.volume_b_to_a.total_in += traded.transfer_in.amount as u128;
        whirlpool.daily.volume_b_to_a.total_out += traded.transfer_out.amount as u128;
        whirlpool.daily.volume_b_to_a.count += 1;
      }
    }

    // updating minutely
    let minutely_timestamp = block_time / 60 * 60;
    let minutely_data = whirlpool.minutely.entry(minutely_timestamp).or_insert(SqrtPriceOhlcvDataUnit {
      timestamp: minutely_timestamp,
      open: traded.old_sqrt_price,
      high: traded.old_sqrt_price,
      low: traded.old_sqrt_price,
      close: traded.old_sqrt_price,
      volume_a_to_b: VolumeData::default(),
      volume_b_to_a: VolumeData::default(),
    });

    minutely_data.high = minutely_data.high.max(traded.new_sqrt_price);
    minutely_data.low = minutely_data.low.min(traded.new_sqrt_price);
    minutely_data.close = traded.new_sqrt_price;
    match traded.trade_direction {
      TradeDirection::AtoB => {
        minutely_data.volume_a_to_b.total_in += traded.transfer_in.amount as u128;
        minutely_data.volume_a_to_b.total_out += traded.transfer_out.amount as u128;
        minutely_data.volume_a_to_b.count += 1;
      }
      TradeDirection::BtoA => {
        minutely_data.volume_b_to_a.total_in += traded.transfer_in.amount as u128;
        minutely_data.volume_b_to_a.total_out += traded.transfer_out.amount as u128;
        minutely_data.volume_b_to_a.count += 1;
      }
    }
  }
}

#[derive(Debug)]
pub struct OhlcvData {
  metadata: Metadata,
  initial_state: InitialState,
  estimated_fees: EstimatedFees,
  daily: SqrtPriceOhlcvDataUnit,
  minutely: HashMap<i64, SqrtPriceOhlcvDataUnit>,
}

// impl OhlcvData into WhirlpoolOhlcvDailyData
impl From<&OhlcvData> for ohlcv::WhirlpoolOhlcvDailyData {
  fn from(ohlcv_data: &OhlcvData) -> Self {
    Self {
      metadata: ohlcv::WhirlpoolOhlcvMetadata::from(ohlcv_data),
      initial_state: ohlcv::InitialState::from(ohlcv_data),
      estimated_fees: ohlcv::EstimatedFees::from(ohlcv_data),
      daily: convert_to_ohlcv_data_unit(&ohlcv_data.daily, ohlcv_data.metadata.decimals_a, ohlcv_data.metadata.decimals_b),
    }
  }
}

// impl OhlcvData into WhirlpoolOhlcvMinutelyData
impl From<&OhlcvData> for ohlcv::WhirlpoolOhlcvMinutelyData {
  fn from(ohlcv_data: &OhlcvData) -> Self {
    let mut minutely = ohlcv_data.minutely.values().map(|data| convert_to_ohlcv_data_unit(data, ohlcv_data.metadata.decimals_a, ohlcv_data.metadata.decimals_b)).collect::<Vec<_>>();
    minutely.sort_by_key(|data| data.timestamp);
    Self {
      metadata: ohlcv::WhirlpoolOhlcvMetadata::from(ohlcv_data),
      initial_state: ohlcv::InitialState::from(ohlcv_data),
      estimated_fees: ohlcv::EstimatedFees::from(ohlcv_data),
      daily: convert_to_ohlcv_data_unit(&ohlcv_data.daily, ohlcv_data.metadata.decimals_a, ohlcv_data.metadata.decimals_b),
      minutely,
    }
  }
}

#[derive(Debug)]
pub struct Metadata {
  pub whirlpool: String,
  pub whirlpools_config: String,
  pub mint_a: String,
  pub mint_b: String,
  pub tick_spacing: u16,
  pub decimals_a: u8,
  pub decimals_b: u8,
}

impl From<&OhlcvData> for ohlcv::WhirlpoolOhlcvMetadata {
  fn from(data: &OhlcvData) -> Self {
    let metadata = &data.metadata;
    Self {
      whirlpool: metadata.whirlpool.clone(),
      whirlpools_config: metadata.whirlpools_config.clone(),
      token_a: ohlcv::TokenData {
        mint: metadata.mint_a.clone(),
        decimals: metadata.decimals_a,
      },
      token_b: ohlcv::TokenData {
        mint: metadata.mint_b.clone(),
        decimals: metadata.decimals_b,
      },
      tick_spacing: metadata.tick_spacing,
    }
  }
}

#[derive(Debug)]
enum InitialState {
  Existing(u128), // previous close sqrt price
  New(u128, u64, i64), // initial sqrt price, slot, block time
}

impl From<&OhlcvData> for ohlcv::InitialState {
  fn from(data: &OhlcvData) -> Self {
    let decimals_a = data.metadata.decimals_a;
    let decimals_b = data.metadata.decimals_b;
    match &data.initial_state {
      InitialState::Existing(previous_close_sqrt_price) => Self::Existing {
        previous_close_sqrt_price: *previous_close_sqrt_price,
        previous_close_decimal_price: sqrt_price_to_decimal_price(*previous_close_sqrt_price, decimals_a, decimals_b),
      },
      InitialState::New(initial_sqrt_price, slot, block_time) => Self::New {
        initial_sqrt_price: *initial_sqrt_price,
        initial_decimal_price: sqrt_price_to_decimal_price(*initial_sqrt_price, decimals_a, decimals_b),
        initialized_slot: *slot,
        initialized_block_time: *block_time,
      },
    }
  }
}

#[derive(Default, Debug)]
struct EstimatedFees {
  liquidity_provider_fee_a: u64,
  liquidity_provider_fee_b: u64,
  protocol_fee_a: u64,
  protocol_fee_b: u64,
}

impl From<&OhlcvData> for ohlcv::EstimatedFees {
  fn from(data: &OhlcvData) -> Self {
    let estimated_fees = &data.estimated_fees;
    Self {
      liquidity_provider_fee_a: estimated_fees.liquidity_provider_fee_a,
      liquidity_provider_fee_b: estimated_fees.liquidity_provider_fee_b,
      protocol_fee_a: estimated_fees.protocol_fee_a,
      protocol_fee_b: estimated_fees.protocol_fee_b,
    }
  }
}

#[derive(Debug)]
struct SqrtPriceOhlcvDataUnit {
  timestamp: i64,
  open: u128,
  high: u128,
  low: u128,
  close: u128,
  volume_a_to_b: VolumeData,
  volume_b_to_a: VolumeData,
}

#[derive(Default, Debug)]
struct VolumeData {
  total_in: u128,
  total_out: u128,
  count: u64,
}

fn convert_to_ohlcv_data_unit(data: &SqrtPriceOhlcvDataUnit, decimals_a: u8, decimals_b: u8) -> ohlcv::WhirlpoolOhlcvDataUnit {
  ohlcv::WhirlpoolOhlcvDataUnit {
    timestamp: data.timestamp,
    ohlc: ohlcv::WhirlpoolOhlcvData {
      sqrt_price: ohlcv::SqrtPriceData {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      },
      decimal_price: ohlcv::DecimalPriceData {
        open: sqrt_price_to_decimal_price(data.open, decimals_a, decimals_b),
        high: sqrt_price_to_decimal_price(data.high, decimals_a, decimals_b),
        low: sqrt_price_to_decimal_price(data.low, decimals_a, decimals_b),
        close: sqrt_price_to_decimal_price(data.close, decimals_a, decimals_b),
      },
    },
    volume: ohlcv::VolumeData {
      ab: ohlcv::VolumeDirectionData {
        total_in: data.volume_a_to_b.total_in,
        total_out: data.volume_a_to_b.total_out,
        count: data.volume_a_to_b.count,
      },
      ba: ohlcv::VolumeDirectionData {
        total_in: data.volume_b_to_a.total_in,
        total_out: data.volume_b_to_a.total_out,
        count: data.volume_b_to_a.count,
      },
    },
  }
}

fn calculate_post_transfer_fee(amount: u64, transfer_fee_bps: Option<u16>, transfer_fee_max: Option<u64>) -> u64 {
  match (transfer_fee_bps, transfer_fee_max) {
    (Some(bps), Some(max)) => transfer_fee::calculate_post_fee_amount(amount, bps, max).unwrap(),
    (None, None) => amount,
    _ => unreachable!(),
  }
}

fn calculate_trade_fee(amount: u64, fee_rate: u16) -> u64 {
  let denum = whirlpool_base::math::FEE_RATE_MUL_VALUE;
  (amount as u128 * fee_rate as u128 / denum).try_into().unwrap()
}

fn split_fee(amount: u64, protocol_fee_rate: u16) -> (u64, u64) {
  let denum = whirlpool_base::math::PROTOCOL_FEE_RATE_MUL_VALUE;
  let protocol_fee = (amount as u128 * protocol_fee_rate as u128 / denum).try_into().unwrap();
  let liquidity_provider_fee = amount - protocol_fee;
  (liquidity_provider_fee, protocol_fee)
}

mod transfer_fee {
  // cloned from: https://github.com/solana-labs/solana-program-library/blob/master/token/program-2022/src/extension/transfer_fee/mod.rs

  const MAX_FEE_BASIS_POINTS: u16 = 10_000;
  const ONE_IN_BASIS_POINTS: u128 = MAX_FEE_BASIS_POINTS as u128;

  fn ceil_div(numerator: u128, denominator: u128) -> Option<u128> {
    numerator
        .checked_add(denominator)?
        .checked_sub(1)?
        .checked_div(denominator)
  }

  fn calculate_fee(pre_fee_amount: u64, transfer_fee_bps: u16, transfer_fee_max: u64) -> Option<u64> {
      let transfer_fee_basis_points = transfer_fee_bps as u128;
      if transfer_fee_basis_points == 0 || pre_fee_amount == 0 {
          Some(0)
      } else {
          let numerator = (pre_fee_amount as u128).checked_mul(transfer_fee_basis_points)?;
          let raw_fee: u64 = ceil_div(numerator, ONE_IN_BASIS_POINTS)?
              .try_into() // guaranteed to be okay
              .ok()?;

          Some(raw_fee.min(transfer_fee_max))
      }
  }

  pub fn calculate_post_fee_amount(pre_fee_amount: u64, transfer_fee_bps: u16, transfer_fee_max: u64) -> Option<u64> {
      pre_fee_amount.checked_sub(calculate_fee(pre_fee_amount, transfer_fee_bps, transfer_fee_max)?)
  }
}


// TODO: refactor (dedup event/convert.rs)
static X64: std::sync::OnceLock<BigDecimal> = std::sync::OnceLock::new();
fn sqrt_price_to_decimal_price(
    sqrt_price: u128,
    decimals_a: u8,
    decimals_b: u8,
) -> BigDecimal {
    let x64 = X64.get_or_init(|| BigDecimal::from(1u128 << 64));
    let price = (BigDecimal::from(sqrt_price) / x64).square();
    let (i, scale) = price.as_bigint_and_exponent();
    BigDecimal::new(i, scale - (decimals_a as i64 - decimals_b as i64))
}
