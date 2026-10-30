//! Hex-decoded string constants of `generateLaunchSignature`.
//!
//! The original stores these as literal hex text (`"19220616010a"` = "jQuery"
//! under the XOR fold). This helper mirrors that: decode two-digit hex pairs
//! and XOR by the probe key.

pub fn from(encoded_hex: &str) -> Vec<u8> {
    let hex = encoded_hex.as_bytes();
    assert!(hex.len() % 2 == 0);
    (0..hex.len())
        .step_by(2)
        .map(|i| hex_pair(hex[i], hex[i + 1]))
        .collect()
}

fn hex_pair(hi: u8, lo: u8) -> u8 {
    (nibble(hi) << 4) | nibble(lo)
}

fn nibble(b: u8) -> u8 {
    match b {
        b'0'..=b'9' => b - b'0',
        b'a'..=b'f' => b - b'a' + 10,
        b'A'..=b'F' => b - b'A' + 10,
        _ => 0,
    }
}
