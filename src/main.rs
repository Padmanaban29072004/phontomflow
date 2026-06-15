mod analysis;
mod compression;
mod encryption;
mod network;
mod performance_engine;
mod security_engine;
mod storage;
mod threading;
mod utils;

use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use clap::Parser;
use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server, StatusCode};
use serde_json::json;
use tokio::signal;
use tracing_subscriber::EnvFilter;

use performance_engine::core::{PerformanceEngine, PerformanceConfig};
use security_engine::{SecurityConfig, SecurityAnalysisRequest, SecurityEngine};

#[derive(Parser, Debug)]
#[command(name = "phantom-security-engine", version = "2.0.0", about = "PHANTOM-Flow Security Engine")]
struct Cli {
    #[arg(short = 'H', long, default_value = "0.0.0.0")]
    host: String,

    #[arg(short = 'p', long, default_value = "9090")]
    port: u16,

    #[arg(long, default_value = "info")]
    log_level: String,

    #[arg(long, default_value_t = 4)]
    workers: usize,
}

struct AppState {
    security_engine: SecurityEngine,
    performance_engine: Arc<tokio::sync::Mutex<PerformanceEngine>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new(&cli.log_level))
        .init();

    tracing::info!("Starting PHANTOM-Flow Security Engine v{}", env!("CARGO_PKG_VERSION"));

    let sec_config = SecurityConfig {
        max_request_size: 1024 * 1024,
        rate_limit_window: Duration::from_secs(60),
        rate_limit_max_requests: 1000,
        threat_score_threshold: 0.7,
        enable_ml_analysis: true,
        enable_behavioral_analysis: true,
        cache_ttl: Duration::from_secs(300),
        worker_threads: cli.workers,
        batch_size: 100,
    };

    let perf_config = PerformanceConfig {
        worker_threads: cli.workers,
        queue_size: 10000,
        batch_size: 100,
        processing_timeout: Duration::from_secs(30),
        cache_size: 10000,
        cache_ttl: Duration::from_secs(300),
        rate_limit_rps: 1000,
        rate_limit_burst: 2000,
        circuit_breaker_threshold: 10,
        circuit_breaker_timeout: Duration::from_secs(30),
        enable_parallel_processing: true,
        enable_vectorization: true,
        enable_prefetching: true,
        memory_pool_size: 1024 * 1024 * 100,
        compression_enabled: true,
        encryption_enabled: true,
    };

    let security_engine = SecurityEngine::new(sec_config);
    let mut performance_engine = PerformanceEngine::new(perf_config)?;
    performance_engine.start().await?;

    let state = Arc::new(AppState {
        security_engine,
        performance_engine: Arc::new(tokio::sync::Mutex::new(performance_engine)),
    });

    let addr: SocketAddr = format!("{}:{}", cli.host, cli.port).parse()?;

    let make_svc = make_service_fn(move |_conn: &AddrStream| {
        let state = state.clone();
        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                handle_request(req, state.clone())
            }))
        }
    });

    let server = Server::bind(&addr).serve(make_svc);
    let graceful = server.with_graceful_shutdown(shutdown_signal());

    tracing::info!("Listening on http://{}", addr);

    if let Err(e) = graceful.await {
        tracing::error!("Server error: {}", e);
    }

    Ok(())
}

async fn handle_request(
    req: Request<Body>,
    state: Arc<AppState>,
) -> Result<Response<Body>, Infallible> {
    let response = match (req.method(), req.uri().path()) {
        (&Method::GET, "/health") => {
            json_response(StatusCode::OK, json!({
                "status": "healthy",
                "service": "phantom-security-engine",
                "version": env!("CARGO_PKG_VERSION"),
            }))
        }

        (&Method::GET, "/metrics") => {
            let metrics = format!(
                "# HELP phantom_engine_up Engine is running\n\
                 # TYPE phantom_engine_up gauge\n\
                 phantom_engine_up 1\n"
            );
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/plain; charset=utf-8")
                .body(Body::from(metrics))
                .unwrap()
        }

        (&Method::POST, "/analyze") => {
            let body_bytes = hyper::body::to_bytes(req.into_body()).await.unwrap_or_default();
            match parse_analysis_request(&body_bytes) {
                Ok(analysis_req) => {
                    match state.security_engine.analyze_request(analysis_req).await {
                        Ok(result) => json_response(StatusCode::OK, json!({
                            "success": true,
                            "data": result,
                        })),
                        Err(e) => json_response(StatusCode::INTERNAL_SERVER_ERROR, json!({
                            "success": false,
                            "error": e.to_string(),
                        })),
                    }
                }
                Err(e) => json_response(StatusCode::BAD_REQUEST, json!({
                    "success": false,
                    "error": e,
                })),
            }
        }

        _ => json_response(StatusCode::NOT_FOUND, json!({
            "success": false,
            "error": "Not Found",
        })),
    };

    Ok(response)
}

fn parse_analysis_request(body: &[u8]) -> Result<SecurityAnalysisRequest, String> {
    let req: serde_json::Value = serde_json::from_slice(body).map_err(|e| e.to_string())?;

    let client_ip: std::net::IpAddr = req.get("client_ip")
        .and_then(|v| v.as_str())
        .unwrap_or("0.0.0.0")
        .parse()
        .map_err(|_| "Invalid client_ip".to_string())?;

    Ok(SecurityAnalysisRequest {
        request_id: req.get("request_id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        timestamp: std::time::SystemTime::now(),
        client_ip,
        user_agent: req.get("user_agent")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        request_method: req.get("request_method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET")
            .to_string(),
        request_path: req.get("request_path")
            .and_then(|v| v.as_str())
            .unwrap_or("/")
            .to_string(),
        request_headers: req.get("request_headers")
            .and_then(|v| v.as_object())
            .map(|m| m.iter().map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string())).collect())
            .unwrap_or_default(),
        request_body: req.get("request_body")
            .and_then(|v| v.as_str())
            .map(|s| s.as_bytes().to_vec())
            .unwrap_or_default(),
        session_id: req.get("session_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        user_id: req.get("user_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        tls_info: None,
        geographic_info: None,
    })
}

fn json_response<T: serde::Serialize>(status: StatusCode, body: T) -> Response<Body> {
    let json = serde_json::to_string(&body).unwrap_or_default();
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(Body::from(json))
        .unwrap()
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
