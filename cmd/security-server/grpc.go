package main

import (
	"context"
	"fmt"
	"net"
	"time"

	pb "github.com/phantom-flow/security-platform/proto/threat"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type gRPCServer struct {
	pb.UnimplementedThreatAnalysisServer
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

	pb.RegisterThreatAnalysisServer(s.server, s)

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

func (s *gRPCServer) AnalyzeThreat(ctx context.Context, req *pb.ThreatRequest) (*pb.ThreatResponse, error) {
	threatReq := &ThreatAnalysisRequest{
		IPAddress:   req.GetClientIp(),
		UserAgent:   req.GetUserAgent(),
		Method:      req.GetRequestMethod(),
		RequestPath: req.GetRequestPath(),
		Headers:     req.GetHeaders(),
		SessionID:   req.GetSessionId(),
		Timestamp:   time.Now(),
	}

	response, err := s.engine.AnalyzeThreat(ctx, threatReq)
	if err != nil {
		s.logger.WithError(err).Error("gRPC threat analysis failed")
		return nil, err
	}

	var threatType string
	if len(response.ThreatTypes) > 0 {
		threatType = response.ThreatTypes[0]
	}

	return &pb.ThreatResponse{
		Success:           true,
		ThreatScore:       response.ThreatScore,
		Confidence:        response.Confidence,
		RiskLevel:         response.RiskLevel,
		ThreatType:        threatType,
		SignaturesMatched: nil,
	}, nil
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
