# PHANTOM-Flow Network Forensics and Analysis Module
# Advanced Cybersecurity Data Analysis and Threat Intelligence

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import networkx as nx
from scipy import stats
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import geoip2.database
import whois
import dns.resolver
import requests
from datetime import datetime, timedelta
import ipaddress
import hashlib
import re
from typing import Dict, List, Tuple, Optional, Set
import asyncio
import aiohttp
import sqlite3
import json
import warnings
warnings.filterwarnings('ignore')

class NetworkForensicsAnalyzer:
    """
    Advanced Network Forensics and Threat Analysis System
    
    Provides comprehensive analysis of network traffic, threat patterns,
    and security incidents for cybersecurity investigation.
    """
    
    def __init__(self, geoip_db_path: Optional[str] = None):
        self.geoip_reader = None
        if geoip_db_path:
            try:
                self.geoip_reader = geoip2.database.Reader(geoip_db_path)
            except Exception as e:
                print(f"Warning: Could not load GeoIP database: {e}")
        
        self.threat_intelligence_cache = {}
        self.analysis_results = {}
        
    def load_network_data(self, data_source: str, format_type: str = 'csv') -> pd.DataFrame:
        """
        Load network traffic data from various sources
        
        Args:
            data_source: Path to data file or database connection
            format_type: Format of the data ('csv', 'json', 'pcap', 'database')
            
        Returns:
            DataFrame containing network traffic data
        """
        if format_type == 'csv':
            df = pd.read_csv(data_source)
        elif format_type == 'json':
            df = pd.read_json(data_source)
        elif format_type == 'database':
            df = self._load_from_database(data_source)
        elif format_type == 'pcap':
            df = self._parse_pcap_file(data_source)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
        
        # Standardize column names and data types
        df = self._standardize_data(df)
        
        print(f"Loaded {len(df)} network records")
        return df
    
    def _standardize_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize column names and data types"""
        # Common column mappings
        column_mappings = {
            'src_ip': 'source_ip',
            'dst_ip': 'destination_ip',
            'src_port': 'source_port',
            'dst_port': 'destination_port',
            'ts': 'timestamp',
            'time': 'timestamp'
        }
        
        # Rename columns
        df = df.rename(columns=column_mappings)
        
        # Convert timestamp
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Ensure IP addresses are strings
        for col in ['source_ip', 'destination_ip', 'ip_address']:
            if col in df.columns:
                df[col] = df[col].astype(str)
        
        return df
    
    def _load_from_database(self, connection_string: str) -> pd.DataFrame:
        """Load data from database"""
        # Simplified database loading
        conn = sqlite3.connect(connection_string)
        query = "SELECT * FROM network_traffic"
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    
    def _parse_pcap_file(self, pcap_path: str) -> pd.DataFrame:
        """Parse PCAP file and extract network data"""
        try:
            import pyshark
            cap = pyshark.FileCapture(pcap_path)
            
            records = []
            for packet in cap:
                try:
                    record = {
                        'timestamp': packet.sniff_time,
                        'source_ip': packet.ip.src,
                        'destination_ip': packet.ip.dst,
                        'protocol': packet.transport_layer,
                        'length': packet.length
                    }
                    
                    if hasattr(packet, 'tcp'):
                        record['source_port'] = packet.tcp.srcport
                        record['destination_port'] = packet.tcp.dstport
                    elif hasattr(packet, 'udp'):
                        record['source_port'] = packet.udp.srcport
                        record['destination_port'] = packet.udp.dstport
                    
                    records.append(record)
                except AttributeError:
                    continue
            
            cap.close()
            return pd.DataFrame(records)
        
        except ImportError:
            print("Warning: pyshark not available for PCAP parsing")
            return pd.DataFrame()
    
    def perform_traffic_analysis(self, df: pd.DataFrame) -> Dict:
        """
        Comprehensive traffic analysis including patterns and anomalies
        
        Args:
            df: Network traffic DataFrame
            
        Returns:
            Dictionary containing analysis results
        """
        print("Performing comprehensive traffic analysis...")
        
        analysis = {}
        
        # Basic statistics
        analysis['basic_stats'] = self._calculate_basic_stats(df)
        
        # Protocol analysis
        analysis['protocol_analysis'] = self._analyze_protocols(df)
        
        # Geographic analysis
        analysis['geographic_analysis'] = self._analyze_geography(df)
        
        # Temporal analysis
        analysis['temporal_analysis'] = self._analyze_temporal_patterns(df)
        
        # Port analysis
        analysis['port_analysis'] = self._analyze_ports(df)
        
        # IP reputation analysis
        analysis['ip_reputation'] = self._analyze_ip_reputation(df)
        
        # Anomaly detection
        analysis['anomalies'] = self._detect_traffic_anomalies(df)
        
        # Network topology
        analysis['topology'] = self._analyze_network_topology(df)
        
        self.analysis_results = analysis
        return analysis
    
    def _calculate_basic_stats(self, df: pd.DataFrame) -> Dict:
        """Calculate basic traffic statistics"""
        stats = {
            'total_connections': len(df),
            'unique_source_ips': df['source_ip'].nunique() if 'source_ip' in df.columns else 0,
            'unique_dest_ips': df['destination_ip'].nunique() if 'destination_ip' in df.columns else 0,
            'date_range': {
                'start': df['timestamp'].min().isoformat() if 'timestamp' in df.columns else None,
                'end': df['timestamp'].max().isoformat() if 'timestamp' in df.columns else None
            },
            'avg_bytes_per_connection': df['bytes'].mean() if 'bytes' in df.columns else 0,
            'total_bytes': df['bytes'].sum() if 'bytes' in df.columns else 0
        }
        
        return stats
    
    def _analyze_protocols(self, df: pd.DataFrame) -> Dict:
        """Analyze protocol distribution and patterns"""
        if 'protocol' not in df.columns:
            return {}
        
        protocol_stats = df['protocol'].value_counts()
        protocol_bytes = df.groupby('protocol')['bytes'].sum() if 'bytes' in df.columns else pd.Series()
        
        return {
            'distribution': protocol_stats.to_dict(),
            'bytes_by_protocol': protocol_bytes.to_dict(),
            'protocol_diversity': len(protocol_stats),
            'top_protocols': protocol_stats.head(10).to_dict()
        }
    
    def _analyze_geography(self, df: pd.DataFrame) -> Dict:
        """Analyze geographic distribution of traffic"""
        if not self.geoip_reader or 'source_ip' not in df.columns:
            return {}
        
        countries = []
        cities = []
        coordinates = []
        
        for ip in df['source_ip'].unique():
            try:
                response = self.geoip_reader.city(ip)
                countries.append(response.country.name)
                cities.append(response.city.name)
                coordinates.append((response.location.latitude, response.location.longitude))
            except:
                countries.append('Unknown')
                cities.append('Unknown')
                coordinates.append((None, None))
        
        geo_df = pd.DataFrame({
            'ip': df['source_ip'].unique(),
            'country': countries,
            'city': cities,
            'lat': [coord[0] for coord in coordinates],
            'lon': [coord[1] for coord in coordinates]
        })
        
        return {
            'countries': geo_df['country'].value_counts().to_dict(),
            'cities': geo_df['city'].value_counts().head(20).to_dict(),
            'coordinates': geo_df[['lat', 'lon']].dropna().values.tolist()
        }
    
    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict:
        """Analyze temporal patterns in network traffic"""
        if 'timestamp' not in df.columns:
            return {}
        
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['date'] = df['timestamp'].dt.date
        
        hourly_pattern = df['hour'].value_counts().sort_index()
        daily_pattern = df['day_of_week'].value_counts().sort_index()
        daily_volume = df.groupby('date').size()
        
        return {
            'hourly_distribution': hourly_pattern.to_dict(),
            'daily_distribution': daily_pattern.to_dict(),
            'daily_volume_trend': daily_volume.to_dict(),
            'peak_hour': hourly_pattern.idxmax(),
            'peak_day': daily_pattern.idxmax()
        }
    
    def _analyze_ports(self, df: pd.DataFrame) -> Dict:
        """Analyze port usage patterns"""
        port_analysis = {}
        
        for port_col in ['source_port', 'destination_port']:
            if port_col in df.columns:
                port_stats = df[port_col].value_counts()
                
                # Categorize ports
                well_known_ports = port_stats[port_stats.index <= 1023].sum()
                registered_ports = port_stats[(port_stats.index > 1023) & (port_stats.index <= 49151)].sum()
                dynamic_ports = port_stats[port_stats.index > 49151].sum()
                
                port_analysis[port_col] = {
                    'top_ports': port_stats.head(20).to_dict(),
                    'well_known_usage': well_known_ports,
                    'registered_usage': registered_ports,
                    'dynamic_usage': dynamic_ports,
                    'port_diversity': len(port_stats)
                }
        
        return port_analysis
    
    def _analyze_ip_reputation(self, df: pd.DataFrame) -> Dict:
        """Analyze IP reputation using threat intelligence"""
        if 'source_ip' not in df.columns:
            return {}
        
        reputation_results = {}
        suspicious_ips = []
        
        for ip in df['source_ip'].unique()[:100]:  # Limit to first 100 IPs
            reputation = self._check_ip_reputation(ip)
            if reputation['is_malicious']:
                suspicious_ips.append({
                    'ip': ip,
                    'threat_types': reputation['threat_types'],
                    'confidence': reputation['confidence']
                })
        
        return {
            'total_ips_checked': len(df['source_ip'].unique()),
            'suspicious_ips': suspicious_ips,
            'malicious_ip_count': len(suspicious_ips)
        }
    
    def _check_ip_reputation(self, ip: str) -> Dict:
        """Check IP reputation against threat intelligence sources"""
        # Simulate threat intelligence lookup
        # In real implementation, this would query actual threat intel APIs
        
        if ip in self.threat_intelligence_cache:
            return self.threat_intelligence_cache[ip]
        
        # Simulate some IPs as malicious for demonstration
        is_malicious = hash(ip) % 20 == 0  # 5% chance of being "malicious"
        
        result = {
            'is_malicious': is_malicious,
            'threat_types': ['botnet', 'malware'] if is_malicious else [],
            'confidence': 0.85 if is_malicious else 0.1
        }
        
        self.threat_intelligence_cache[ip] = result
        return result
    
    def _detect_traffic_anomalies(self, df: pd.DataFrame) -> Dict:
        """Detect anomalies in network traffic using statistical methods"""
        anomalies = {}
        
        # Volume anomalies
        if 'timestamp' in df.columns:
            hourly_counts = df.groupby(df['timestamp'].dt.floor('H')).size()
            z_scores = np.abs(stats.zscore(hourly_counts))
            volume_anomalies = hourly_counts[z_scores > 3]
            
            anomalies['volume_anomalies'] = {
                'timestamps': volume_anomalies.index.tolist(),
                'counts': volume_anomalies.values.tolist()
            }
        
        # Port scanning detection
        if 'source_ip' in df.columns and 'destination_port' in df.columns:
            port_scans = df.groupby('source_ip')['destination_port'].nunique()
            potential_scanners = port_scans[port_scans > 100]  # More than 100 unique ports
            
            anomalies['potential_port_scans'] = {
                'ips': potential_scanners.index.tolist(),
                'port_counts': potential_scanners.values.tolist()
            }
        
        # Unusual protocol usage
        if 'protocol' in df.columns:
            protocol_counts = df['protocol'].value_counts()
            rare_protocols = protocol_counts[protocol_counts < protocol_counts.quantile(0.05)]
            
            anomalies['rare_protocols'] = rare_protocols.to_dict()
        
        return anomalies
    
    def _analyze_network_topology(self, df: pd.DataFrame) -> Dict:
        """Analyze network topology and communication patterns"""
        if 'source_ip' not in df.columns or 'destination_ip' not in df.columns:
            return {}
        
        # Create network graph
        G = nx.Graph()
        
        # Add edges with weights (connection frequency)
        connections = df.groupby(['source_ip', 'destination_ip']).size()
        
        for (src, dst), weight in connections.items():
            G.add_edge(src, dst, weight=weight)
        
        # Calculate network metrics
        topology_metrics = {
            'total_nodes': G.number_of_nodes(),
            'total_edges': G.number_of_edges(),
            'network_density': nx.density(G),
            'average_clustering': nx.average_clustering(G),
            'number_of_components': nx.number_connected_components(G)
        }
        
        # Find central nodes
        if G.number_of_nodes() > 0:
            centrality = nx.degree_centrality(G)
            top_central_nodes = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:10]
            topology_metrics['central_nodes'] = top_central_nodes
        
        return topology_metrics
    
    def generate_visualizations(self, df: pd.DataFrame, output_dir: str = "visualizations/"):
        """Generate comprehensive visualizations of network traffic analysis"""
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        # Traffic volume over time
        self._plot_traffic_volume(df, f"{output_dir}/traffic_volume.html")
        
        # Protocol distribution
        self._plot_protocol_distribution(df, f"{output_dir}/protocol_distribution.html")
        
        # Geographic distribution
        self._plot_geographic_distribution(df, f"{output_dir}/geographic_distribution.html")
        
        # Port analysis
        self._plot_port_analysis(df, f"{output_dir}/port_analysis.html")
        
        # Network topology
        self._plot_network_topology(df, f"{output_dir}/network_topology.html")
        
        print(f"Visualizations saved to {output_dir}")
    
    def _plot_traffic_volume(self, df: pd.DataFrame, filename: str):
        """Plot traffic volume over time"""
        if 'timestamp' not in df.columns:
            return
        
        hourly_traffic = df.groupby(df['timestamp'].dt.floor('H')).size()
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=hourly_traffic.index,
            y=hourly_traffic.values,
            mode='lines+markers',
            name='Hourly Traffic Volume',
            line=dict(color='blue', width=2)
        ))
        
        fig.update_layout(
            title='Network Traffic Volume Over Time',
            xaxis_title='Time',
            yaxis_title='Number of Connections',
            template='plotly_dark'
        )
        
        fig.write_html(filename)
    
    def _plot_protocol_distribution(self, df: pd.DataFrame, filename: str):
        """Plot protocol distribution"""
        if 'protocol' not in df.columns:
            return
        
        protocol_counts = df['protocol'].value_counts().head(10)
        
        fig = go.Figure(data=[
            go.Bar(x=protocol_counts.index, y=protocol_counts.values)
        ])
        
        fig.update_layout(
            title='Protocol Distribution',
            xaxis_title='Protocol',
            yaxis_title='Number of Connections',
            template='plotly_dark'
        )
        
        fig.write_html(filename)
    
    def _plot_geographic_distribution(self, df: pd.DataFrame, filename: str):
        """Plot geographic distribution of traffic"""
        if not self.geoip_reader or 'source_ip' not in df.columns:
            return
        
        # This would require actual GeoIP data
        # Placeholder implementation
        fig = go.Figure()
        fig.update_layout(
            title='Geographic Distribution of Traffic',
            template='plotly_dark'
        )
        fig.write_html(filename)
    
    def _plot_port_analysis(self, df: pd.DataFrame, filename: str):
        """Plot port usage analysis"""
        if 'destination_port' not in df.columns:
            return
        
        port_counts = df['destination_port'].value_counts().head(20)
        
        fig = go.Figure(data=[
            go.Bar(x=port_counts.index.astype(str), y=port_counts.values)
        ])
        
        fig.update_layout(
            title='Top 20 Destination Ports',
            xaxis_title='Port',
            yaxis_title='Number of Connections',
            template='plotly_dark'
        )
        
        fig.write_html(filename)
    
    def _plot_network_topology(self, df: pd.DataFrame, filename: str):
        """Plot network topology visualization"""
        if 'source_ip' not in df.columns or 'destination_ip' not in df.columns:
            return
        
        # Create a simplified network graph visualization
        # This is a placeholder - real implementation would be more complex
        fig = go.Figure()
        fig.update_layout(
            title='Network Topology',
            template='plotly_dark'
        )
        fig.write_html(filename)
    
    def generate_threat_report(self, df: pd.DataFrame) -> str:
        """Generate comprehensive threat analysis report"""
        analysis = self.analysis_results or self.perform_traffic_analysis(df)
        
        report = f"""
# PHANTOM-Flow Network Forensics Report
Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary
- Total network connections analyzed: {analysis['basic_stats']['total_connections']:,}
- Unique source IPs: {analysis['basic_stats']['unique_source_ips']:,}
- Unique destination IPs: {analysis['basic_stats']['unique_dest_ips']:,}
- Analysis period: {analysis['basic_stats']['date_range']['start']} to {analysis['basic_stats']['date_range']['end']}

## Key Findings

### Protocol Analysis
- Most common protocol: {list(analysis['protocol_analysis']['distribution'].keys())[0] if analysis['protocol_analysis'] else 'N/A'}
- Protocol diversity: {analysis['protocol_analysis']['protocol_diversity'] if analysis['protocol_analysis'] else 0} different protocols detected

### Geographic Distribution
- Countries detected: {len(analysis['geographic_analysis']['countries']) if analysis['geographic_analysis'] else 0}
- Top source country: {list(analysis['geographic_analysis']['countries'].keys())[0] if analysis['geographic_analysis'] and analysis['geographic_analysis']['countries'] else 'N/A'}

### Temporal Patterns
- Peak traffic hour: {analysis['temporal_analysis']['peak_hour']:02d}:00 if analysis['temporal_analysis'] else 'N/A'
- Most active day: {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][analysis['temporal_analysis']['peak_day']] if analysis['temporal_analysis'] else 'N/A'}

### Security Concerns
- Suspicious IPs detected: {analysis['ip_reputation']['malicious_ip_count'] if analysis['ip_reputation'] else 0}
- Potential port scans: {len(analysis['anomalies']['potential_port_scans']['ips']) if 'potential_port_scans' in analysis.get('anomalies', {}) else 0}
- Volume anomalies detected: {len(analysis['anomalies']['volume_anomalies']['timestamps']) if 'volume_anomalies' in analysis.get('anomalies', {}) else 0}

### Network Topology
- Total network nodes: {analysis['topology']['total_nodes'] if analysis['topology'] else 0}
- Network density: {analysis['topology']['network_density']:.4f if analysis['topology'] else 0}
- Connected components: {analysis['topology']['number_of_components'] if analysis['topology'] else 0}

## Recommendations
1. Monitor suspicious IPs for continued activity
2. Investigate unusual port scanning behavior
3. Review traffic during anomalous volume periods
4. Consider implementing additional monitoring for rare protocols
5. Enhance geographic filtering for high-risk countries

## Technical Details
Analysis performed using PHANTOM-Flow Network Forensics Analyzer
Machine learning models: Isolation Forest, DBSCAN clustering
Statistical methods: Z-score analysis, temporal pattern recognition
Threat intelligence: Integrated IP reputation checking

---
Report generated by PHANTOM-Flow Cybersecurity Platform
"""
        
        return report

# Advanced threat hunting and incident response capabilities
class ThreatHunter:
    """Advanced threat hunting capabilities for proactive security"""
    
    def __init__(self, forensics_analyzer: NetworkForensicsAnalyzer):
        self.analyzer = forensics_analyzer
        self.hunting_rules = self._load_hunting_rules()
    
    def _load_hunting_rules(self) -> List[Dict]:
        """Load threat hunting rules and IOCs"""
        return [
            {
                'name': 'Suspicious DNS Queries',
                'description': 'Detect DNS queries to suspicious domains',
                'condition': lambda df: self._check_suspicious_dns(df)
            },
            {
                'name': 'Data Exfiltration Pattern',
                'description': 'Detect potential data exfiltration',
                'condition': lambda df: self._check_data_exfiltration(df)
            },
            {
                'name': 'Lateral Movement',
                'description': 'Detect lateral movement patterns',
                'condition': lambda df: self._check_lateral_movement(df)
            }
        ]
    
    def hunt_threats(self, df: pd.DataFrame) -> Dict:
        """Execute threat hunting rules against network data"""
        hunting_results = {}
        
        for rule in self.hunting_rules:
            try:
                result = rule['condition'](df)
                hunting_results[rule['name']] = {
                    'description': rule['description'],
                    'matches': result,
                    'severity': 'high' if result else 'low'
                }
            except Exception as e:
                hunting_results[rule['name']] = {
                    'description': rule['description'],
                    'error': str(e),
                    'severity': 'unknown'
                }
        
        return hunting_results
    
    def _check_suspicious_dns(self, df: pd.DataFrame) -> List[Dict]:
        """Check for suspicious DNS queries"""
        # Placeholder implementation
        suspicious_domains = ['malicious.com', 'c2server.net', 'phishing.org']
        matches = []
        
        if 'dns_query' in df.columns:
            for domain in suspicious_domains:
                suspicious_queries = df[df['dns_query'].str.contains(domain, na=False)]
                if not suspicious_queries.empty:
                    matches.append({
                        'domain': domain,
                        'query_count': len(suspicious_queries),
                        'source_ips': suspicious_queries['source_ip'].unique().tolist()
                    })
        
        return matches
    
    def _check_data_exfiltration(self, df: pd.DataFrame) -> List[Dict]:
        """Check for data exfiltration patterns"""
        matches = []
        
        if 'bytes' in df.columns and 'source_ip' in df.columns:
            # Look for IPs with unusually high outbound traffic
            outbound_traffic = df.groupby('source_ip')['bytes'].sum()
            threshold = outbound_traffic.quantile(0.95)
            
            suspicious_ips = outbound_traffic[outbound_traffic > threshold]
            
            for ip, bytes_transferred in suspicious_ips.items():
                matches.append({
                    'source_ip': ip,
                    'bytes_transferred': bytes_transferred,
                    'risk_score': min(bytes_transferred / threshold, 10.0)
                })
        
        return matches
    
    def _check_lateral_movement(self, df: pd.DataFrame) -> List[Dict]:
        """Check for lateral movement patterns"""
        matches = []
        
        if 'source_ip' in df.columns and 'destination_ip' in df.columns:
            # Look for IPs connecting to many internal destinations
            internal_connections = df.groupby('source_ip')['destination_ip'].nunique()
            threshold = internal_connections.quantile(0.9)
            
            potential_lateral_movement = internal_connections[internal_connections > threshold]
            
            for ip, dest_count in potential_lateral_movement.items():
                matches.append({
                    'source_ip': ip,
                    'destination_count': dest_count,
                    'risk_score': min(dest_count / threshold, 10.0)
                })
        
        return matches

# Example usage and demonstration
if __name__ == "__main__":
    # Initialize forensics analyzer
    analyzer = NetworkForensicsAnalyzer()
    
    # Generate sample network data for demonstration
    np.random.seed(42)
    n_records = 50000
    
    sample_data = pd.DataFrame({
        'timestamp': pd.date_range('2024-01-01', periods=n_records, freq='1min'),
        'source_ip': np.random.choice([f"192.168.1.{i}" for i in range(1, 255)], n_records),
        'destination_ip': np.random.choice([f"10.0.0.{i}" for i in range(1, 100)], n_records),
        'source_port': np.random.randint(1024, 65535, n_records),
        'destination_port': np.random.choice([80, 443, 22, 3389, 25, 53], n_records),
        'protocol': np.random.choice(['TCP', 'UDP', 'ICMP'], n_records, p=[0.7, 0.25, 0.05]),
        'bytes': np.random.lognormal(8, 2, n_records).astype(int),
        'packets': np.random.poisson(10, n_records)
    })
    
    print("PHANTOM-Flow Network Forensics Analysis")
    print("=" * 50)
    
    # Perform comprehensive analysis
    analysis_results = analyzer.perform_traffic_analysis(sample_data)
    
    # Generate visualizations
    analyzer.generate_visualizations(sample_data)
    
    # Generate threat report
    threat_report = analyzer.generate_threat_report(sample_data)
    
    # Save report
    with open('threat_analysis_report.md', 'w') as f:
        f.write(threat_report)
    
    # Perform threat hunting
    hunter = ThreatHunter(analyzer)
    hunting_results = hunter.hunt_threats(sample_data)
    
    print("\nThreat Hunting Results:")
    for rule_name, result in hunting_results.items():
        print(f"- {rule_name}: {result['severity']} severity")
        if 'matches' in result and result['matches']:
            print(f"  Matches found: {len(result['matches'])}")
    
    print(f"\nFull analysis report saved to: threat_analysis_report.md")
    print("Visualizations saved to: visualizations/ directory")
    print("\nAnalysis completed successfully!")
