# PHANTOM-Flow Advanced AI Threat Intelligence System
# Deep Learning and Natural Language Processing for Cybersecurity

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import torch
import torch.nn as nn
import torch.optim as optim
from transformers import AutoTokenizer, AutoModel, pipeline
import spacy
import networkx as nx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN, KMeans
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta
import asyncio
import aiohttp
import json
import re
from typing import Dict, List, Tuple, Optional, Union
import logging
from dataclasses import dataclass
import pickle
import joblib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ThreatIntelligenceData:
    """Structure for threat intelligence data"""
    ioc: str
    ioc_type: str
    threat_type: str
    severity: int
    confidence: float
    first_seen: datetime
    last_seen: datetime
    source: str
    description: str
    context: Dict
    relationships: List[str]
    attribution: Optional[str] = None
    ttps: List[str] = None
    mitre_techniques: List[str] = None

class AdvancedThreatIntelligenceSystem:
    """
    Advanced AI-powered threat intelligence system using deep learning,
    natural language processing, and graph neural networks for comprehensive
    cybersecurity threat analysis and prediction.
    """
    
    def __init__(self, config: Dict = None):
        self.config = config or self._get_default_config()
        self.models = {}
        self.tokenizers = {}
        self.threat_graph = nx.DiGraph()
        self.nlp_pipeline = None
        self.threat_embeddings = {}
        self.anomaly_detectors = {}
        self.prediction_models = {}
        
        # Initialize components
        self._initialize_nlp_models()
        self._initialize_ml_models()
        self._initialize_graph_models()
        self._load_threat_intelligence_feeds()
        
    def _get_default_config(self) -> Dict:
        """Get default configuration for the system"""
        return {
            'model_cache_dir': './models',
            'threat_feeds': [
                'misp', 'otx', 'virustotal', 'threatcrowd', 'hybrid_analysis'
            ],
            'embedding_dim': 768,
            'max_sequence_length': 512,
            'batch_size': 32,
            'learning_rate': 1e-4,
            'epochs': 100,
            'early_stopping_patience': 10,
            'threat_score_threshold': 0.7,
            'confidence_threshold': 0.8
        }
    
    def _initialize_nlp_models(self):
        """Initialize NLP models for text analysis"""
        logger.info("Initializing NLP models...")
        
        # Load pre-trained BERT model for cybersecurity text analysis
        self.tokenizers['bert'] = AutoTokenizer.from_pretrained(
            'bert-base-uncased'
        )
        self.models['bert'] = AutoModel.from_pretrained(
            'bert-base-uncased'
        )
        
        # Load spaCy model for named entity recognition
        try:
            self.nlp_pipeline = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found, using basic tokenization")
            self.nlp_pipeline = None
        
        # Initialize sentiment analysis pipeline
        self.models['sentiment'] = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest"
        )
        
        # Initialize TF-IDF vectorizer for text features
        self.models['tfidf'] = TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 3),
            stop_words='english'
        )
        
    def _initialize_ml_models(self):
        """Initialize machine learning models"""
        logger.info("Initializing ML models...")
        
        # Threat classification model
        self.models['threat_classifier'] = self._build_threat_classifier()
        
        # Anomaly detection model
        self.models['anomaly_detector'] = self._build_anomaly_detector()
        
        # Time series prediction model
        self.models['time_series'] = self._build_time_series_model()
        
        # Attribution model
        self.models['attribution'] = self._build_attribution_model()
        
        # Risk scoring model
        self.models['risk_scorer'] = self._build_risk_scoring_model()
        
    def _initialize_graph_models(self):
        """Initialize graph neural network models"""
        logger.info("Initializing graph models...")
        
        # Graph neural network for threat relationship analysis
        self.models['gnn'] = self._build_graph_neural_network()
        
        # Community detection algorithm
        self.models['community_detector'] = self._build_community_detector()
        
    def _build_threat_classifier(self):
        """Build deep learning model for threat classification"""
        model = keras.Sequential([
            layers.Input(shape=(self.config['max_sequence_length'],)),
            layers.Embedding(50000, self.config['embedding_dim']),
            layers.LSTM(128, return_sequences=True, dropout=0.3),
            layers.LSTM(64, dropout=0.3),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.5),
            layers.Dense(64, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(10, activation='softmax')  # 10 threat categories
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.config['learning_rate']),
            loss='categorical_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        return model
    
    def _build_anomaly_detector(self):
        """Build autoencoder for anomaly detection"""
        input_dim = self.config['embedding_dim']
        
        # Encoder
        encoder = keras.Sequential([
            layers.Input(shape=(input_dim,)),
            layers.Dense(512, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(128, activation='relu'),
            layers.Dense(64, activation='relu')  # Latent space
        ])
        
        # Decoder
        decoder = keras.Sequential([
            layers.Input(shape=(64,)),
            layers.Dense(128, activation='relu'),
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(512, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(input_dim, activation='sigmoid')
        ])
        
        # Autoencoder
        autoencoder = keras.Sequential([encoder, decoder])
        autoencoder.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        return {
            'encoder': encoder,
            'decoder': decoder,
            'autoencoder': autoencoder
        }
    
    def _build_time_series_model(self):
        """Build LSTM model for time series threat prediction"""
        model = keras.Sequential([
            layers.Input(shape=(30, 10)),  # 30 time steps, 10 features
            layers.LSTM(128, return_sequences=True, dropout=0.3),
            layers.LSTM(64, return_sequences=True, dropout=0.3),
            layers.LSTM(32, dropout=0.3),
            layers.Dense(64, activation='relu'),
            layers.Dropout(0.4),
            layers.Dense(32, activation='relu'),
            layers.Dense(1, activation='sigmoid')  # Threat probability
        ])
        
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'auc']
        )
        
        return model
    
    def _build_attribution_model(self):
        """Build model for threat actor attribution"""
        # Multi-input model for attribution analysis
        text_input = layers.Input(shape=(self.config['max_sequence_length'],), name='text_input')
        text_embedding = layers.Embedding(50000, 128)(text_input)
        text_lstm = layers.LSTM(64, dropout=0.3)(text_embedding)
        
        # Technical features input
        tech_input = layers.Input(shape=(100,), name='tech_input')  # Technical indicators
        tech_dense = layers.Dense(64, activation='relu')(tech_input)
        tech_dropout = layers.Dropout(0.3)(tech_dense)
        
        # Temporal features input
        temporal_input = layers.Input(shape=(24,), name='temporal_input')  # Time patterns
        temporal_dense = layers.Dense(32, activation='relu')(temporal_input)
        
        # Combine all inputs
        combined = layers.concatenate([text_lstm, tech_dropout, temporal_dense])
        combined_dense = layers.Dense(128, activation='relu')(combined)
        combined_dropout = layers.Dropout(0.4)(combined_dense)
        
        # Attribution prediction
        attribution_output = layers.Dense(50, activation='softmax', name='attribution')(combined_dropout)
        
        # Confidence prediction
        confidence_output = layers.Dense(1, activation='sigmoid', name='confidence')(combined_dropout)
        
        model = keras.Model(
            inputs=[text_input, tech_input, temporal_input],
            outputs=[attribution_output, confidence_output]
        )
        
        model.compile(
            optimizer='adam',
            loss={
                'attribution': 'categorical_crossentropy',
                'confidence': 'binary_crossentropy'
            },
            loss_weights={'attribution': 1.0, 'confidence': 0.5},
            metrics={
                'attribution': ['accuracy'],
                'confidence': ['mae']
            }
        )
        
        return model
    
    def _build_risk_scoring_model(self):
        """Build ensemble model for comprehensive risk scoring"""
        # Gradient Boosting model for risk scoring
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.neural_network import MLPRegressor
        from sklearn.ensemble import VotingRegressor
        
        # Individual models
        gb_model = GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        )
        
        mlp_model = MLPRegressor(
            hidden_layer_sizes=(256, 128, 64),
            activation='relu',
            solver='adam',
            alpha=0.001,
            max_iter=500,
            random_state=42
        )
        
        # Ensemble model
        ensemble_model = VotingRegressor([
            ('gb', gb_model),
            ('mlp', mlp_model)
        ])
        
        return ensemble_model
    
    def _build_graph_neural_network(self):
        """Build Graph Neural Network for threat relationship analysis"""
        # Using PyTorch for GNN implementation
        class ThreatGNN(nn.Module):
            def __init__(self, input_dim, hidden_dim, output_dim):
                super(ThreatGNN, self).__init__()
                self.conv1 = nn.Linear(input_dim, hidden_dim)
                self.conv2 = nn.Linear(hidden_dim, hidden_dim)
                self.conv3 = nn.Linear(hidden_dim, output_dim)
                self.dropout = nn.Dropout(0.3)
                self.activation = nn.ReLU()
                
            def forward(self, x, edge_index):
                x = self.activation(self.conv1(x))
                x = self.dropout(x)
                x = self.activation(self.conv2(x))
                x = self.dropout(x)
                x = self.conv3(x)
                return x
        
        return ThreatGNN(
            input_dim=self.config['embedding_dim'],
            hidden_dim=256,
            output_dim=128
        )
    
    def _build_community_detector(self):
        """Build community detection algorithm for threat clustering"""
        return {
            'louvain': lambda graph: nx.community.louvain_communities(graph),
            'leiden': lambda graph: nx.community.leiden_communities(graph),
            'modularity': lambda graph: nx.community.modularity_max.greedy_modularity_communities(graph)
        }
    
    def _load_threat_intelligence_feeds(self):
        """Load and process threat intelligence from various feeds"""
        logger.info("Loading threat intelligence feeds...")
        
        # This would connect to actual threat intelligence feeds
        # For demonstration, we'll simulate loading data
        self.threat_intelligence_db = {
            'iocs': [],
            'campaigns': [],
            'actors': [],
            'techniques': [],
            'vulnerabilities': []
        }
        
        # Load MITRE ATT&CK framework
        self._load_mitre_attack()
        
        # Load CVE database
        self._load_cve_database()
        
        # Load threat actor profiles
        self._load_threat_actors()
    
    def _load_mitre_attack(self):
        """Load MITRE ATT&CK framework data"""
        # This would load actual MITRE ATT&CK data
        self.mitre_attack = {
            'tactics': [],
            'techniques': [],
            'procedures': [],
            'groups': [],
            'software': []
        }
    
    def _load_cve_database(self):
        """Load CVE vulnerability database"""
        # This would load actual CVE data
        self.cve_database = {}
    
    def _load_threat_actors(self):
        """Load threat actor profiles and attribution data"""
        # This would load actual threat actor data
        self.threat_actors = {}
    
    async def analyze_threat_intelligence(self, data: Dict) -> Dict:
        """
        Comprehensive threat intelligence analysis using AI/ML models
        
        Args:
            data: Raw threat intelligence data
            
        Returns:
            Comprehensive analysis results
        """
        logger.info(f"Analyzing threat intelligence data: {data.get('type', 'unknown')}")
        
        results = {
            'analysis_id': f"ti_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'timestamp': datetime.now().isoformat(),
            'input_data': data,
            'analysis_results': {}
        }
        
        try:
            # Text analysis
            if 'text' in data:
                text_analysis = await self._analyze_text_content(data['text'])
                results['analysis_results']['text_analysis'] = text_analysis
            
            # IOC analysis
            if 'iocs' in data:
                ioc_analysis = await self._analyze_iocs(data['iocs'])
                results['analysis_results']['ioc_analysis'] = ioc_analysis
            
            # Network analysis
            if 'network_data' in data:
                network_analysis = await self._analyze_network_patterns(data['network_data'])
                results['analysis_results']['network_analysis'] = network_analysis
            
            # Temporal analysis
            if 'timestamps' in data:
                temporal_analysis = await self._analyze_temporal_patterns(data['timestamps'])
                results['analysis_results']['temporal_analysis'] = temporal_analysis
            
            # Attribution analysis
            attribution_results = await self._perform_attribution_analysis(data)
            results['analysis_results']['attribution'] = attribution_results
            
            # Risk assessment
            risk_assessment = await self._assess_threat_risk(results['analysis_results'])
            results['analysis_results']['risk_assessment'] = risk_assessment
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(results['analysis_results'])
            results['recommendations'] = recommendations
            
            # Update threat graph
            await self._update_threat_graph(data, results)
            
        except Exception as e:
            logger.error(f"Error in threat intelligence analysis: {str(e)}")
            results['error'] = str(e)
        
        return results
    
    async def _analyze_text_content(self, text: str) -> Dict:
        """Analyze text content using NLP models"""
        analysis = {
            'entities': [],
            'sentiment': {},
            'topics': [],
            'embeddings': [],
            'threat_indicators': []
        }
        
        # Named Entity Recognition
        if self.nlp_pipeline:
            doc = self.nlp_pipeline(text)
            analysis['entities'] = [
                {
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char
                }
                for ent in doc.ents
            ]
        
        # Sentiment analysis
        sentiment_result = self.models['sentiment'](text[:512])  # Truncate for model
        analysis['sentiment'] = sentiment_result[0] if sentiment_result else {}
        
        # Extract threat indicators using regex patterns
        threat_patterns = {
            'ip_addresses': r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
            'domains': r'\b[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})\b',
            'email_addresses': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'file_hashes': r'\b[a-fA-F0-9]{32,64}\b',
            'urls': r'https?://[^\s<>"{}|\\^`[\]]+',
            'cve_ids': r'CVE-\d{4}-\d{4,7}',
            'mitre_techniques': r'T\d{4}(?:\.\d{3})?'
        }
        
        for indicator_type, pattern in threat_patterns.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                analysis['threat_indicators'].extend([
                    {'type': indicator_type, 'value': match}
                    for match in matches
                ])
        
        # Generate text embeddings using BERT
        inputs = self.tokenizers['bert'](
            text,
            return_tensors='tf',
            truncation=True,
            padding=True,
            max_length=self.config['max_sequence_length']
        )
        
        with tf.device('/CPU:0'):  # Use CPU for inference
            outputs = self.models['bert'](**inputs)
            embeddings = outputs.last_hidden_state.numpy()
            analysis['embeddings'] = embeddings.mean(axis=1).tolist()
        
        return analysis
    
    async def _analyze_iocs(self, iocs: List[str]) -> Dict:
        """Analyze Indicators of Compromise"""
        analysis = {
            'total_iocs': len(iocs),
            'ioc_types': {},
            'reputation_scores': {},
            'relationships': [],
            'threat_families': [],
            'campaigns': []
        }
        
        for ioc in iocs:
            # Classify IOC type
            ioc_type = self._classify_ioc_type(ioc)
            analysis['ioc_types'][ioc] = ioc_type
            
            # Calculate reputation score
            reputation_score = await self._calculate_ioc_reputation(ioc)
            analysis['reputation_scores'][ioc] = reputation_score
            
            # Find relationships with other IOCs
            relationships = await self._find_ioc_relationships(ioc)
            analysis['relationships'].extend(relationships)
        
        return analysis
    
    def _classify_ioc_type(self, ioc: str) -> str:
        """Classify the type of IOC"""
        patterns = {
            'ip_address': r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$',
            'domain': r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})$',
            'url': r'^https?://',
            'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            'md5_hash': r'^[a-fA-F0-9]{32}$',
            'sha1_hash': r'^[a-fA-F0-9]{40}$',
            'sha256_hash': r'^[a-fA-F0-9]{64}$',
            'file_path': r'^[a-zA-Z]:\\|^/',
            'registry_key': r'^HKEY_'
        }
        
        for ioc_type, pattern in patterns.items():
            if re.match(pattern, ioc, re.IGNORECASE):
                return ioc_type
        
        return 'unknown'
    
    async def _calculate_ioc_reputation(self, ioc: str) -> float:
        """Calculate reputation score for IOC"""
        # This would integrate with actual threat intelligence sources
        # For demonstration, we'll simulate reputation scoring
        
        base_score = 0.5  # Neutral score
        
        # Check against known malicious IOCs
        if ioc in self.threat_intelligence_db.get('malicious_iocs', []):
            base_score = 0.9
        
        # Check against whitelist
        if ioc in self.threat_intelligence_db.get('whitelist', []):
            base_score = 0.1
        
        # Add some randomness for demonstration
        import random
        reputation_score = max(0.0, min(1.0, base_score + random.uniform(-0.2, 0.2)))
        
        return reputation_score
    
    async def _find_ioc_relationships(self, ioc: str) -> List[Dict]:
        """Find relationships between IOCs"""
        relationships = []
        
        # This would query graph database for relationships
        # For demonstration, we'll simulate finding relationships
        
        if self.threat_graph.has_node(ioc):
            for neighbor in self.threat_graph.neighbors(ioc):
                edge_data = self.threat_graph.get_edge_data(ioc, neighbor)
                relationships.append({
                    'source': ioc,
                    'target': neighbor,
                    'relationship_type': edge_data.get('type', 'related'),
                    'confidence': edge_data.get('confidence', 0.5),
                    'first_seen': edge_data.get('first_seen', datetime.now().isoformat())
                })
        
        return relationships
    
    async def _analyze_network_patterns(self, network_data: Dict) -> Dict:
        """Analyze network traffic patterns for threats"""
        analysis = {
            'traffic_analysis': {},
            'anomalies': [],
            'attack_patterns': [],
            'c2_indicators': []
        }
        
        # Analyze traffic patterns
        if 'flows' in network_data:
            analysis['traffic_analysis'] = self._analyze_traffic_flows(network_data['flows'])
        
        # Detect anomalies using autoencoder
        if 'feature_vectors' in network_data:
            anomalies = self._detect_network_anomalies(network_data['feature_vectors'])
            analysis['anomalies'] = anomalies
        
        return analysis
    
    def _analyze_traffic_flows(self, flows: List[Dict]) -> Dict:
        """Analyze network traffic flows"""
        flow_analysis = {
            'total_flows': len(flows),
            'protocols': {},
            'top_sources': {},
            'top_destinations': {},
            'suspicious_patterns': []
        }
        
        for flow in flows:
            # Count protocols
            protocol = flow.get('protocol', 'unknown')
            flow_analysis['protocols'][protocol] = flow_analysis['protocols'].get(protocol, 0) + 1
            
            # Count sources and destinations
            src = flow.get('src_ip', 'unknown')
            dst = flow.get('dst_ip', 'unknown')
            
            flow_analysis['top_sources'][src] = flow_analysis['top_sources'].get(src, 0) + 1
            flow_analysis['top_destinations'][dst] = flow_analysis['top_destinations'].get(dst, 0) + 1
        
        return flow_analysis
    
    def _detect_network_anomalies(self, feature_vectors: List[List[float]]) -> List[Dict]:
        """Detect network anomalies using ML models"""
        anomalies = []
        
        if not feature_vectors:
            return anomalies
        
        # Convert to numpy array
        X = np.array(feature_vectors)
        
        # Use autoencoder for anomaly detection
        if 'autoencoder' in self.models['anomaly_detector']:
            reconstructed = self.models['anomaly_detector']['autoencoder'].predict(X)
            reconstruction_errors = np.mean(np.square(X - reconstructed), axis=1)
            
            # Define threshold (e.g., 95th percentile)
            threshold = np.percentile(reconstruction_errors, 95)
            
            for i, error in enumerate(reconstruction_errors):
                if error > threshold:
                    anomalies.append({
                        'index': i,
                        'reconstruction_error': float(error),
                        'anomaly_score': float(error / threshold),
                        'feature_vector': feature_vectors[i]
                    })
        
        return anomalies
    
    async def _analyze_temporal_patterns(self, timestamps: List[str]) -> Dict:
        """Analyze temporal patterns in threat data"""
        analysis = {
            'time_distribution': {},
            'patterns': [],
            'seasonality': {},
            'predictions': []
        }
        
        # Convert timestamps to datetime objects
        dt_timestamps = [datetime.fromisoformat(ts.replace('Z', '+00:00')) for ts in timestamps]
        
        # Analyze hourly distribution
        hourly_counts = {}
        for dt in dt_timestamps:
            hour = dt.hour
            hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
        
        analysis['time_distribution']['hourly'] = hourly_counts
        
        # Analyze daily patterns
        daily_counts = {}
        for dt in dt_timestamps:
            day = dt.strftime('%Y-%m-%d')
            daily_counts[day] = daily_counts.get(day, 0) + 1
        
        analysis['time_distribution']['daily'] = daily_counts
        
        return analysis
    
    async def _perform_attribution_analysis(self, data: Dict) -> Dict:
        """Perform threat actor attribution analysis"""
        attribution = {
            'likely_actors': [],
            'confidence_scores': {},
            'attribution_factors': [],
            'historical_matches': []
        }
        
        # Extract features for attribution
        features = self._extract_attribution_features(data)
        
        # Use attribution model if available
        if 'attribution' in self.models and features:
            # This would use the actual attribution model
            # For demonstration, we'll simulate attribution
            
            potential_actors = [
                'APT28', 'APT29', 'Lazarus Group', 'FIN7', 'Carbanak',
                'APT1', 'APT40', 'Equation Group', 'DarkHalo', 'UNC2452'
            ]
            
            import random
            for actor in random.sample(potential_actors, 3):
                confidence = random.uniform(0.3, 0.9)
                attribution['likely_actors'].append({
                    'actor': actor,
                    'confidence': confidence,
                    'reasoning': f"Pattern similarity with known {actor} campaigns"
                })
        
        return attribution
    
    def _extract_attribution_features(self, data: Dict) -> Dict:
        """Extract features for threat actor attribution"""
        features = {
            'technical_features': [],
            'behavioral_features': [],
            'temporal_features': [],
            'linguistic_features': []
        }
        
        # Extract technical features (TTPs, tools, etc.)
        if 'ttps' in data:
            features['technical_features'] = data['ttps']
        
        # Extract behavioral features
        if 'behavior_patterns' in data:
            features['behavioral_features'] = data['behavior_patterns']
        
        # Extract temporal features
        if 'timestamps' in data:
            features['temporal_features'] = self._extract_temporal_features(data['timestamps'])
        
        # Extract linguistic features from text
        if 'text' in data:
            features['linguistic_features'] = self._extract_linguistic_features(data['text'])
        
        return features
    
    def _extract_temporal_features(self, timestamps: List[str]) -> List[float]:
        """Extract temporal features for attribution"""
        if not timestamps:
            return []
        
        dt_timestamps = [datetime.fromisoformat(ts.replace('Z', '+00:00')) for ts in timestamps]
        
        features = []
        
        # Time of day preferences
        hours = [dt.hour for dt in dt_timestamps]
        features.extend([
            np.mean(hours),  # Average hour
            np.std(hours),   # Hour standard deviation
            len(set(hours))  # Unique hours
        ])
        
        # Day of week preferences
        weekdays = [dt.weekday() for dt in dt_timestamps]
        features.extend([
            np.mean(weekdays),
            np.std(weekdays),
            len(set(weekdays))
        ])
        
        return features
    
    def _extract_linguistic_features(self, text: str) -> List[float]:
        """Extract linguistic features for attribution"""
        features = []
        
        # Basic text statistics
        features.extend([
            len(text),                    # Text length
            len(text.split()),           # Word count
            len(set(text.lower().split())),  # Unique words
            text.count('.'),             # Sentence count approximation
            text.count(','),             # Comma usage
            text.count('!'),             # Exclamation usage
            text.count('?'),             # Question usage
        ])
        
        # Character frequency analysis
        char_counts = {}
        for char in text.lower():
            if char.isalpha():
                char_counts[char] = char_counts.get(char, 0) + 1
        
        # Top 5 most common characters
        top_chars = sorted(char_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        features.extend([count for _, count in top_chars])
        
        return features
    
    async def _assess_threat_risk(self, analysis_results: Dict) -> Dict:
        """Assess overall threat risk based on analysis results"""
        risk_assessment = {
            'overall_risk_score': 0.0,
            'risk_level': 'low',
            'risk_factors': [],
            'mitigation_priority': 'low',
            'confidence': 0.0
        }
        
        risk_factors = []
        total_risk = 0.0
        factor_count = 0
        
        # IOC reputation risk
        if 'ioc_analysis' in analysis_results:
            ioc_scores = analysis_results['ioc_analysis'].get('reputation_scores', {})
            if ioc_scores:
                avg_ioc_risk = np.mean(list(ioc_scores.values()))
                risk_factors.append({
                    'factor': 'IOC Reputation',
                    'score': avg_ioc_risk,
                    'weight': 0.3
                })
                total_risk += avg_ioc_risk * 0.3
                factor_count += 1
        
        # Attribution risk
        if 'attribution' in analysis_results:
            attribution_data = analysis_results['attribution']
            if attribution_data.get('likely_actors'):
                max_confidence = max([
                    actor['confidence'] 
                    for actor in attribution_data['likely_actors']
                ])
                risk_factors.append({
                    'factor': 'Threat Actor Attribution',
                    'score': max_confidence,
                    'weight': 0.25
                })
                total_risk += max_confidence * 0.25
                factor_count += 1
        
        # Network anomaly risk
        if 'network_analysis' in analysis_results:
            anomalies = analysis_results['network_analysis'].get('anomalies', [])
            if anomalies:
                anomaly_risk = min(1.0, len(anomalies) / 10.0)  # Normalize
                risk_factors.append({
                    'factor': 'Network Anomalies',
                    'score': anomaly_risk,
                    'weight': 0.2
                })
                total_risk += anomaly_risk * 0.2
                factor_count += 1
        
        # Text analysis risk
        if 'text_analysis' in analysis_results:
            threat_indicators = analysis_results['text_analysis'].get('threat_indicators', [])
            if threat_indicators:
                indicator_risk = min(1.0, len(threat_indicators) / 20.0)  # Normalize
                risk_factors.append({
                    'factor': 'Threat Indicators in Text',
                    'score': indicator_risk,
                    'weight': 0.25
                })
                total_risk += indicator_risk * 0.25
                factor_count += 1
        
        # Calculate overall risk score
        if factor_count > 0:
            risk_assessment['overall_risk_score'] = total_risk
        
        # Determine risk level
        if risk_assessment['overall_risk_score'] >= 0.8:
            risk_assessment['risk_level'] = 'critical'
            risk_assessment['mitigation_priority'] = 'immediate'
        elif risk_assessment['overall_risk_score'] >= 0.6:
            risk_assessment['risk_level'] = 'high'
            risk_assessment['mitigation_priority'] = 'high'
        elif risk_assessment['overall_risk_score'] >= 0.4:
            risk_assessment['risk_level'] = 'medium'
            risk_assessment['mitigation_priority'] = 'medium'
        elif risk_assessment['overall_risk_score'] >= 0.2:
            risk_assessment['risk_level'] = 'low'
            risk_assessment['mitigation_priority'] = 'low'
        else:
            risk_assessment['risk_level'] = 'minimal'
            risk_assessment['mitigation_priority'] = 'low'
        
        risk_assessment['risk_factors'] = risk_factors
        risk_assessment['confidence'] = min(1.0, factor_count / 4.0)  # Based on available factors
        
        return risk_assessment
    
    async def _generate_recommendations(self, analysis_results: Dict) -> List[Dict]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        # IOC-based recommendations
        if 'ioc_analysis' in analysis_results:
            ioc_data = analysis_results['ioc_analysis']
            high_risk_iocs = [
                ioc for ioc, score in ioc_data.get('reputation_scores', {}).items()
                if score > 0.7
            ]
            
            if high_risk_iocs:
                recommendations.append({
                    'category': 'IOC Blocking',
                    'priority': 'high',
                    'action': f"Block {len(high_risk_iocs)} high-risk IOCs",
                    'details': {
                        'iocs': high_risk_iocs[:10],  # Limit for brevity
                        'implementation': 'Add to firewall/proxy blocklist'
                    }
                })
        
        # Attribution-based recommendations
        if 'attribution' in analysis_results:
            attribution_data = analysis_results['attribution']
            likely_actors = attribution_data.get('likely_actors', [])
            
            if likely_actors:
                top_actor = max(likely_actors, key=lambda x: x['confidence'])
                recommendations.append({
                    'category': 'Threat Hunting',
                    'priority': 'medium',
                    'action': f"Hunt for {top_actor['actor']} TTPs",
                    'details': {
                        'actor': top_actor['actor'],
                        'confidence': top_actor['confidence'],
                        'focus_areas': ['Known IOCs', 'Attack patterns', 'Infrastructure']
                    }
                })
        
        # Network-based recommendations
        if 'network_analysis' in analysis_results:
            network_data = analysis_results['network_analysis']
            anomalies = network_data.get('anomalies', [])
            
            if len(anomalies) > 5:
                recommendations.append({
                    'category': 'Network Monitoring',
                    'priority': 'medium',
                    'action': 'Investigate network anomalies',
                    'details': {
                        'anomaly_count': len(anomalies),
                        'investigation_focus': 'Unusual traffic patterns and connections'
                    }
                })
        
        # Risk-based recommendations
        if 'risk_assessment' in analysis_results:
            risk_data = analysis_results['risk_assessment']
            
            if risk_data['risk_level'] in ['high', 'critical']:
                recommendations.append({
                    'category': 'Incident Response',
                    'priority': 'critical',
                    'action': 'Activate incident response procedures',
                    'details': {
                        'risk_level': risk_data['risk_level'],
                        'risk_score': risk_data['overall_risk_score'],
                        'immediate_actions': [
                            'Isolate affected systems',
                            'Collect forensic evidence',
                            'Notify stakeholders'
                        ]
                    }
                })
        
        return recommendations
    
    async def _update_threat_graph(self, input_data: Dict, analysis_results: Dict):
        """Update the threat intelligence graph with new data"""
        try:
            # Add IOCs to graph
            if 'iocs' in input_data:
                for ioc in input_data['iocs']:
                    self.threat_graph.add_node(ioc, 
                        type='ioc',
                        first_seen=datetime.now().isoformat(),
                        reputation_score=analysis_results.get('ioc_analysis', {})
                                                    .get('reputation_scores', {})
                                                    .get(ioc, 0.5)
                    )
            
            # Add relationships
            if 'ioc_analysis' in analysis_results:
                relationships = analysis_results['ioc_analysis'].get('relationships', [])
                for rel in relationships:
                    self.threat_graph.add_edge(
                        rel['source'], 
                        rel['target'],
                        type=rel['relationship_type'],
                        confidence=rel['confidence'],
                        first_seen=rel['first_seen']
                    )
            
            # Add threat actors
            if 'attribution' in analysis_results:
                actors = analysis_results['attribution'].get('likely_actors', [])
                for actor_data in actors:
                    actor = actor_data['actor']
                    self.threat_graph.add_node(actor,
                        type='threat_actor',
                        confidence=actor_data['confidence']
                    )
                    
                    # Connect actors to IOCs
                    if 'iocs' in input_data:
                        for ioc in input_data['iocs']:
                            self.threat_graph.add_edge(actor, ioc,
                                type='attributed_to',
                                confidence=actor_data['confidence']
                            )
            
        except Exception as e:
            logger.error(f"Error updating threat graph: {str(e)}")
    
    def generate_threat_report(self, analysis_results: Dict) -> str:
        """Generate a comprehensive threat intelligence report"""
        
        report_sections = []
        
        # Executive Summary
        report_sections.append("# PHANTOM-Flow Threat Intelligence Analysis Report")
        report_sections.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        report_sections.append(f"**Analysis ID:** {analysis_results.get('analysis_id', 'N/A')}")
        report_sections.append("")
        
        # Risk Assessment
        if 'risk_assessment' in analysis_results['analysis_results']:
            risk_data = analysis_results['analysis_results']['risk_assessment']
            report_sections.append("## Executive Summary")
            report_sections.append(f"**Overall Risk Level:** {risk_data['risk_level'].upper()}")
            report_sections.append(f"**Risk Score:** {risk_data['overall_risk_score']:.2f}/1.00")
            report_sections.append(f"**Confidence:** {risk_data['confidence']:.2f}")
            report_sections.append(f"**Priority:** {risk_data['mitigation_priority'].upper()}")
            report_sections.append("")
        
        # IOC Analysis
        if 'ioc_analysis' in analysis_results['analysis_results']:
            ioc_data = analysis_results['analysis_results']['ioc_analysis']
            report_sections.append("## Indicators of Compromise (IOCs)")
            report_sections.append(f"**Total IOCs Analyzed:** {ioc_data['total_iocs']}")
            
            if ioc_data['reputation_scores']:
                high_risk_iocs = [
                    ioc for ioc, score in ioc_data['reputation_scores'].items()
                    if score > 0.7
                ]
                report_sections.append(f"**High-Risk IOCs:** {len(high_risk_iocs)}")
                
                if high_risk_iocs:
                    report_sections.append("### High-Risk IOCs:")
                    for ioc in high_risk_iocs[:10]:  # Limit to top 10
                        score = ioc_data['reputation_scores'][ioc]
                        ioc_type = ioc_data['ioc_types'].get(ioc, 'unknown')
                        report_sections.append(f"- `{ioc}` ({ioc_type}) - Risk: {score:.2f}")
            report_sections.append("")
        
        # Attribution Analysis
        if 'attribution' in analysis_results['analysis_results']:
            attribution_data = analysis_results['analysis_results']['attribution']
            report_sections.append("## Threat Actor Attribution")
            
            if attribution_data['likely_actors']:
                report_sections.append("### Likely Threat Actors:")
                for actor_data in attribution_data['likely_actors']:
                    report_sections.append(
                        f"- **{actor_data['actor']}** "
                        f"(Confidence: {actor_data['confidence']:.2f})"
                    )
                    report_sections.append(f"  - {actor_data['reasoning']}")
            else:
                report_sections.append("No specific threat actor attribution identified.")
            report_sections.append("")
        
        # Text Analysis
        if 'text_analysis' in analysis_results['analysis_results']:
            text_data = analysis_results['analysis_results']['text_analysis']
            report_sections.append("## Text Analysis")
            
            if text_data['threat_indicators']:
                report_sections.append("### Threat Indicators Found:")
                indicator_types = {}
                for indicator in text_data['threat_indicators']:
                    itype = indicator['type']
                    if itype not in indicator_types:
                        indicator_types[itype] = []
                    indicator_types[itype].append(indicator['value'])
                
                for itype, values in indicator_types.items():
                    report_sections.append(f"- **{itype.replace('_', ' ').title()}:** {len(values)} found")
                    for value in values[:5]:  # Show first 5
                        report_sections.append(f"  - `{value}`")
                    if len(values) > 5:
                        report_sections.append(f"  - ... and {len(values) - 5} more")
            
            if text_data['entities']:
                report_sections.append("### Named Entities:")
                entity_types = {}
                for entity in text_data['entities']:
                    etype = entity['label']
                    if etype not in entity_types:
                        entity_types[etype] = []
                    entity_types[etype].append(entity['text'])
                
                for etype, values in entity_types.items():
                    unique_values = list(set(values))
                    report_sections.append(f"- **{etype}:** {', '.join(unique_values[:5])}")
            report_sections.append("")
        
        # Recommendations
        if 'recommendations' in analysis_results:
            report_sections.append("## Recommendations")
            
            for rec in analysis_results['recommendations']:
                report_sections.append(f"### {rec['category']} (Priority: {rec['priority'].upper()})")
                report_sections.append(f"**Action:** {rec['action']}")
                
                if 'details' in rec:
                    report_sections.append("**Details:**")
                    for key, value in rec['details'].items():
                        if isinstance(value, list):
                            report_sections.append(f"- {key.replace('_', ' ').title()}: {', '.join(map(str, value[:5]))}")
                        else:
                            report_sections.append(f"- {key.replace('_', ' ').title()}: {value}")
                report_sections.append("")
        
        # Technical Details
        report_sections.append("## Technical Analysis Details")
        report_sections.append("### Analysis Components:")
        
        components = analysis_results['analysis_results'].keys()
        for component in components:
            report_sections.append(f"- {component.replace('_', ' ').title()}")
        
        report_sections.append("")
        report_sections.append("---")
        report_sections.append("*Report generated by PHANTOM-Flow Advanced Threat Intelligence System*")
        
        return "\n".join(report_sections)
    
    async def train_models(self, training_data: Dict):
        """Train/retrain ML models with new data"""
        logger.info("Training ML models with new data...")
        
        try:
            # Train threat classifier
            if 'threat_classification' in training_data:
                await self._train_threat_classifier(training_data['threat_classification'])
            
            # Train anomaly detector
            if 'normal_traffic' in training_data:
                await self._train_anomaly_detector(training_data['normal_traffic'])
            
            # Train attribution model
            if 'attribution_data' in training_data:
                await self._train_attribution_model(training_data['attribution_data'])
            
            logger.info("Model training completed successfully")
            
        except Exception as e:
            logger.error(f"Error during model training: {str(e)}")
            raise
    
    async def _train_threat_classifier(self, training_data: Dict):
        """Train the threat classification model"""
        # Implementation would train the actual model
        pass
    
    async def _train_anomaly_detector(self, training_data: Dict):
        """Train the anomaly detection model"""
        # Implementation would train the actual model
        pass
    
    async def _train_attribution_model(self, training_data: Dict):
        """Train the threat attribution model"""
        # Implementation would train the actual model
        pass
    
    def save_models(self, model_dir: str = "./models"):
        """Save trained models to disk"""
        import os
        os.makedirs(model_dir, exist_ok=True)
        
        try:
            # Save TensorFlow models
            for model_name, model in self.models.items():
                if hasattr(model, 'save'):
                    model_path = os.path.join(model_dir, f"{model_name}.h5")
                    model.save(model_path)
                    logger.info(f"Saved {model_name} to {model_path}")
            
            # Save scikit-learn models
            sklearn_models = ['risk_scorer']
            for model_name in sklearn_models:
                if model_name in self.models:
                    model_path = os.path.join(model_dir, f"{model_name}.pkl")
                    joblib.dump(self.models[model_name], model_path)
                    logger.info(f"Saved {model_name} to {model_path}")
            
            # Save threat graph
            graph_path = os.path.join(model_dir, "threat_graph.pkl")
            with open(graph_path, 'wb') as f:
                pickle.dump(self.threat_graph, f)
            logger.info(f"Saved threat graph to {graph_path}")
            
        except Exception as e:
            logger.error(f"Error saving models: {str(e)}")
    
    def load_models(self, model_dir: str = "./models"):
        """Load trained models from disk"""
        import os
        
        try:
            # Load TensorFlow models
            for model_name in ['threat_classifier', 'time_series', 'attribution']:
                model_path = os.path.join(model_dir, f"{model_name}.h5")
                if os.path.exists(model_path):
                    self.models[model_name] = keras.models.load_model(model_path)
                    logger.info(f"Loaded {model_name} from {model_path}")
            
            # Load scikit-learn models
            sklearn_models = ['risk_scorer']
            for model_name in sklearn_models:
                model_path = os.path.join(model_dir, f"{model_name}.pkl")
                if os.path.exists(model_path):
                    self.models[model_name] = joblib.load(model_path)
                    logger.info(f"Loaded {model_name} from {model_path}")
            
            # Load threat graph
            graph_path = os.path.join(model_dir, "threat_graph.pkl")
            if os.path.exists(graph_path):
                with open(graph_path, 'rb') as f:
                    self.threat_graph = pickle.load(f)
                logger.info(f"Loaded threat graph from {graph_path}")
            
        except Exception as e:
            logger.error(f"Error loading models: {str(e)}")

# Example usage and demonstration
async def main():
    """Example usage of the Advanced Threat Intelligence System"""
    
    # Initialize the system
    config = {
        'model_cache_dir': './models',
        'threat_feeds': ['misp', 'otx', 'virustotal'],
        'embedding_dim': 768,
        'max_sequence_length': 512
    }
    
    threat_intel_system = AdvancedThreatIntelligenceSystem(config)
    
    # Example threat intelligence data
    sample_data = {
        'text': """
        Suspicious activity detected from IP 192.168.1.100. 
        Multiple failed login attempts observed. 
        User-agent string contains 'bot' keyword.
        Possible credential stuffing attack in progress.
        CVE-2023-1234 exploitation attempt detected.
        """,
        'iocs': [
            '192.168.1.100',
            'malicious-domain.com',
            'a1b2c3d4e5f6789012345678901234567890abcdef',
            'suspicious@email.com'
        ],
        'timestamps': [
            '2024-01-15T10:30:00Z',
            '2024-01-15T10:31:00Z',
            '2024-01-15T10:32:00Z'
        ],
        'network_data': {
            'flows': [
                {
                    'src_ip': '192.168.1.100',
                    'dst_ip': '10.0.0.1',
                    'protocol': 'TCP',
                    'dst_port': 22,
                    'bytes': 1024
                }
            ],
            'feature_vectors': [
                [0.1, 0.2, 0.8, 0.4, 0.9],
                [0.2, 0.3, 0.1, 0.5, 0.2],
                [0.9, 0.8, 0.7, 0.9, 0.8]  # Anomalous
            ]
        }
    }
    
    print("PHANTOM-Flow Advanced Threat Intelligence Analysis")
    print("=" * 60)
    
    # Perform comprehensive analysis
    analysis_results = await threat_intel_system.analyze_threat_intelligence(sample_data)
    
    # Generate and display report
    report = threat_intel_system.generate_threat_report(analysis_results)
    print(report)
    
    # Save models
    threat_intel_system.save_models()
    
    print("\nAnalysis completed successfully!")
    print("Models and threat graph saved for future use.")

if __name__ == "__main__":
    asyncio.run(main())
