// PHANTOM-Flow High-Performance Packet Parser
// Rust implementation for fast network packet parsing and analysis

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Packet {
    pub id: u64,
    pub timestamp: u64,
    pub ethernet_header: EthernetHeader,
    pub ip_header: Option<IpHeader>,
    pub transport_header: Option<TransportHeader>,
    pub payload: Vec<u8>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthernetHeader {
    pub src_mac: [u8; 6],
    pub dst_mac: [u8; 6],
    pub ethertype: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IpHeader {
    V4(Ipv4Header),
    V6(Ipv6Header),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ipv4Header {
    pub version: u8,
    pub header_length: u8,
    pub type_of_service: u8,
    pub total_length: u16,
    pub identification: u16,
    pub flags: u8,
    pub fragment_offset: u16,
    pub time_to_live: u8,
    pub protocol: u8,
    pub header_checksum: u16,
    pub src_addr: Ipv4Addr,
    pub dst_addr: Ipv4Addr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ipv6Header {
    pub version: u8,
    pub traffic_class: u8,
    pub flow_label: u32,
    pub payload_length: u16,
    pub next_header: u8,
    pub hop_limit: u8,
    pub src_addr: Ipv6Addr,
    pub dst_addr: Ipv6Addr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportHeader {
    Tcp(TcpHeader),
    Udp(UdpHeader),
    Icmp(IcmpHeader),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpHeader {
    pub src_port: u16,
    pub dst_port: u16,
    pub sequence_number: u32,
    pub acknowledgment_number: u32,
    pub header_length: u8,
    pub flags: u8,
    pub window_size: u16,
    pub checksum: u16,
    pub urgent_pointer: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpHeader {
    pub src_port: u16,
    pub dst_port: u16,
    pub length: u16,
    pub checksum: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IcmpHeader {
    pub icmp_type: u8,
    pub code: u8,
    pub checksum: u16,
    pub rest_of_header: u32,
}

pub struct PacketParser {
    packet_count: u64,
    parse_errors: u64,
}

impl PacketParser {
    pub fn new() -> Self {
        Self {
            packet_count: 0,
            parse_errors: 0,
        }
    }

    pub fn parse(&mut self, raw_data: &[u8]) -> Result<Packet, ParseError> {
        self.packet_count += 1;
        
        if raw_data.len() < 14 {
            self.parse_errors += 1;
            return Err(ParseError::InsufficientData);
        }

        let ethernet_header = self.parse_ethernet_header(&raw_data[0..14])?;
        let mut offset = 14;

        let ip_header = match ethernet_header.ethertype {
            0x0800 => Some(self.parse_ipv4_header(&raw_data[offset..])?),
            0x86DD => Some(self.parse_ipv6_header(&raw_data[offset..])?),
            _ => None,
        };

        if let Some(ref ip) = ip_header {
            offset += match ip {
                IpHeader::V4(_) => 20,
                IpHeader::V6(_) => 40,
            };
        }

        let transport_header = if let Some(ref ip) = ip_header {
            match ip {
                IpHeader::V4(ipv4) => self.parse_transport_header(ipv4.protocol, &raw_data[offset..])?,
                IpHeader::V6(ipv6) => self.parse_transport_header(ipv6.next_header, &raw_data[offset..])?,
            }
        } else {
            None
        };

        if transport_header.is_some() {
            offset += match transport_header.as_ref().unwrap() {
                TransportHeader::Tcp(_) => 20,
                TransportHeader::Udp(_) => 8,
                TransportHeader::Icmp(_) => 8,
            };
        }

        let payload = if offset < raw_data.len() {
            raw_data[offset..].to_vec()
        } else {
            Vec::new()
        };

        Ok(Packet {
            id: self.packet_count,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            ethernet_header,
            ip_header,
            transport_header,
            payload,
            metadata: HashMap::new(),
        })
    }

    fn parse_ethernet_header(&self, data: &[u8]) -> Result<EthernetHeader, ParseError> {
        if data.len() < 14 {
            return Err(ParseError::InsufficientData);
        }

        let mut dst_mac = [0u8; 6];
        let mut src_mac = [0u8; 6];
        
        dst_mac.copy_from_slice(&data[0..6]);
        src_mac.copy_from_slice(&data[6..12]);
        
        let ethertype = u16::from_be_bytes([data[12], data[13]]);

        Ok(EthernetHeader {
            src_mac,
            dst_mac,
            ethertype,
        })
    }

    fn parse_ipv4_header(&self, data: &[u8]) -> Result<IpHeader, ParseError> {
        if data.len() < 20 {
            return Err(ParseError::InsufficientData);
        }

        let version = (data[0] >> 4) & 0x0F;
        let header_length = (data[0] & 0x0F) * 4;
        let type_of_service = data[1];
        let total_length = u16::from_be_bytes([data[2], data[3]]);
        let identification = u16::from_be_bytes([data[4], data[5]]);
        let flags = (data[6] >> 5) & 0x07;
        let fragment_offset = u16::from_be_bytes([data[6] & 0x1F, data[7]]);
        let time_to_live = data[8];
        let protocol = data[9];
        let header_checksum = u16::from_be_bytes([data[10], data[11]]);
        
        let src_addr = Ipv4Addr::new(data[12], data[13], data[14], data[15]);
        let dst_addr = Ipv4Addr::new(data[16], data[17], data[18], data[19]);

        Ok(IpHeader::V4(Ipv4Header {
            version,
            header_length,
            type_of_service,
            total_length,
            identification,
            flags,
            fragment_offset,
            time_to_live,
            protocol,
            header_checksum,
            src_addr,
            dst_addr,
        }))
    }

    fn parse_ipv6_header(&self, data: &[u8]) -> Result<IpHeader, ParseError> {
        if data.len() < 40 {
            return Err(ParseError::InsufficientData);
        }

        let version = (data[0] >> 4) & 0x0F;
        let traffic_class = ((data[0] & 0x0F) << 4) | ((data[1] >> 4) & 0x0F);
        let flow_label = u32::from_be_bytes([0, data[1] & 0x0F, data[2], data[3]]);
        let payload_length = u16::from_be_bytes([data[4], data[5]]);
        let next_header = data[6];
        let hop_limit = data[7];

        let src_addr = Ipv6Addr::from([
            data[8], data[9], data[10], data[11],
            data[12], data[13], data[14], data[15],
            data[16], data[17], data[18], data[19],
            data[20], data[21], data[22], data[23],
        ]);

        let dst_addr = Ipv6Addr::from([
            data[24], data[25], data[26], data[27],
            data[28], data[29], data[30], data[31],
            data[32], data[33], data[34], data[35],
            data[36], data[37], data[38], data[39],
        ]);

        Ok(IpHeader::V6(Ipv6Header {
            version,
            traffic_class,
            flow_label,
            payload_length,
            next_header,
            hop_limit,
            src_addr,
            dst_addr,
        }))
    }

    fn parse_transport_header(&self, protocol: u8, data: &[u8]) -> Result<Option<TransportHeader>, ParseError> {
        match protocol {
            6 => Ok(Some(TransportHeader::Tcp(self.parse_tcp_header(data)?))),
            17 => Ok(Some(TransportHeader::Udp(self.parse_udp_header(data)?))),
            1 => Ok(Some(TransportHeader::Icmp(self.parse_icmp_header(data)?))),
            _ => Ok(None),
        }
    }

    fn parse_tcp_header(&self, data: &[u8]) -> Result<TcpHeader, ParseError> {
        if data.len() < 20 {
            return Err(ParseError::InsufficientData);
        }

        let src_port = u16::from_be_bytes([data[0], data[1]]);
        let dst_port = u16::from_be_bytes([data[2], data[3]]);
        let sequence_number = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);
        let acknowledgment_number = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
        let header_length = (data[12] >> 4) * 4;
        let flags = data[13];
        let window_size = u16::from_be_bytes([data[14], data[15]]);
        let checksum = u16::from_be_bytes([data[16], data[17]]);
        let urgent_pointer = u16::from_be_bytes([data[18], data[19]]);

        Ok(TcpHeader {
            src_port,
            dst_port,
            sequence_number,
            acknowledgment_number,
            header_length,
            flags,
            window_size,
            checksum,
            urgent_pointer,
        })
    }

    fn parse_udp_header(&self, data: &[u8]) -> Result<UdpHeader, ParseError> {
        if data.len() < 8 {
            return Err(ParseError::InsufficientData);
        }

        let src_port = u16::from_be_bytes([data[0], data[1]]);
        let dst_port = u16::from_be_bytes([data[2], data[3]]);
        let length = u16::from_be_bytes([data[4], data[5]]);
        let checksum = u16::from_be_bytes([data[6], data[7]]);

        Ok(UdpHeader {
            src_port,
            dst_port,
            length,
            checksum,
        })
    }

    fn parse_icmp_header(&self, data: &[u8]) -> Result<IcmpHeader, ParseError> {
        if data.len() < 8 {
            return Err(ParseError::InsufficientData);
        }

        let icmp_type = data[0];
        let code = data[1];
        let checksum = u16::from_be_bytes([data[2], data[3]]);
        let rest_of_header = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);

        Ok(IcmpHeader {
            icmp_type,
            code,
            checksum,
            rest_of_header,
        })
    }

    pub fn get_stats(&self) -> ParserStats {
        ParserStats {
            packets_parsed: self.packet_count,
            parse_errors: self.parse_errors,
            success_rate: if self.packet_count > 0 {
                1.0 - (self.parse_errors as f64 / self.packet_count as f64)
            } else {
                0.0
            },
        }
    }
}

#[derive(Debug, Clone)]
pub struct ParserStats {
    pub packets_parsed: u64,
    pub parse_errors: u64,
    pub success_rate: f64,
}

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("Insufficient data for parsing")]
    InsufficientData,
    #[error("Invalid packet format")]
    InvalidFormat,
    #[error("Unsupported protocol: {0}")]
    UnsupportedProtocol(u8),
}

impl Default for PacketParser {
    fn default() -> Self {
        Self::new()
    }
}
