//! UUID v4 formatting — the exact routine `generateLaunchSignature` inlines
//! (listings lines 132700-132760):
//!
//! 1. 16 random bytes via `getRandomValues`,
//! 2. the two little-endian `i64` loads/stores reverse the random block, then
//!    byte 6's high nibble is set to 4 and byte 8's top bits to `10xx`,
//! 3. hyphen positions 8/13/18/23, lower-cased hex digits — the digit table
//!    `b"0123456789abcdef"` is at memory address 1080552.

pub const HEX_TABLE: &[u8; 16] = b"0123456789abcdef";

/// Render 16 UUID bytes (already version/variant-adjusted) as the dashed,
/// lower-case string the signature builder produces. Byte-exact with the wasm
/// body: nibble table at 1080552 ("0123456789abcdef"), dashes fixed at
/// positions 8, 13, 18, 23.
pub fn hyphenated_uuid_v4(bytes: &[u8; 16]) -> String {
    let mut out = [b'-'; 36];
    let mut i_out = 0usize;
    let mut i_nib = 0usize;
    while i_out < 36 {
        if i_out == 8 || i_out == 13 || i_out == 18 || i_out == 23 {
            i_out += 1;
            continue;
        }
        let byte = bytes[i_nib / 2];
        let nib = if i_nib % 2 == 0 { byte >> 4 } else { byte & 15 } as usize;
        out[i_out] = HEX_TABLE[nib];
        i_out += 1;
        i_nib += 1;
    }
    String::from_utf8(out.to_vec()).unwrap()
}

/// Apply RFC 4122 v4 version/variant nibbles to 16 random bytes (the bytecode
/// reorders then masks; net effect below).
pub fn set_uuid_v4_marker(bytes: &mut [u8; 16]) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
}

/// Apply the byte reversal performed by the wasm's two `i64` transforms,
/// followed by the RFC 4122 version and variant masks.
pub fn prepare_random_uuid_v4(bytes: &mut [u8; 16]) {
    bytes.reverse();
    set_uuid_v4_marker(bytes);
}
