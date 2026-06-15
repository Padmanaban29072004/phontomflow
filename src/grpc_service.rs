use std::net::SocketAddr;
use std::sync::Arc;

use tokio::sync::Mutex;
use tonic::{transport::Server, Request, Response, Status};

use crate::security_engine::{SecurityAnalysisRequest, SecurityEngine};
use phantom_flow_engine::security_engine_server::{SecurityEngine as SecurityEngineRpc, SecurityEngineServer};
use phantom_flow_engine::{SecurityRequest, SecurityResponse};

pub mod phantom_flow_engine {
    tonic::include_proto!("phantom_flow.engine");
}

pub struct SecurityEngineImpl {
    engine: Arc<Mutex<SecurityEngine>>,
}

impl SecurityEngineImpl {
    pub fn new(engine: SecurityEngine) -> Self {
        Self {
            engine: Arc::new(Mutex::new(engine)),
        }
    }
}

#[tonic::async_trait]
impl SecurityEngineRpc for SecurityEngineImpl {
    async fn analyze(
        &self,
        request: Request<SecurityRequest>,
    ) -> Result<Response<SecurityResponse>, Status> {
        let req = request.into_inner();

        let client_ip: std::net::IpAddr = req
            .client_ip
            .parse()
            .unwrap_or_else(|_| std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED));

        let analysis_req = SecurityAnalysisRequest {
            request_id: req.request_id,
            timestamp: std::time::SystemTime::now(),
            client_ip,
            user_agent: req.user_agent,
            request_method: req.request_method,
            request_path: req.request_path,
            request_headers: req.headers.into_iter().collect(),
            request_body: req.body,
            session_id: if req.session_id.is_empty() {
                None
            } else {
                Some(req.session_id)
            },
            user_id: if req.user_id.is_empty() {
                None
            } else {
                Some(req.user_id)
            },
            tls_info: None,
            geographic_info: None,
        };

        let engine = self.engine.lock().await;
        match engine.analyze_request(analysis_req).await {
            Ok(result) => {
                let is_malicious = result.threat_score > 0.7
                    || matches!(
                        result.risk_level,
                        crate::security_engine::RiskLevel::High
                            | crate::security_engine::RiskLevel::Critical
                    );

                let risk_factors: Vec<String> = result
                    .threat_types
                    .iter()
                    .map(|t| format!("{:?}", t))
                    .collect();

                Ok(Response::new(SecurityResponse {
                    success: true,
                    is_malicious,
                    threat_score: result.threat_score,
                    risk_factors,
                    confidence: result.confidence,
                    error: String::new(),
                }))
            }
            Err(e) => Ok(Response::new(SecurityResponse {
                success: false,
                is_malicious: false,
                threat_score: 0.0,
                risk_factors: vec![],
                confidence: 0.0,
                error: e.to_string(),
            })),
        }
    }
}

pub async fn start_grpc_server(
    engine: SecurityEngine,
    host: &str,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    let impl_ = SecurityEngineImpl::new(engine);

    tracing::info!("Starting gRPC server on {}", addr);

    Server::builder()
        .add_service(SecurityEngineServer::new(impl_))
        .serve(addr)
        .await?;

    Ok(())
}
