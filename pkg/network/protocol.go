// PHANTOM-Flow Network Protocol Handler
package network

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

type ProtocolHandler struct {
	handlers map[ProtocolType]ProtocolProcessor
	timeout  time.Duration
}

type ProtocolType int

const (
	HTTP ProtocolType = iota
	HTTPS
	TCP
	UDP
	ICMP
	DNS
	FTP
	SSH
	SMTP
	Unknown
)

type ProtocolProcessor interface {
	Process(data []byte) (*ProtocolResult, error)
	GetType() ProtocolType
	Validate(data []byte) bool
}

type ProtocolResult struct {
	Type        ProtocolType            `json:"type"`
	Valid       bool                    `json:"valid"`
	Data        map[string]interface{}  `json:"data"`
	Metadata    map[string]string       `json:"metadata"`
	Timestamp   time.Time               `json:"timestamp"`
	Size        int                     `json:"size"`
	Source      string                  `json:"source"`
	Destination string                  `json:"destination"`
}

type HTTPProcessor struct{}

func (h *HTTPProcessor) Process(data []byte) (*ProtocolResult, error) {
	result := &ProtocolResult{
		Type:      HTTP,
		Data:      make(map[string]interface{}),
		Metadata:  make(map[string]string),
		Timestamp: time.Now(),
		Size:      len(data),
	}

	// Parse HTTP headers
	lines := bytes.Split(data, []byte("\r\n"))
	if len(lines) == 0 {
		return result, fmt.Errorf("invalid HTTP data")
	}

	// Parse request line
	requestLine := string(lines[0])
	parts := bytes.Fields([]byte(requestLine))
	if len(parts) >= 3 {
		result.Data["method"] = string(parts[0])
		result.Data["path"] = string(parts[1])
		result.Data["version"] = string(parts[2])
	}

	// Parse headers
	for i := 1; i < len(lines); i++ {
		line := string(lines[i])
		if line == "" {
			break
		}
		
		if colonIndex := bytes.IndexByte(lines[i], ':'); colonIndex > 0 {
			headerName := string(lines[i][:colonIndex])
			headerValue := string(bytes.TrimSpace(lines[i][colonIndex+1:]))
			result.Metadata[headerName] = headerValue
		}
	}

	result.Valid = h.Validate(data)
	return result, nil
}

func (h *HTTPProcessor) GetType() ProtocolType {
	return HTTP
}

func (h *HTTPProcessor) Validate(data []byte) bool {
	// Basic HTTP validation
	return bytes.HasPrefix(data, []byte("GET ")) ||
		   bytes.HasPrefix(data, []byte("POST ")) ||
		   bytes.HasPrefix(data, []byte("PUT ")) ||
		   bytes.HasPrefix(data, []byte("DELETE ")) ||
		   bytes.HasPrefix(data, []byte("HEAD ")) ||
		   bytes.HasPrefix(data, []byte("OPTIONS "))
}

type TCPProcessor struct{}

func (t *TCPProcessor) Process(data []byte) (*ProtocolResult, error) {
	result := &ProtocolResult{
		Type:      TCP,
		Data:      make(map[string]interface{}),
		Metadata:  make(map[string]string),
		Timestamp: time.Now(),
		Size:      len(data),
	}

	if len(data) < 20 {
		return result, fmt.Errorf("TCP header too short")
	}

	// Parse TCP header
	srcPort := binary.BigEndian.Uint16(data[0:2])
	dstPort := binary.BigEndian.Uint16(data[2:4])
	seqNum := binary.BigEndian.Uint32(data[4:8])
	ackNum := binary.BigEndian.Uint32(data[8:12])
	flags := data[13]
	window := binary.BigEndian.Uint16(data[14:16])

	result.Data["src_port"] = srcPort
	result.Data["dst_port"] = dstPort
	result.Data["seq_num"] = seqNum
	result.Data["ack_num"] = ackNum
	result.Data["flags"] = flags
	result.Data["window"] = window

	result.Metadata["source"] = fmt.Sprintf(":%d", srcPort)
	result.Metadata["destination"] = fmt.Sprintf(":%d", dstPort)

	result.Valid = t.Validate(data)
	return result, nil
}

func (t *TCPProcessor) GetType() ProtocolType {
	return TCP
}

func (t *TCPProcessor) Validate(data []byte) bool {
	return len(data) >= 20
}

type UDPProcessor struct{}

func (u *UDPProcessor) Process(data []byte) (*ProtocolResult, error) {
	result := &ProtocolResult{
		Type:      UDP,
		Data:      make(map[string]interface{}),
		Metadata:  make(map[string]string),
		Timestamp: time.Now(),
		Size:      len(data),
	}

	if len(data) < 8 {
		return result, fmt.Errorf("UDP header too short")
	}

	// Parse UDP header
	srcPort := binary.BigEndian.Uint16(data[0:2])
	dstPort := binary.BigEndian.Uint16(data[2:4])
	length := binary.BigEndian.Uint16(data[4:6])
	checksum := binary.BigEndian.Uint16(data[6:8])

	result.Data["src_port"] = srcPort
	result.Data["dst_port"] = dstPort
	result.Data["length"] = length
	result.Data["checksum"] = checksum

	result.Metadata["source"] = fmt.Sprintf(":%d", srcPort)
	result.Metadata["destination"] = fmt.Sprintf(":%d", dstPort)

	result.Valid = u.Validate(data)
	return result, nil
}

func (u *UDPProcessor) GetType() ProtocolType {
	return UDP
}

func (u *UDPProcessor) Validate(data []byte) bool {
	return len(data) >= 8
}

type DNSProcessor struct{}

func (d *DNSProcessor) Process(data []byte) (*ProtocolResult, error) {
	result := &ProtocolResult{
		Type:      DNS,
		Data:      make(map[string]interface{}),
		Metadata:  make(map[string]string),
		Timestamp: time.Now(),
		Size:      len(data),
	}

	if len(data) < 12 {
		return result, fmt.Errorf("DNS header too short")
	}

	// Parse DNS header
	transactionID := binary.BigEndian.Uint16(data[0:2])
	flags := binary.BigEndian.Uint16(data[2:4])
	questions := binary.BigEndian.Uint16(data[4:6])
	answers := binary.BigEndian.Uint16(data[6:8])

	result.Data["transaction_id"] = transactionID
	result.Data["flags"] = flags
	result.Data["questions"] = questions
	result.Data["answers"] = answers

	result.Valid = d.Validate(data)
	return result, nil
}

func (d *DNSProcessor) GetType() ProtocolType {
	return DNS
}

func (d *DNSProcessor) Validate(data []byte) bool {
	return len(data) >= 12
}

func NewProtocolHandler(timeout time.Duration) *ProtocolHandler {
	handler := &ProtocolHandler{
		handlers: make(map[ProtocolType]ProtocolProcessor),
		timeout:  timeout,
	}

	// Register default processors
	handler.RegisterProcessor(&HTTPProcessor{})
	handler.RegisterProcessor(&TCPProcessor{})
	handler.RegisterProcessor(&UDPProcessor{})
	handler.RegisterProcessor(&DNSProcessor{})

	return handler
}

func (ph *ProtocolHandler) RegisterProcessor(processor ProtocolProcessor) {
	ph.handlers[processor.GetType()] = processor
}

func (ph *ProtocolHandler) ProcessPacket(data []byte, src, dst net.IP) (*ProtocolResult, error) {
	protocolType := ph.detectProtocol(data)
	
	processor, exists := ph.handlers[protocolType]
	if !exists {
		return &ProtocolResult{
			Type:      Unknown,
			Valid:     false,
			Data:      make(map[string]interface{}),
			Metadata:  make(map[string]string),
			Timestamp: time.Now(),
			Size:      len(data),
			Source:    src.String(),
			Destination: dst.String(),
		}, fmt.Errorf("no processor for protocol type %d", protocolType)
	}

	result, err := processor.Process(data)
	if err != nil {
		return result, err
	}

	result.Source = src.String()
	result.Destination = dst.String()
	return result, nil
}

func (ph *ProtocolHandler) detectProtocol(data []byte) ProtocolType {
	if len(data) == 0 {
		return Unknown
	}

	// Check for HTTP
	if bytes.HasPrefix(data, []byte("GET ")) ||
	   bytes.HasPrefix(data, []byte("POST ")) ||
	   bytes.HasPrefix(data, []byte("PUT ")) ||
	   bytes.HasPrefix(data, []byte("DELETE ")) {
		return HTTP
	}

	// Check for DNS (port 53)
	if len(data) >= 12 {
		// Simple heuristic: DNS packets often have specific patterns
		return DNS
	}

	// Check for TCP (assume if not HTTP and has reasonable length)
	if len(data) >= 20 {
		return TCP
	}

	// Check for UDP (shorter packets)
	if len(data) >= 8 {
		return UDP
	}

	return Unknown
}

func (ph *ProtocolHandler) GetSupportedProtocols() []ProtocolType {
	protocols := make([]ProtocolType, 0, len(ph.handlers))
	for protocolType := range ph.handlers {
		protocols = append(protocols, protocolType)
	}
	return protocols
}

func (ph *ProtocolHandler) ValidatePacket(data []byte, protocolType ProtocolType) bool {
	processor, exists := ph.handlers[protocolType]
	if !exists {
		return false
	}
	return processor.Validate(data)
}
