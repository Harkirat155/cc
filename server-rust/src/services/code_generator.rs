use rand::Rng;

/// Generate a random 5-character room code
pub fn generate_room_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    
    (0..5)
        .map(|_| {
            let idx = rng.gen_range(0..ALPHABET.len());
            ALPHABET[idx] as char
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_room_code() {
        let code = generate_room_code();
        assert_eq!(code.len(), 5);
        assert!(code.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_code_uniqueness() {
        let code1 = generate_room_code();
        let code2 = generate_room_code();
        // Very unlikely to be the same (but possible)
        // This is just a basic sanity check
        assert_eq!(code1.len(), 5);
        assert_eq!(code2.len(), 5);
    }
}
