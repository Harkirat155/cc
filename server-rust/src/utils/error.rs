use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Room error: {0}")]
    Room(String),
    
    #[error("Lobby error: {0}")]
    Lobby(String),
    
    #[error("Google Sheets error: {0}")]
    GoogleSheets(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
