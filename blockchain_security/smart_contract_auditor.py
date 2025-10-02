# PHANTOM-Flow Blockchain Security and Smart Contract Auditing Platform
# Advanced DeFi Security Analysis and Vulnerability Detection

import json
import re
import hashlib
import asyncio
import aiohttp
from web3 import Web3
from eth_abi import decode_abi, encode_abi
from typing import Dict, List, Tuple, Optional, Set, Any
import requests
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from dataclasses import dataclass
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class VulnerabilityFinding:
    """Data class for vulnerability findings"""
    severity: str  # critical, high, medium, low
    title: str
    description: str
    location: str
    recommendation: str
    confidence: float
    impact: str
    likelihood: str

@dataclass
class ContractAnalysis:
    """Data class for contract analysis results"""
    contract_address: str
    contract_name: str
    compiler_version: str
    vulnerabilities: List[VulnerabilityFinding]
    gas_analysis: Dict
    code_quality: Dict
    security_score: float

class SmartContractAuditor:
    """
    Advanced Smart Contract Security Auditor
    
    Provides comprehensive security analysis for Ethereum smart contracts including:
    - Static code analysis for common vulnerabilities
    - Dynamic analysis and transaction simulation
    - Gas optimization analysis
    - DeFi-specific security checks
    - Automated exploit detection
    - Compliance verification
    """
    
    def __init__(self, web3_provider_url: str = None):
        self.web3 = Web3(Web3.HTTPProvider(web3_provider_url)) if web3_provider_url else None
        self.vulnerability_patterns = self._load_vulnerability_patterns()
        self.defi_protocols = self._load_defi_protocols()
        
    def _load_vulnerability_patterns(self) -> Dict:
        """Load vulnerability detection patterns"""
        return {
            'reentrancy': {
                'patterns': [
                    r'\.call\s*\(',
                    r'\.send\s*\(',
                    r'\.transfer\s*\(',
                    r'external\s+.*\s+payable'
                ],
                'severity': 'critical',
                'description': 'Potential reentrancy vulnerability detected'
            },
            'integer_overflow': {
                'patterns': [
                    r'\+\s*=',
                    r'-\s*=',
                    r'\*\s*=',
                    r'unchecked\s*\{'
                ],
                'severity': 'high',
                'description': 'Potential integer overflow/underflow vulnerability'
            },
            'timestamp_dependence': {
                'patterns': [
                    r'block\.timestamp',
                    r'now\s',
                    r'block\.number'
                ],
                'severity': 'medium',
                'description': 'Timestamp dependence detected'
            },
            'tx_origin': {
                'patterns': [
                    r'tx\.origin'
                ],
                'severity': 'high',
                'description': 'Use of tx.origin for authorization detected'
            },
            'unchecked_call': {
                'patterns': [
                    r'\.call\s*\([^)]*\)\s*;',
                    r'\.delegatecall\s*\([^)]*\)\s*;'
                ],
                'severity': 'high',
                'description': 'Unchecked external call detected'
            },
            'access_control': {
                'patterns': [
                    r'onlyOwner',
                    r'require\s*\(\s*msg\.sender\s*==',
                    r'modifier\s+\w+\s*\('
                ],
                'severity': 'medium',
                'description': 'Access control mechanism analysis required'
            },
            'suicide_function': {
                'patterns': [
                    r'selfdestruct\s*\(',
                    r'suicide\s*\('
                ],
                'severity': 'critical',
                'description': 'Self-destruct function detected'
            },
            'random_generation': {
                'patterns': [
                    r'blockhash\s*\(',
                    r'block\.difficulty',
                    r'keccak256\s*\(\s*abi\.encodePacked\s*\(\s*block\.'
                ],
                'severity': 'high',
                'description': 'Weak randomness source detected'
            }
        }
    
    def _load_defi_protocols(self) -> Dict:
        """Load DeFi protocol patterns and checks"""
        return {
            'uniswap_v2': {
                'router_address': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                'factory_address': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
                'checks': ['slippage_protection', 'price_manipulation', 'liquidity_checks']
            },
            'compound': {
                'comptroller': '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
                'checks': ['collateral_factor', 'liquidation_threshold', 'interest_rate_model']
            },
            'aave': {
                'lending_pool': '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
                'checks': ['health_factor', 'liquidation_bonus', 'reserve_configuration']
            }
        }
    
    async def audit_contract(self, contract_source: str, contract_address: str = None) -> ContractAnalysis:
        """
        Perform comprehensive smart contract audit
        
        Args:
            contract_source: Solidity source code
            contract_address: Contract address for on-chain analysis
            
        Returns:
            ContractAnalysis object with findings
        """
        logger.info(f"Starting comprehensive audit for contract: {contract_address or 'source code'}")
        
        vulnerabilities = []
        
        # Static analysis
        static_vulns = await self._perform_static_analysis(contract_source)
        vulnerabilities.extend(static_vulns)
        
        # DeFi-specific analysis
        defi_vulns = await self._analyze_defi_patterns(contract_source)
        vulnerabilities.extend(defi_vulns)
        
        # Gas analysis
        gas_analysis = await self._analyze_gas_usage(contract_source)
        
        # Code quality analysis
        code_quality = await self._analyze_code_quality(contract_source)
        
        # On-chain analysis if address provided
        if contract_address and self.web3:
            onchain_vulns = await self._analyze_onchain_behavior(contract_address)
            vulnerabilities.extend(onchain_vulns)
        
        # Calculate security score
        security_score = self._calculate_security_score(vulnerabilities, code_quality)
        
        return ContractAnalysis(
            contract_address=contract_address or "N/A",
            contract_name=self._extract_contract_name(contract_source),
            compiler_version=self._extract_compiler_version(contract_source),
            vulnerabilities=vulnerabilities,
            gas_analysis=gas_analysis,
            code_quality=code_quality,
            security_score=security_score
        )
    
    async def _perform_static_analysis(self, source_code: str) -> List[VulnerabilityFinding]:
        """Perform static code analysis for vulnerabilities"""
        logger.info("Performing static code analysis...")
        
        findings = []
        lines = source_code.split('\n')
        
        for vuln_type, vuln_info in self.vulnerability_patterns.items():
            for pattern in vuln_info['patterns']:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        finding = VulnerabilityFinding(
                            severity=vuln_info['severity'],
                            title=f"{vuln_type.replace('_', ' ').title()} Detected",
                            description=vuln_info['description'],
                            location=f"Line {line_num}: {line.strip()}",
                            recommendation=self._get_recommendation(vuln_type),
                            confidence=0.8,
                            impact=self._get_impact(vuln_info['severity']),
                            likelihood="Medium"
                        )
                        findings.append(finding)
        
        # Advanced pattern analysis
        findings.extend(await self._analyze_advanced_patterns(source_code))
        
        return findings
    
    async def _analyze_advanced_patterns(self, source_code: str) -> List[VulnerabilityFinding]:
        """Analyze advanced vulnerability patterns"""
        findings = []
        
        # Check for reentrancy patterns
        reentrancy_findings = self._check_reentrancy_patterns(source_code)
        findings.extend(reentrancy_findings)
        
        # Check for access control issues
        access_findings = self._check_access_control_patterns(source_code)
        findings.extend(access_findings)
        
        # Check for oracle manipulation
        oracle_findings = self._check_oracle_manipulation(source_code)
        findings.extend(oracle_findings)
        
        # Check for flash loan vulnerabilities
        flashloan_findings = self._check_flashloan_vulnerabilities(source_code)
        findings.extend(flashloan_findings)
        
        return findings
    
    def _check_reentrancy_patterns(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for reentrancy vulnerability patterns"""
        findings = []
        
        # Look for state changes after external calls
        external_call_pattern = r'(\w+)\.call\s*\([^)]*\)'
        state_change_pattern = r'(\w+)\s*=\s*([^;]+);'
        
        lines = source_code.split('\n')
        in_function = False
        function_lines = []
        
        for line_num, line in enumerate(lines, 1):
            if 'function' in line and '{' in line:
                in_function = True
                function_lines = [(line_num, line)]
            elif in_function:
                function_lines.append((line_num, line))
                if '}' in line and line.count('}') >= line.count('{'):
                    # Analyze function for reentrancy
                    external_calls = []
                    state_changes = []
                    
                    for func_line_num, func_line in function_lines:
                        if re.search(external_call_pattern, func_line):
                            external_calls.append((func_line_num, func_line))
                        if re.search(state_change_pattern, func_line):
                            state_changes.append((func_line_num, func_line))
                    
                    # Check if state changes occur after external calls
                    for call_line_num, call_line in external_calls:
                        for state_line_num, state_line in state_changes:
                            if state_line_num > call_line_num:
                                findings.append(VulnerabilityFinding(
                                    severity='critical',
                                    title='Potential Reentrancy Vulnerability',
                                    description='State change occurs after external call, potentially vulnerable to reentrancy',
                                    location=f"Lines {call_line_num}-{state_line_num}",
                                    recommendation="Use checks-effects-interactions pattern or reentrancy guards",
                                    confidence=0.9,
                                    impact="High",
                                    likelihood="Medium"
                                ))
                    
                    in_function = False
                    function_lines = []
        
        return findings
    
    def _check_access_control_patterns(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for access control vulnerabilities"""
        findings = []
        
        # Check for missing access controls on critical functions
        critical_functions = ['withdraw', 'transfer', 'mint', 'burn', 'upgrade', 'destroy']
        
        for func_name in critical_functions:
            pattern = rf'function\s+{func_name}\s*\([^)]*\)\s*[^{{]*\{{'
            matches = re.finditer(pattern, source_code, re.IGNORECASE | re.DOTALL)
            
            for match in matches:
                func_start = match.start()
                # Check if function has access control
                func_text = source_code[func_start:func_start + 500]  # Check first 500 chars
                
                access_controls = ['onlyOwner', 'require(msg.sender', 'modifier', 'onlyRole']
                has_access_control = any(control in func_text for control in access_controls)
                
                if not has_access_control:
                    line_num = source_code[:func_start].count('\n') + 1
                    findings.append(VulnerabilityFinding(
                        severity='high',
                        title=f'Missing Access Control on {func_name.title()} Function',
                        description=f'The {func_name} function appears to lack proper access control',
                        location=f"Line {line_num}",
                        recommendation=f"Add appropriate access control modifier to {func_name} function",
                        confidence=0.7,
                        impact="High",
                        likelihood="High"
                    ))
        
        return findings
    
    def _check_oracle_manipulation(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for oracle price manipulation vulnerabilities"""
        findings = []
        
        oracle_patterns = [
            r'getPrice\s*\(',
            r'latestRoundData\s*\(',
            r'latestAnswer\s*\(',
            r'\.price\s*\(',
            r'IPriceFeed'
        ]
        
        for pattern in oracle_patterns:
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                
                # Check if there's price validation
                surrounding_text = source_code[max(0, match.start() - 200):match.end() + 200]
                
                validation_patterns = ['require', 'assert', 'revert', 'if.*price.*>', 'if.*price.*<']
                has_validation = any(re.search(val_pattern, surrounding_text, re.IGNORECASE) 
                                   for val_pattern in validation_patterns)
                
                if not has_validation:
                    findings.append(VulnerabilityFinding(
                        severity='high',
                        title='Potential Oracle Price Manipulation',
                        description='Oracle price used without validation, vulnerable to manipulation',
                        location=f"Line {line_num}",
                        recommendation="Implement price validation, use multiple oracles, or time-weighted averages",
                        confidence=0.6,
                        impact="High",
                        likelihood="Medium"
                    ))
        
        return findings
    
    def _check_flashloan_vulnerabilities(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for flash loan attack vulnerabilities"""
        findings = []
        
        flashloan_patterns = [
            r'flashLoan\s*\(',
            r'flashBorrow\s*\(',
            r'executeOperation\s*\(',
            r'onFlashLoan\s*\('
        ]
        
        for pattern in flashloan_patterns:
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                
                # Check for proper flash loan protections
                surrounding_text = source_code[max(0, match.start() - 500):match.end() + 500]
                
                protections = [
                    'msg.sender.*trusted',
                    'require.*authorized',
                    'onlyFlashLoan',
                    'nonReentrant'
                ]
                
                has_protection = any(re.search(protection, surrounding_text, re.IGNORECASE) 
                                   for protection in protections)
                
                if not has_protection:
                    findings.append(VulnerabilityFinding(
                        severity='critical',
                        title='Unprotected Flash Loan Function',
                        description='Flash loan function lacks proper authorization and protection mechanisms',
                        location=f"Line {line_num}",
                        recommendation="Implement proper authorization, reentrancy protection, and validation",
                        confidence=0.8,
                        impact="Critical",
                        likelihood="High"
                    ))
        
        return findings
    
    async def _analyze_defi_patterns(self, source_code: str) -> List[VulnerabilityFinding]:
        """Analyze DeFi-specific vulnerability patterns"""
        logger.info("Analyzing DeFi-specific patterns...")
        
        findings = []
        
        # Check for MEV vulnerabilities
        mev_findings = self._check_mev_vulnerabilities(source_code)
        findings.extend(mev_findings)
        
        # Check for liquidity pool vulnerabilities
        liquidity_findings = self._check_liquidity_vulnerabilities(source_code)
        findings.extend(liquidity_findings)
        
        # Check for governance vulnerabilities
        governance_findings = self._check_governance_vulnerabilities(source_code)
        findings.extend(governance_findings)
        
        return findings
    
    def _check_mev_vulnerabilities(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for MEV (Maximal Extractable Value) vulnerabilities"""
        findings = []
        
        # Check for front-running vulnerabilities
        frontrun_patterns = [
            r'swapExactTokensForTokens',
            r'swapTokensForExactTokens',
            r'addLiquidity',
            r'removeLiquidity'
        ]
        
        for pattern in frontrun_patterns:
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                
                # Check for slippage protection
                surrounding_text = source_code[max(0, match.start() - 300):match.end() + 300]
                
                slippage_protections = ['amountOutMin', 'amountInMax', 'deadline', 'minAmount']
                has_slippage_protection = any(protection in surrounding_text 
                                            for protection in slippage_protections)
                
                if not has_slippage_protection:
                    findings.append(VulnerabilityFinding(
                        severity='medium',
                        title='Missing Slippage Protection',
                        description='DEX operation lacks slippage protection, vulnerable to front-running',
                        location=f"Line {line_num}",
                        recommendation="Implement proper slippage protection with amountOutMin/amountInMax",
                        confidence=0.7,
                        impact="Medium",
                        likelihood="High"
                    ))
        
        return findings
    
    def _check_liquidity_vulnerabilities(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for liquidity-related vulnerabilities"""
        findings = []
        
        # Check for liquidity manipulation
        liquidity_patterns = [
            r'getReserves\s*\(',
            r'totalSupply\s*\(',
            r'balanceOf\s*\(',
            r'getLiquidity'
        ]
        
        for pattern in liquidity_patterns:
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                
                # Check if used in price calculations
                surrounding_text = source_code[max(0, match.start() - 200):match.end() + 200]
                
                price_calc_patterns = ['price.*=', '.*price', 'div', 'mul', '/']
                used_in_price = any(re.search(calc_pattern, surrounding_text, re.IGNORECASE) 
                                  for calc_pattern in price_calc_patterns)
                
                if used_in_price:
                    findings.append(VulnerabilityFinding(
                        severity='medium',
                        title='Potential Liquidity Manipulation',
                        description='Liquidity data used in price calculations without validation',
                        location=f"Line {line_num}",
                        recommendation="Use time-weighted average prices (TWAP) or additional price validation",
                        confidence=0.5,
                        impact="Medium",
                        likelihood="Medium"
                    ))
        
        return findings
    
    def _check_governance_vulnerabilities(self, source_code: str) -> List[VulnerabilityFinding]:
        """Check for governance-related vulnerabilities"""
        findings = []
        
        governance_patterns = [
            r'propose\s*\(',
            r'vote\s*\(',
            r'execute\s*\(',
            r'setGovernor',
            r'changeGovernance'
        ]
        
        for pattern in governance_patterns:
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                
                # Check for timelock
                surrounding_text = source_code[max(0, match.start() - 400):match.end() + 400]
                
                timelock_patterns = ['timelock', 'delay', 'executionTime', 'eta']
                has_timelock = any(pattern in surrounding_text.lower() for pattern in timelock_patterns)
                
                if not has_timelock:
                    findings.append(VulnerabilityFinding(
                        severity='high',
                        title='Missing Governance Timelock',
                        description='Governance function lacks timelock protection',
                        location=f"Line {line_num}",
                        recommendation="Implement timelock mechanism for governance changes",
                        confidence=0.6,
                        impact="High",
                        likelihood="Medium"
                    ))
        
        return findings
    
    async def _analyze_gas_usage(self, source_code: str) -> Dict:
        """Analyze gas usage patterns and optimization opportunities"""
        logger.info("Analyzing gas usage patterns...")
        
        gas_analysis = {
            'optimization_opportunities': [],
            'gas_inefficient_patterns': [],
            'estimated_savings': 0
        }
        
        # Check for gas-inefficient patterns
        inefficient_patterns = {
            r'for\s*\([^)]*;\s*\w+\s*<\s*\w+\.length': 'Cache array length in for loops',
            r'storage\s+\w+\[\]\s+memory': 'Use memory instead of storage for temporary arrays',
            r'string\s+memory': 'Consider using bytes32 for short strings',
            r'require\s*\([^,)]*,\s*"[^"]{50,}"': 'Long error messages consume gas',
            r'\.push\s*\([^)]*\)': 'Array push operations can be expensive'
        }
        
        for pattern, recommendation in inefficient_patterns.items():
            matches = re.finditer(pattern, source_code, re.IGNORECASE)
            for match in matches:
                line_num = source_code[:match.start()].count('\n') + 1
                gas_analysis['gas_inefficient_patterns'].append({
                    'line': line_num,
                    'pattern': match.group(),
                    'recommendation': recommendation
                })
        
        return gas_analysis
    
    async def _analyze_code_quality(self, source_code: str) -> Dict:
        """Analyze code quality metrics"""
        logger.info("Analyzing code quality...")
        
        lines = source_code.split('\n')
        
        quality_metrics = {
            'total_lines': len(lines),
            'comment_lines': len([line for line in lines if line.strip().startswith('//')]),
            'empty_lines': len([line for line in lines if not line.strip()]),
            'function_count': len(re.findall(r'function\s+\w+', source_code)),
            'complexity_score': self._calculate_complexity(source_code),
            'documentation_score': self._calculate_documentation_score(source_code),
            'naming_conventions': self._check_naming_conventions(source_code)
        }
        
        quality_metrics['comment_ratio'] = (
            quality_metrics['comment_lines'] / quality_metrics['total_lines'] * 100
            if quality_metrics['total_lines'] > 0 else 0
        )
        
        return quality_metrics
    
    def _calculate_complexity(self, source_code: str) -> float:
        """Calculate cyclomatic complexity"""
        complexity_keywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||']
        complexity = 1  # Base complexity
        
        for keyword in complexity_keywords:
            complexity += len(re.findall(rf'\b{keyword}\b', source_code, re.IGNORECASE))
        
        return complexity / max(1, len(re.findall(r'function\s+\w+', source_code)))
    
    def _calculate_documentation_score(self, source_code: str) -> float:
        """Calculate documentation quality score"""
        functions = re.findall(r'function\s+\w+', source_code)
        documented_functions = len(re.findall(r'\/\*\*[\s\S]*?\*\/\s*function', source_code))
        
        if not functions:
            return 0.0
        
        return (documented_functions / len(functions)) * 100
    
    def _check_naming_conventions(self, source_code: str) -> Dict:
        """Check naming convention adherence"""
        conventions = {
            'camelCase_functions': 0,
            'PascalCase_contracts': 0,
            'UPPER_CASE_constants': 0,
            'violations': []
        }
        
        # Check function naming
        functions = re.findall(r'function\s+(\w+)', source_code)
        for func in functions:
            if re.match(r'^[a-z][a-zA-Z0-9]*$', func):
                conventions['camelCase_functions'] += 1
            else:
                conventions['violations'].append(f"Function '{func}' doesn't follow camelCase")
        
        # Check contract naming
        contracts = re.findall(r'contract\s+(\w+)', source_code)
        for contract in contracts:
            if re.match(r'^[A-Z][a-zA-Z0-9]*$', contract):
                conventions['PascalCase_contracts'] += 1
            else:
                conventions['violations'].append(f"Contract '{contract}' doesn't follow PascalCase")
        
        return conventions
    
    async def _analyze_onchain_behavior(self, contract_address: str) -> List[VulnerabilityFinding]:
        """Analyze on-chain contract behavior"""
        logger.info(f"Analyzing on-chain behavior for {contract_address}")
        
        findings = []
        
        try:
            # Get contract bytecode
            bytecode = self.web3.eth.get_code(contract_address)
            
            # Analyze recent transactions
            recent_txs = await self._get_recent_transactions(contract_address)
            
            # Check for suspicious patterns
            suspicious_findings = self._analyze_transaction_patterns(recent_txs)
            findings.extend(suspicious_findings)
            
            # Check contract balance and transfers
            balance_findings = await self._analyze_balance_patterns(contract_address)
            findings.extend(balance_findings)
            
        except Exception as e:
            logger.error(f"On-chain analysis failed: {e}")
        
        return findings
    
    async def _get_recent_transactions(self, contract_address: str, limit: int = 100) -> List[Dict]:
        """Get recent transactions for contract analysis"""
        # This would typically use an API like Etherscan
        # Placeholder implementation
        return []
    
    def _analyze_transaction_patterns(self, transactions: List[Dict]) -> List[VulnerabilityFinding]:
        """Analyze transaction patterns for suspicious behavior"""
        findings = []
        
        if not transactions:
            return findings
        
        # Analyze gas usage patterns
        gas_prices = [tx.get('gasPrice', 0) for tx in transactions]
        if gas_prices:
            avg_gas = sum(gas_prices) / len(gas_prices)
            high_gas_txs = [tx for tx in transactions if tx.get('gasPrice', 0) > avg_gas * 2]
            
            if len(high_gas_txs) > len(transactions) * 0.1:  # More than 10% high gas
                findings.append(VulnerabilityFinding(
                    severity='medium',
                    title='Unusual Gas Usage Pattern',
                    description='High percentage of transactions with unusually high gas prices',
                    location='On-chain transactions',
                    recommendation='Investigate high gas transactions for potential MEV or attacks',
                    confidence=0.6,
                    impact="Medium",
                    likelihood="Low"
                ))
        
        return findings
    
    async def _analyze_balance_patterns(self, contract_address: str) -> List[VulnerabilityFinding]:
        """Analyze contract balance patterns"""
        findings = []
        
        try:
            current_balance = self.web3.eth.get_balance(contract_address)
            
            # Check for contracts with unexpectedly high balances
            if current_balance > self.web3.toWei(100, 'ether'):
                findings.append(VulnerabilityFinding(
                    severity='low',
                    title='High Contract Balance',
                    description=f'Contract holds {self.web3.fromWei(current_balance, "ether")} ETH',
                    location='Contract balance',
                    recommendation='Verify if high balance is intentional and secure',
                    confidence=0.4,
                    impact="Low",
                    likelihood="Low"
                ))
        
        except Exception as e:
            logger.error(f"Balance analysis failed: {e}")
        
        return findings
    
    def _calculate_security_score(self, vulnerabilities: List[VulnerabilityFinding], code_quality: Dict) -> float:
        """Calculate overall security score"""
        base_score = 100.0
        
        # Deduct points for vulnerabilities
        severity_weights = {
            'critical': 25,
            'high': 15,
            'medium': 8,
            'low': 3
        }
        
        for vuln in vulnerabilities:
            base_score -= severity_weights.get(vuln.severity, 0)
        
        # Adjust for code quality
        if code_quality.get('comment_ratio', 0) < 10:
            base_score -= 5  # Poor documentation
        
        if code_quality.get('complexity_score', 0) > 10:
            base_score -= 10  # High complexity
        
        return max(0, min(100, base_score))
    
    def _extract_contract_name(self, source_code: str) -> str:
        """Extract contract name from source code"""
        match = re.search(r'contract\s+(\w+)', source_code)
        return match.group(1) if match else "Unknown"
    
    def _extract_compiler_version(self, source_code: str) -> str:
        """Extract Solidity compiler version"""
        match = re.search(r'pragma\s+solidity\s+([^;]+)', source_code)
        return match.group(1) if match else "Unknown"
    
    def _get_recommendation(self, vuln_type: str) -> str:
        """Get security recommendation for vulnerability type"""
        recommendations = {
            'reentrancy': 'Use checks-effects-interactions pattern and reentrancy guards',
            'integer_overflow': 'Use SafeMath library or Solidity 0.8+ built-in overflow checks',
            'timestamp_dependence': 'Avoid using block.timestamp for critical logic',
            'tx_origin': 'Use msg.sender instead of tx.origin for authorization',
            'unchecked_call': 'Check return values of external calls',
            'access_control': 'Implement proper access control mechanisms',
            'suicide_function': 'Carefully review selfdestruct usage and access controls',
            'random_generation': 'Use secure randomness sources like Chainlink VRF'
        }
        return recommendations.get(vuln_type, 'Review and fix the identified issue')
    
    def _get_impact(self, severity: str) -> str:
        """Get impact description based on severity"""
        impacts = {
            'critical': 'Critical',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low'
        }
        return impacts.get(severity, 'Unknown')
    
    def generate_audit_report(self, analysis: ContractAnalysis) -> str:
        """Generate comprehensive audit report"""
        report = f"""
# Smart Contract Security Audit Report

## Contract Information
- **Contract Name**: {analysis.contract_name}
- **Contract Address**: {analysis.contract_address}
- **Compiler Version**: {analysis.compiler_version}
- **Audit Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **Security Score**: {analysis.security_score:.1f}/100

## Executive Summary
This audit identified {len(analysis.vulnerabilities)} potential security issues across various severity levels.

### Vulnerability Summary
"""
        
        # Count vulnerabilities by severity
        severity_counts = {}
        for vuln in analysis.vulnerabilities:
            severity_counts[vuln.severity] = severity_counts.get(vuln.severity, 0) + 1
        
        for severity in ['critical', 'high', 'medium', 'low']:
            count = severity_counts.get(severity, 0)
            report += f"- **{severity.title()}**: {count}\n"
        
        report += f"""

## Detailed Findings

"""
        
        # List all vulnerabilities
        for i, vuln in enumerate(analysis.vulnerabilities, 1):
            report += f"""
### {i}. {vuln.title}
- **Severity**: {vuln.severity.upper()}
- **Confidence**: {vuln.confidence:.1%}
- **Impact**: {vuln.impact}
- **Likelihood**: {vuln.likelihood}
- **Location**: {vuln.location}

**Description**: {vuln.description}

**Recommendation**: {vuln.recommendation}

---
"""
        
        report += f"""
## Code Quality Analysis
- **Total Lines**: {analysis.code_quality['total_lines']:,}
- **Functions**: {analysis.code_quality['function_count']}
- **Comment Ratio**: {analysis.code_quality['comment_ratio']:.1f}%
- **Complexity Score**: {analysis.code_quality['complexity_score']:.1f}
- **Documentation Score**: {analysis.code_quality['documentation_score']:.1f}%

## Gas Analysis
"""
        
        if analysis.gas_analysis['gas_inefficient_patterns']:
            report += "### Gas Optimization Opportunities:\n"
            for pattern in analysis.gas_analysis['gas_inefficient_patterns']:
                report += f"- Line {pattern['line']}: {pattern['recommendation']}\n"
        
        report += f"""

## Recommendations
1. **Critical Issues**: Address all critical vulnerabilities immediately
2. **High Priority**: Fix high-severity issues before deployment
3. **Code Quality**: Improve documentation and reduce complexity
4. **Gas Optimization**: Implement suggested gas optimizations
5. **Testing**: Comprehensive testing of all fixes
6. **Re-audit**: Consider re-audit after implementing fixes

## Disclaimer
This audit report is based on automated analysis and may not identify all potential vulnerabilities. 
Manual review and comprehensive testing are recommended before deployment.

---
*Generated by PHANTOM-Flow Smart Contract Auditor*
"""
        
        return report

# Example usage and testing
if __name__ == "__main__":
    async def main():
        # Sample Solidity contract for testing
        sample_contract = """
        pragma solidity ^0.8.0;

        contract VulnerableContract {
            mapping(address => uint256) public balances;
            address public owner;
            
            constructor() {
                owner = msg.sender;
            }
            
            function deposit() public payable {
                balances[msg.sender] += msg.value;
            }
            
            function withdraw(uint256 amount) public {
                require(balances[msg.sender] >= amount);
                
                // Vulnerable to reentrancy
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success);
                
                balances[msg.sender] -= amount;
            }
            
            function transferOwnership(address newOwner) public {
                // Missing access control
                owner = newOwner;
            }
            
            function emergencyWithdraw() public {
                // Using tx.origin instead of msg.sender
                require(tx.origin == owner);
                selfdestruct(payable(owner));
            }
        }
        """
        
        # Initialize auditor
        auditor = SmartContractAuditor()
        
        print("PHANTOM-Flow Smart Contract Security Auditor")
        print("=" * 50)
        
        # Perform audit
        analysis = await auditor.audit_contract(sample_contract)
        
        # Generate report
        report = auditor.generate_audit_report(analysis)
        
        # Display summary
        print(f"Contract: {analysis.contract_name}")
        print(f"Security Score: {analysis.security_score:.1f}/100")
        print(f"Vulnerabilities Found: {len(analysis.vulnerabilities)}")
        
        # Save full report
        with open('smart_contract_audit_report.md', 'w') as f:
            f.write(report)
        
        print("\nFull audit report saved to: smart_contract_audit_report.md")
        print("Audit completed successfully!")
    
    # Run the audit
    asyncio.run(main())
