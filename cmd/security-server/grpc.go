//go:generate protoc -I ../../proto --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ../../proto/threat_service.proto

package main

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type gRPCServer struct {
	server   *grpc.Server
	engine   *ThreatEngine
	logger   *logrus.Logger
	config   *Config
}

func newGRPCServer(engine *ThreatEngine, logger *logrus.Logger, config *Config) *gRPCServer {
	return &gRPCServer{
		engine: engine,
		logger: logger,
		config: config,
	}
}

func (s *gRPCServer) Start(port int) error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("failed to listen on gRPC port %d: %w", port, err)
	}

	s.server = grpc.NewServer(
		grpc.UnaryInterceptor(s.unaryInterceptor),
	)

	// Register the ThreatAnalysis service
	// This requires generated protobuf code from:
	// protoc -I ../../proto --go_out=. --go_opt=paths=source_relative
	//   --go-grpc_out=. --go-grpc_opt=paths=source_relative
	//   ../../proto/threat_service.proto
	//
	// Once generated:
	//   pb.RegisterThreatAnalysisServer(s.server, s)

	reflection.Register(s.server)

	s.logger.WithField("port", port).Info("gRPC server started")

	return s.server.Serve(lis)
}

func (s *gRPCServer) Stop() {
	if s.server != nil {
		stopped := make(chan struct{})
		go func() {
			s.server.GracefulStop()
			close(stopped)
		}()
		select {
		case <-stopped:
		case <-time.After(10 * time.Second):
			s.server.Stop()
		}
	}
}

// AnalyzeThreat implements the gRPC ThreatAnalysis.AnalyzeThreat RPC.
// This method is wired to the generated protobuf service once stubs are generated.
func (s *gRPCServer) AnalyzeThreat(ctx context.Context, req *ThreatAnalysisRequest) (*ThreatAnalysisResponse, error) {
	startTime := time.Now()

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	response, err := s.engine.AnalyzeThreat(ctx, req)
	if err != nil {
		s.logger.WithError(err).Error("gRPC threat analysis failed")
		return nil, err
	}

	response.ProcessingTime = time.Since(startTime).Seconds()
	response.RequestID = generateRequestID()
	response.Timestamp = time.Now()

	return response, nil
}

func (s *gRPCServer) unaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	duration := time.Since(start)

	s.logger.WithFields(logrus.Fields{
		"method":   info.FullMethod,
		"duration": duration.String(),
		"error":    err,
	}).Debug("gRPC unary call")

	return resp, err
}
