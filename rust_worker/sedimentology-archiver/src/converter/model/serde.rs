pub mod string_u64 {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use std::str::FromStr;

    pub fn serialize<S>(data: &u64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&data.to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<u64, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        u64::from_str(&s).map_err(serde::de::Error::custom)
    }
}

pub mod string_u128 {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use std::str::FromStr;

    pub fn serialize<S>(data: &u128, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&data.to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<u128, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        u128::from_str(&s).map_err(serde::de::Error::custom)
    }
}

pub mod string_option_u64 {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use std::str::FromStr;

    pub fn serialize<S>(data: &Option<u64>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // must be Some
        // skip_serializing_if = "Option::is_none" is must
        serializer.serialize_str(&data.unwrap().to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
    where
        D: Deserializer<'de>,
    {
        // must be Some
        // default = "Option::default" is must
        let s = String::deserialize(deserializer)?;
        Ok(Some(u64::from_str(&s).map_err(serde::de::Error::custom)?))
    }
}

pub mod string_decimal_price {
    use bigdecimal::BigDecimal;
    use serde::{self, Deserialize, Deserializer, Serializer};
    use std::str::FromStr;

    const DECIMAL_PRICE_PRECISION: u64 = 10;

    pub fn serialize<S>(data: &BigDecimal, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(
            &data
                .with_prec(DECIMAL_PRICE_PRECISION)
                .to_scientific_notation(),
        )
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<BigDecimal, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        BigDecimal::from_str(&s).map_err(serde::de::Error::custom)
    }
}
