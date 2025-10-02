# PHANTOM-Flow Advanced Penetration Testing and Vulnerability Assessment
# Comprehensive Security Testing Framework

import asyncio
import aiohttp
import socket
import ssl
import subprocess
import re
import json
import hashlib
import base64
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set
import concurrent.futures
from urllib.parse import urljoin, urlparse
import nmap
import requests
from bs4 import BeautifulSoup
import paramiko
from cryptography import x509
from cryptography.hazmat.backends import default_backend
import dns.resolver
import whois
from scapy.all import *
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VulnerabilityScanner:
    """
    Advanced Vulnerability Scanner for Web Applications and Network Services
    
    Provides comprehensive security testing including:
    - Network port scanning and service enumeration
    - Web application vulnerability assessment
    - SSL/TLS security analysis
    - DNS security testing
    - Authentication bypass attempts
    - SQL injection detection
    - Cross-site scripting (XSS) detection
    """
    
    def __init__(self, target: str, scan_type: str = "comprehensive"):
        self.target = target
        self.scan_type = scan_type
        self.results = {}
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'PHANTOM-Flow Security Scanner v2.0'
        })
        
        # Vulnerability payloads
        self.sql_payloads = [
            "' OR '1'='1",
            "' OR '1'='1' --",
            "' OR '1'='1' #",
            "' UNION SELECT null,null,null --",
            "'; DROP TABLE users; --",
            "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --"
        ]
        
        self.xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "'\"><script>alert('XSS')</script>"
        ]
        
        self.command_injection_payloads = [
            "; ls -la",
            "| whoami",
            "&& id",
            "; cat /etc/passwd",
            "| netstat -an"
        ]
    
    async def perform_comprehensive_scan(self) -> Dict:
        """
        Perform comprehensive security assessment
        
        Returns:
            Dictionary containing all scan results
        """
        logger.info(f"Starting comprehensive security scan of {self.target}")
        
        scan_results = {
            'target': self.target,
            'scan_timestamp': datetime.now().isoformat(),
            'scan_type': self.scan_type
        }
        
        # Network-level scans
        scan_results['port_scan'] = await self.port_scan()
        scan_results['service_enumeration'] = await self.enumerate_services()
        scan_results['ssl_analysis'] = await self.analyze_ssl_configuration()
        scan_results['dns_analysis'] = await self.analyze_dns_security()
        
        # Web application scans (if HTTP/HTTPS detected)
        if self._is_web_target():
            scan_results['web_vulnerabilities'] = await self.scan_web_vulnerabilities()
            scan_results['directory_enumeration'] = await self.enumerate_directories()
            scan_results['authentication_testing'] = await self.test_authentication()
            scan_results['session_management'] = await self.test_session_management()
        
        # Advanced exploitation attempts
        scan_results['exploitation_attempts'] = await self.attempt_exploits()
        
        # Generate risk assessment
        scan_results['risk_assessment'] = self.calculate_risk_score(scan_results)
        
        self.results = scan_results
        return scan_results
    
    async def port_scan(self) -> Dict:
        """Perform comprehensive port scan using multiple techniques"""
        logger.info("Performing port scan...")
        
        try:
            nm = nmap.PortScanner()
            
            # TCP SYN scan for common ports
            tcp_results = nm.scan(self.target, '1-1000', '-sS -sV -O')
            
            # UDP scan for common services
            udp_results = nm.scan(self.target, '53,67,68,69,123,161,162,514', '-sU')
            
            scan_results = {
                'tcp_ports': {},
                'udp_ports': {},
                'os_detection': {},
                'service_versions': {}
            }
            
            # Parse TCP results
            if self.target in tcp_results['scan']:
                host_info = tcp_results['scan'][self.target]
                
                if 'tcp' in host_info:
                    for port, info in host_info['tcp'].items():
                        scan_results['tcp_ports'][port] = {
                            'state': info['state'],
                            'service': info.get('name', 'unknown'),
                            'version': info.get('version', ''),
                            'product': info.get('product', '')
                        }
                
                # OS detection
                if 'osmatch' in host_info:
                    for os_match in host_info['osmatch']:
                        scan_results['os_detection'][os_match['name']] = os_match['accuracy']
            
            # Parse UDP results
            if self.target in udp_results['scan']:
                udp_info = udp_results['scan'][self.target]
                if 'udp' in udp_info:
                    for port, info in udp_info['udp'].items():
                        scan_results['udp_ports'][port] = {
                            'state': info['state'],
                            'service': info.get('name', 'unknown')
                        }
            
            return scan_results
            
        except Exception as e:
            logger.error(f"Port scan failed: {e}")
            return {'error': str(e)}
    
    async def enumerate_services(self) -> Dict:
        """Enumerate services and gather detailed information"""
        logger.info("Enumerating services...")
        
        service_info = {}
        
        # Common service enumeration
        services_to_check = {
            21: self._enumerate_ftp,
            22: self._enumerate_ssh,
            23: self._enumerate_telnet,
            25: self._enumerate_smtp,
            53: self._enumerate_dns,
            80: self._enumerate_http,
            110: self._enumerate_pop3,
            143: self._enumerate_imap,
            443: self._enumerate_https,
            993: self._enumerate_imaps,
            995: self._enumerate_pop3s
        }
        
        # Check each service
        for port, enum_func in services_to_check.items():
            try:
                if await self._is_port_open(port):
                    service_info[port] = await enum_func()
            except Exception as e:
                service_info[port] = {'error': str(e)}
        
        return service_info
    
    async def _is_port_open(self, port: int, timeout: int = 5) -> bool:
        """Check if a port is open"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((self.target, port))
            sock.close()
            return result == 0
        except:
            return False
    
    async def _enumerate_ftp(self) -> Dict:
        """Enumerate FTP service"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.target, 21))
            banner = sock.recv(1024).decode('utf-8', errors='ignore')
            sock.close()
            
            return {
                'banner': banner.strip(),
                'anonymous_login': await self._test_ftp_anonymous(),
                'version_detected': self._extract_version_from_banner(banner)
            }
        except Exception as e:
            return {'error': str(e)}
    
    async def _test_ftp_anonymous(self) -> bool:
        """Test FTP anonymous login"""
        try:
            import ftplib
            ftp = ftplib.FTP()
            ftp.connect(self.target, 21, timeout=10)
            ftp.login('anonymous', 'anonymous@example.com')
            ftp.quit()
            return True
        except:
            return False
    
    async def _enumerate_ssh(self) -> Dict:
        """Enumerate SSH service"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.target, 22))
            sock.send(b'SSH-2.0-PHANTOM-Scanner\r\n')
            banner = sock.recv(1024).decode('utf-8', errors='ignore')
            sock.close()
            
            return {
                'banner': banner.strip(),
                'version': self._extract_ssh_version(banner),
                'weak_ciphers': await self._check_ssh_weak_ciphers()
            }
        except Exception as e:
            return {'error': str(e)}
    
    async def _check_ssh_weak_ciphers(self) -> List[str]:
        """Check for weak SSH ciphers"""
        weak_ciphers = []
        try:
            # This would require more sophisticated SSH cipher analysis
            # Placeholder implementation
            weak_cipher_patterns = ['des', 'rc4', 'md5']
            # Implementation would analyze SSH handshake
            pass
        except:
            pass
        return weak_ciphers
    
    async def _enumerate_http(self) -> Dict:
        """Enumerate HTTP service"""
        try:
            response = await self._make_request(f"http://{self.target}")
            
            return {
                'server_header': response.headers.get('Server', 'Not disclosed'),
                'powered_by': response.headers.get('X-Powered-By', 'Not disclosed'),
                'status_code': response.status_code,
                'title': self._extract_title(response.text),
                'technologies': await self._detect_technologies(response),
                'security_headers': await self._analyze_security_headers(response.headers)
            }
        except Exception as e:
            return {'error': str(e)}
    
    async def _enumerate_https(self) -> Dict:
        """Enumerate HTTPS service"""
        http_info = await self._enumerate_http()
        
        # Add SSL-specific information
        try:
            ssl_info = await self.analyze_ssl_configuration()
            http_info['ssl_analysis'] = ssl_info
        except Exception as e:
            http_info['ssl_error'] = str(e)
        
        return http_info
    
    async def analyze_ssl_configuration(self) -> Dict:
        """Analyze SSL/TLS configuration"""
        logger.info("Analyzing SSL/TLS configuration...")
        
        ssl_analysis = {}
        
        try:
            # Get certificate information
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            with socket.create_connection((self.target, 443), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=self.target) as ssock:
                    cert_der = ssock.getpeercert(binary_form=True)
                    cert = x509.load_der_x509_certificate(cert_der, default_backend())
                    
                    ssl_analysis['certificate'] = {
                        'subject': str(cert.subject),
                        'issuer': str(cert.issuer),
                        'serial_number': str(cert.serial_number),
                        'not_valid_before': cert.not_valid_before.isoformat(),
                        'not_valid_after': cert.not_valid_after.isoformat(),
                        'signature_algorithm': cert.signature_algorithm_oid._name
                    }
                    
                    # Check for weak signature algorithms
                    weak_algorithms = ['md5', 'sha1']
                    if any(weak in cert.signature_algorithm_oid._name.lower() for weak in weak_algorithms):
                        ssl_analysis['weak_signature_algorithm'] = True
                    
                    # Check certificate validity
                    now = datetime.now()
                    if cert.not_valid_after < now:
                        ssl_analysis['certificate_expired'] = True
                    elif (cert.not_valid_after - now).days < 30:
                        ssl_analysis['certificate_expiring_soon'] = True
            
            # Test SSL/TLS protocol support
            ssl_analysis['protocol_support'] = await self._test_ssl_protocols()
            
            # Test cipher suites
            ssl_analysis['cipher_suites'] = await self._test_cipher_suites()
            
        except Exception as e:
            ssl_analysis['error'] = str(e)
        
        return ssl_analysis
    
    async def _test_ssl_protocols(self) -> Dict:
        """Test SSL/TLS protocol support"""
        protocols = {
            'SSLv2': ssl.PROTOCOL_SSLv23,
            'SSLv3': ssl.PROTOCOL_SSLv23,
            'TLSv1.0': ssl.PROTOCOL_TLSv1,
            'TLSv1.1': ssl.PROTOCOL_TLSv1_1,
            'TLSv1.2': ssl.PROTOCOL_TLSv1_2
        }
        
        protocol_support = {}
        
        for protocol_name, protocol_const in protocols.items():
            try:
                context = ssl.SSLContext(protocol_const)
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                
                with socket.create_connection((self.target, 443), timeout=5) as sock:
                    with context.wrap_socket(sock) as ssock:
                        protocol_support[protocol_name] = True
            except:
                protocol_support[protocol_name] = False
        
        return protocol_support
    
    async def _test_cipher_suites(self) -> List[str]:
        """Test supported cipher suites"""
        # This would require more sophisticated cipher suite testing
        # Placeholder implementation
        return ['TLS_RSA_WITH_AES_128_CBC_SHA', 'TLS_RSA_WITH_AES_256_CBC_SHA']
    
    async def scan_web_vulnerabilities(self) -> Dict:
        """Comprehensive web application vulnerability scan"""
        logger.info("Scanning web vulnerabilities...")
        
        vulnerabilities = {
            'sql_injection': await self._test_sql_injection(),
            'xss': await self._test_xss(),
            'command_injection': await self._test_command_injection(),
            'directory_traversal': await self._test_directory_traversal(),
            'file_inclusion': await self._test_file_inclusion(),
            'xxe': await self._test_xxe(),
            'csrf': await self._test_csrf(),
            'information_disclosure': await self._test_information_disclosure()
        }
        
        return vulnerabilities
    
    async def _test_sql_injection(self) -> Dict:
        """Test for SQL injection vulnerabilities"""
        logger.info("Testing for SQL injection...")
        
        results = {
            'vulnerable_parameters': [],
            'vulnerability_found': False,
            'evidence': []
        }
        
        # Get forms and parameters from the target
        forms = await self._discover_forms()
        
        for form in forms:
            for field in form.get('fields', []):
                for payload in self.sql_payloads:
                    try:
                        # Test GET parameters
                        test_url = f"{form['action']}?{field}={payload}"
                        response = await self._make_request(test_url)
                        
                        # Check for SQL error messages
                        sql_errors = [
                            'sql syntax',
                            'mysql_fetch',
                            'ora-01756',
                            'microsoft jet database',
                            'sqlite_master'
                        ]
                        
                        for error in sql_errors:
                            if error.lower() in response.text.lower():
                                results['vulnerable_parameters'].append({
                                    'parameter': field,
                                    'payload': payload,
                                    'evidence': error,
                                    'url': test_url
                                })
                                results['vulnerability_found'] = True
                                break
                        
                        # Test POST parameters
                        if form.get('method', '').upper() == 'POST':
                            data = {field: payload}
                            response = await self._make_request(form['action'], method='POST', data=data)
                            
                            for error in sql_errors:
                                if error.lower() in response.text.lower():
                                    results['vulnerable_parameters'].append({
                                        'parameter': field,
                                        'payload': payload,
                                        'evidence': error,
                                        'method': 'POST'
                                    })
                                    results['vulnerability_found'] = True
                                    break
                    
                    except Exception as e:
                        continue
        
        return results
    
    async def _test_xss(self) -> Dict:
        """Test for Cross-Site Scripting vulnerabilities"""
        logger.info("Testing for XSS...")
        
        results = {
            'vulnerable_parameters': [],
            'vulnerability_found': False,
            'xss_type': []
        }
        
        forms = await self._discover_forms()
        
        for form in forms:
            for field in form.get('fields', []):
                for payload in self.xss_payloads:
                    try:
                        # Test reflected XSS
                        test_url = f"{form['action']}?{field}={payload}"
                        response = await self._make_request(test_url)
                        
                        if payload in response.text:
                            results['vulnerable_parameters'].append({
                                'parameter': field,
                                'payload': payload,
                                'type': 'reflected',
                                'url': test_url
                            })
                            results['vulnerability_found'] = True
                            results['xss_type'].append('reflected')
                        
                        # Test stored XSS (POST)
                        if form.get('method', '').upper() == 'POST':
                            data = {field: payload}
                            response = await self._make_request(form['action'], method='POST', data=data)
                            
                            # Check if payload is stored and reflected
                            if payload in response.text:
                                results['vulnerable_parameters'].append({
                                    'parameter': field,
                                    'payload': payload,
                                    'type': 'stored',
                                    'method': 'POST'
                                })
                                results['vulnerability_found'] = True
                                results['xss_type'].append('stored')
                    
                    except Exception as e:
                        continue
        
        return results
    
    async def _test_command_injection(self) -> Dict:
        """Test for command injection vulnerabilities"""
        logger.info("Testing for command injection...")
        
        results = {
            'vulnerable_parameters': [],
            'vulnerability_found': False,
            'evidence': []
        }
        
        forms = await self._discover_forms()
        
        for form in forms:
            for field in form.get('fields', []):
                for payload in self.command_injection_payloads:
                    try:
                        test_url = f"{form['action']}?{field}={payload}"
                        response = await self._make_request(test_url)
                        
                        # Check for command execution evidence
                        command_evidence = [
                            'uid=',
                            'gid=',
                            'groups=',
                            'root:x:0:0',
                            'bin:x:1:1',
                            'Active Connections'
                        ]
                        
                        for evidence in command_evidence:
                            if evidence in response.text:
                                results['vulnerable_parameters'].append({
                                    'parameter': field,
                                    'payload': payload,
                                    'evidence': evidence,
                                    'url': test_url
                                })
                                results['vulnerability_found'] = True
                                break
                    
                    except Exception as e:
                        continue
        
        return results
    
    async def _discover_forms(self) -> List[Dict]:
        """Discover forms on the target website"""
        try:
            response = await self._make_request(f"http://{self.target}")
            soup = BeautifulSoup(response.text, 'html.parser')
            
            forms = []
            for form in soup.find_all('form'):
                form_data = {
                    'action': form.get('action', ''),
                    'method': form.get('method', 'GET'),
                    'fields': []
                }
                
                # Get input fields
                for input_field in form.find_all('input'):
                    if input_field.get('type') not in ['submit', 'button', 'hidden']:
                        form_data['fields'].append(input_field.get('name', ''))
                
                # Get textarea fields
                for textarea in form.find_all('textarea'):
                    form_data['fields'].append(textarea.get('name', ''))
                
                # Get select fields
                for select in form.find_all('select'):
                    form_data['fields'].append(select.get('name', ''))
                
                forms.append(form_data)
            
            return forms
        
        except Exception as e:
            logger.error(f"Form discovery failed: {e}")
            return []
    
    async def _make_request(self, url: str, method: str = 'GET', data: Dict = None, timeout: int = 10) -> requests.Response:
        """Make HTTP request with error handling"""
        try:
            if method.upper() == 'POST':
                return self.session.post(url, data=data, timeout=timeout, verify=False)
            else:
                return self.session.get(url, timeout=timeout, verify=False)
        except Exception as e:
            logger.error(f"Request failed for {url}: {e}")
            raise
    
    def _is_web_target(self) -> bool:
        """Check if target is a web application"""
        try:
            # Try to make HTTP request
            response = requests.get(f"http://{self.target}", timeout=5)
            return True
        except:
            try:
                # Try HTTPS
                response = requests.get(f"https://{self.target}", timeout=5, verify=False)
                return True
            except:
                return False
    
    def calculate_risk_score(self, scan_results: Dict) -> Dict:
        """Calculate overall risk score based on findings"""
        risk_factors = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }
        
        # Analyze findings and assign risk levels
        if 'web_vulnerabilities' in scan_results:
            web_vulns = scan_results['web_vulnerabilities']
            
            if web_vulns.get('sql_injection', {}).get('vulnerability_found'):
                risk_factors['critical'] += 1
            
            if web_vulns.get('xss', {}).get('vulnerability_found'):
                risk_factors['high'] += 1
            
            if web_vulns.get('command_injection', {}).get('vulnerability_found'):
                risk_factors['critical'] += 1
        
        if 'ssl_analysis' in scan_results:
            ssl_info = scan_results['ssl_analysis']
            
            if ssl_info.get('certificate_expired'):
                risk_factors['high'] += 1
            
            if ssl_info.get('weak_signature_algorithm'):
                risk_factors['medium'] += 1
        
        # Calculate overall score
        total_score = (
            risk_factors['critical'] * 10 +
            risk_factors['high'] * 7 +
            risk_factors['medium'] * 4 +
            risk_factors['low'] * 1
        )
        
        if total_score >= 20:
            overall_risk = 'CRITICAL'
        elif total_score >= 10:
            overall_risk = 'HIGH'
        elif total_score >= 5:
            overall_risk = 'MEDIUM'
        else:
            overall_risk = 'LOW'
        
        return {
            'risk_factors': risk_factors,
            'total_score': total_score,
            'overall_risk': overall_risk,
            'recommendations': self._generate_recommendations(scan_results)
        }
    
    def _generate_recommendations(self, scan_results: Dict) -> List[str]:
        """Generate security recommendations based on findings"""
        recommendations = []
        
        if 'web_vulnerabilities' in scan_results:
            web_vulns = scan_results['web_vulnerabilities']
            
            if web_vulns.get('sql_injection', {}).get('vulnerability_found'):
                recommendations.append("Implement parameterized queries to prevent SQL injection")
                recommendations.append("Apply input validation and sanitization")
            
            if web_vulns.get('xss', {}).get('vulnerability_found'):
                recommendations.append("Implement output encoding to prevent XSS")
                recommendations.append("Use Content Security Policy (CSP) headers")
        
        if 'ssl_analysis' in scan_results:
            ssl_info = scan_results['ssl_analysis']
            
            if ssl_info.get('certificate_expired'):
                recommendations.append("Renew SSL certificate immediately")
            
            if ssl_info.get('weak_signature_algorithm'):
                recommendations.append("Upgrade to stronger SSL certificate signature algorithm")
        
        # General recommendations
        recommendations.extend([
            "Implement regular security updates and patches",
            "Use Web Application Firewall (WAF)",
            "Implement proper logging and monitoring",
            "Conduct regular penetration testing",
            "Implement security headers (HSTS, CSP, X-Frame-Options)"
        ])
        
        return recommendations

class ExploitFramework:
    """Advanced exploit framework for penetration testing"""
    
    def __init__(self, target: str):
        self.target = target
        self.exploits = {}
        
    async def attempt_exploits(self) -> Dict:
        """Attempt various exploits based on discovered vulnerabilities"""
        exploit_results = {}
        
        # Web application exploits
        exploit_results['web_exploits'] = await self._attempt_web_exploits()
        
        # Network service exploits
        exploit_results['network_exploits'] = await self._attempt_network_exploits()
        
        # Privilege escalation attempts
        exploit_results['privilege_escalation'] = await self._attempt_privilege_escalation()
        
        return exploit_results
    
    async def _attempt_web_exploits(self) -> Dict:
        """Attempt web application exploits"""
        # This would contain actual exploit code
        # For demonstration purposes, we'll simulate attempts
        return {
            'sql_injection_exploit': 'Simulated attempt',
            'xss_exploit': 'Simulated attempt',
            'file_upload_exploit': 'Simulated attempt'
        }

# Example usage and demonstration
if __name__ == "__main__":
    async def main():
        # Initialize vulnerability scanner
        target = "example.com"  # Replace with actual target
        scanner = VulnerabilityScanner(target)
        
        print("PHANTOM-Flow Advanced Penetration Testing Framework")
        print("=" * 60)
        print(f"Target: {target}")
        print("Starting comprehensive security assessment...")
        
        # Perform comprehensive scan
        results = await scanner.perform_comprehensive_scan()
        
        # Display results summary
        print("\nScan Results Summary:")
        print("-" * 30)
        
        if 'risk_assessment' in results:
            risk = results['risk_assessment']
            print(f"Overall Risk Level: {risk['overall_risk']}")
            print(f"Risk Score: {risk['total_score']}")
            
            print("\nRisk Factors:")
            for level, count in risk['risk_factors'].items():
                if count > 0:
                    print(f"  {level.title()}: {count}")
        
        # Save detailed results
        with open(f'pentest_report_{target}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\nDetailed report saved to pentest_report_{target}_*.json")
        print("Penetration testing completed!")
    
    # Run the main function
    asyncio.run(main())
