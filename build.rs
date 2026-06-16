fn main() {
    // Only compile protos when the grpc feature is enabled AND protoc is available
    #[cfg(feature = "grpc")]
    {
        let protos = ["proto/engine_service.proto", "proto/events.proto"];
        for proto in &protos {
            match tonic_build::compile_protos(proto) {
                Ok(_) => println!("cargo:warning=Compiled {}", proto),
                Err(e) => {
                    let msg = e.to_string();
                    if msg.contains("protoc") {
                        println!("cargo:warning=protoc not found — proto compilation skipped for {}", proto);
                        println!("cargo:warning=Set PROTOC env var or install protobuf compiler");
                        // Generate marker so grpc_service can detect missing protoc
                        std::fs::write(
                            std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("protoc_unavailable"),
                            ""
                        ).ok();
                    } else {
                        panic!("Failed to compile {}: {}", proto, msg);
                    }
                }
            }
        }
    }
    #[cfg(not(feature = "grpc"))]
    {
        println!("cargo:warning=gRPC feature not enabled — skipping proto compilation");
        std::fs::write(
            std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("grpc_not_enabled"),
            ""
        ).ok();
    }
}
