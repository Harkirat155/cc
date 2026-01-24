use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use crisscross_server::{
    config::AppConfig,
    handlers::{register_socket_handlers, AppState},
    models::feedback::{FeedbackContext, FeedbackMeta, FeedbackRequest, FeedbackResponse},
    services::{
        feedback_service::FeedbackService, google_sheets::GoogleSheetsService,
        google_sheets::SheetsClient, RoomConfig,
    },
};
use serde_json::json;
use socketioxide::SocketIo;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info};
use tracing_subscriber;

#[derive(Clone)]
struct AppServices {
    feedback_service: FeedbackService,
    sheets_client: Option<Arc<dyn SheetsClient>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,crisscross_server=debug".into()),
        )
        .init();

    // Load configuration
    let config = AppConfig::from_env()?;
    info!("Starting CrissCross Tic Tac Toe Server");
    info!("Port: {}", config.port);
    info!("CORS allowed origins: {}", config.cors_origin);

    // Set up services
    let room_config = RoomConfig {
        room_limit: config.room_limit,
        room_ttl_ms: config.room_ttl_ms,
    };

    let app_state = Arc::new(AppState::new(room_config.clone()));
    let feedback_service = FeedbackService::new();

    // Initialize Google Sheets client
    let sheets_client: Option<Arc<dyn SheetsClient>> =
        match GoogleSheetsService::new(
            config.google_service_account_email.clone(),
            config.google_service_account_private_key.clone(),
            config.google_sheets_spreadsheet_id.clone(),
            config.google_sheets_feedback_range.clone(),
        )
        .await
        {
            Ok(service) => {
                if service.is_configured() {
                    info!("Google Sheets integration configured");
                    Some(Arc::new(service))
                } else {
                    info!("Google Sheets integration not configured (missing credentials)");
                    None
                }
            }
            Err(e) => {
                error!("Failed to initialize Google Sheets: {}", e);
                None
            }
        };

    let app_services = AppServices {
        feedback_service,
        sheets_client,
    };

    // Start room garbage collection
    let gc_room_manager = app_state.room_manager.clone();
    gc_room_manager.start_gc_loop();

    // Set up Socket.IO
    let (socket_layer, io) = SocketIo::builder()
        .with_state(app_state.clone())
        .build_layer();

    io.ns("/", register_socket_handlers);

    // Set up CORS
    let allowed_origins = config.allowed_origins();
    let cors_layer = if allowed_origins.contains(&"*".to_string()) {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers(Any)
    } else {
        let origins: Vec<HeaderValue> = allowed_origins
            .iter()
            .filter_map(|o| o.parse().ok())
            .collect();
        
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers(Any)
    };

    // Build the HTTP application
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/feedback", post(handle_feedback))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CompressionLayer::new())
                .layer(cors_layer)
                .layer(socket_layer),
        )
        .with_state(app_services);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    info!("Realtime server listening on {} (PID: {})", addr, std::process::id());

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

/// Feedback submission endpoint
async fn handle_feedback(
    headers: HeaderMap,
    State(services): State<AppServices>,
    Json(req): Json<FeedbackRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Validate rating
    if !req.rating.is_finite() || req.rating < 1.0 || req.rating > 5.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Rating must be a number between 1 and 5." })),
        ));
    }

    // Validate message
    let trimmed_message = req.message.trim();
    if trimmed_message.len() < 5 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Feedback should be at least 5 characters long." })),
        ));
    }

    let trimmed_message = trimmed_message.chars().take(2000).collect::<String>();
    let safe_rating = (req.rating * 10.0).round() / 10.0;

    // Parse context
    let safe_context = req.context.as_ref().map(|ctx| {
        FeedbackContext {
            room_id: ctx.get("roomId")
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(32).collect()),
            is_multiplayer: ctx.get("isMultiplayer").and_then(|v| v.as_bool()),
            socket_id: ctx.get("socketId")
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(48).collect()),
            url: ctx.get("url")
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(2048).collect()),
            user_agent: ctx.get("userAgent")
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(512).collect()),
        }
    });

    // Collect metadata
    let meta = Some(FeedbackMeta {
        ip: headers
            .get("x-forwarded-for")
            .or_else(|| headers.get("x-real-ip"))
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string()),
        origin: headers
            .get("origin")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string()),
        referer: headers
            .get("referer")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string()),
        user_agent: headers
            .get("user-agent")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string()),
    });

    // Add feedback to store
    let entry = services
        .feedback_service
        .add_feedback(safe_rating, trimmed_message.clone(), safe_context.clone(), meta.clone())
        .await;

    // Log feedback (skip in test mode)
    if std::env::var("NODE_ENV").unwrap_or_default() != "test" {
        let preview = if trimmed_message.len() > 120 {
            format!("{}...", &trimmed_message[..117])
        } else {
            trimmed_message.clone()
        };
        info!("[feedback] {}★ {}", entry.rating, preview);
    }

    // Sync to Google Sheets
    let sheets_sync = if let Some(ref client) = services.sheets_client {
        match client
            .append_feedback(
                entry.rating,
                &entry.message,
                entry.context.as_ref(),
                entry.meta.as_ref(),
                &entry.received_at,
            )
            .await
        {
            Ok(_) => "ok",
            Err(e) => {
                error!("[feedback] Failed to sync with Google Sheets: {}", e);
                "failed"
            }
        }
    } else {
        "skipped"
    };

    Ok((
        StatusCode::CREATED,
        Json(FeedbackResponse {
            status: "received".to_string(),
            id: entry.id,
            sheets_sync: sheets_sync.to_string(),
        }),
    ))
}
