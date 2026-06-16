# PHANTOM-Flow Advanced Threat Detection ML Model
# Deep Learning Implementation for Cybersecurity

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import logging
from typing import Dict, List, Tuple, Optional
import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedThreatDetectionModel:
    """
    Advanced Machine Learning Model for Cybersecurity Threat Detection
    
    This model combines multiple ML algorithms to detect various types of threats:
    - Anomaly Detection using Isolation Forest
    - Classification using Random Forest and Neural Networks
    - Real-time threat scoring and risk assessment
    - Behavioral analysis and pattern recognition
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or self._default_config()
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        self.is_trained = False
        
        # Initialize TensorFlow GPU support
        self._setup_tensorflow()
        
    def _default_config(self) -> Dict:
        """Default configuration for the ML model"""
        return {
            'anomaly_contamination': 0.1,
            'rf_n_estimators': 200,
            'rf_max_depth': 20,
            'neural_network_layers': [128, 64, 32, 16],
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 100,
            'validation_split': 0.2,
            'early_stopping_patience': 10
        }
    
    def _setup_tensorflow(self):
        """Setup TensorFlow with GPU support if available"""
        try:
            gpus = tf.config.experimental.list_physical_devices('GPU')
            if gpus:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                logger.info(f"GPU support enabled: {len(gpus)} GPU(s) found")
            else:
                logger.info("No GPU found, using CPU")
        except RuntimeError as e:
            logger.warning(f"GPU setup failed: {e}")
    
    def preprocess_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Preprocess raw network traffic data for ML model training
        
        Args:
            data: Raw network traffic data
            
        Returns:
            Preprocessed data ready for training
        """
        logger.info("Starting data preprocessing...")
        
        # Feature engineering
        data = self._extract_features(data)
        
        # Handle missing values
        data = self._handle_missing_values(data)
        
        # Encode categorical variables
        data = self._encode_categorical_features(data)
        
        # Scale numerical features
        data = self._scale_numerical_features(data)
        
        logger.info(f"Preprocessing complete. Dataset shape: {data.shape}")
        return data
    
    def _extract_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Extract advanced features from network traffic data"""
        
        # Time-based features
        data['hour'] = pd.to_datetime(data['timestamp']).dt.hour
        data['day_of_week'] = pd.to_datetime(data['timestamp']).dt.dayofweek
        data['is_weekend'] = data['day_of_week'].isin([5, 6]).astype(int)
        
        # Request frequency features
        data['requests_per_minute'] = data.groupby(['ip_address', 'minute'])['request_id'].transform('count')
        data['unique_endpoints_per_session'] = data.groupby('session_id')['endpoint'].transform('nunique')
        
        # Behavioral features
        data['avg_response_time'] = data.groupby('ip_address')['response_time'].transform('mean')
        data['error_rate'] = data.groupby('ip_address')['status_code'].transform(lambda x: (x >= 400).mean())
        
        # Geographic features
        data['is_foreign_ip'] = (~data['country'].isin(['US', 'CA', 'GB'])).astype(int)
        
        # User agent analysis
        data['is_bot'] = data['user_agent'].str.contains('bot|crawler|spider', case=False, na=False).astype(int)
        data['browser_anomaly'] = self._detect_browser_anomalies(data['user_agent'])
        
        return data
    
    def _detect_browser_anomalies(self, user_agents: pd.Series) -> pd.Series:
        """Detect anomalous user agent strings"""
        # Common browser patterns
        common_patterns = [
            r'Mozilla/5\.0.*Chrome',
            r'Mozilla/5\.0.*Firefox',
            r'Mozilla/5\.0.*Safari',
            r'Mozilla/5\.0.*Edge'
        ]
        
        is_common = pd.Series([False] * len(user_agents), index=user_agents.index)
        for pattern in common_patterns:
            is_common |= user_agents.str.contains(pattern, case=False, na=False)
        
        return (~is_common).astype(int)
    
    def _handle_missing_values(self, data: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values using advanced imputation"""
        from sklearn.impute import KNNImputer
        
        numerical_cols = data.select_dtypes(include=[np.number]).columns
        categorical_cols = data.select_dtypes(include=['object']).columns
        
        # Impute numerical features
        if len(numerical_cols) > 0:
            imputer = KNNImputer(n_neighbors=5)
            data[numerical_cols] = imputer.fit_transform(data[numerical_cols])
        
        # Impute categorical features
        for col in categorical_cols:
            data[col] = data[col].fillna(data[col].mode().iloc[0] if not data[col].mode().empty else 'unknown')
        
        return data
    
    def _encode_categorical_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Encode categorical features using multiple techniques"""
        categorical_cols = data.select_dtypes(include=['object']).columns
        
        for col in categorical_cols:
            if col not in self.encoders:
                # Use target encoding for high cardinality features
                if data[col].nunique() > 10:
                    self.encoders[col] = self._target_encoder(data, col)
                else:
                    # Use label encoding for low cardinality features
                    encoder = LabelEncoder()
                    self.encoders[col] = encoder
                    data[col] = encoder.fit_transform(data[col].astype(str))
            else:
                if hasattr(self.encoders[col], 'transform'):
                    data[col] = self.encoders[col].transform(data[col].astype(str))
        
        return data
    
    def _target_encoder(self, data: pd.DataFrame, column: str) -> Dict:
        """Create target encoding for high cardinality categorical features"""
        if 'is_threat' in data.columns:
            encoding_map = data.groupby(column)['is_threat'].mean().to_dict()
        else:
            # Use mean encoding if no target available
            encoding_map = {val: idx for idx, val in enumerate(data[column].unique())}
        
        return encoding_map
    
    def _scale_numerical_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Scale numerical features using robust scaling"""
        numerical_cols = data.select_dtypes(include=[np.number]).columns
        
        if len(numerical_cols) > 0:
            if 'numerical' not in self.scalers:
                scaler = StandardScaler()
                self.scalers['numerical'] = scaler
                data[numerical_cols] = scaler.fit_transform(data[numerical_cols])
            else:
                data[numerical_cols] = self.scalers['numerical'].transform(data[numerical_cols])
        
        return data
    
    def train_models(self, X: pd.DataFrame, y: pd.Series):
        """
        Train multiple ML models for threat detection
        
        Args:
            X: Feature matrix
            y: Target labels (0: benign, 1: threat)
        """
        logger.info("Starting model training...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train Isolation Forest for anomaly detection
        self._train_isolation_forest(X_train)
        
        # Train Random Forest classifier
        self._train_random_forest(X_train, y_train)
        
        # Train Neural Network
        self._train_neural_network(X_train, y_train, X_test, y_test)
        
        # Evaluate models
        self._evaluate_models(X_test, y_test)
        
        self.is_trained = True
        logger.info("Model training completed successfully!")
    
    def _train_isolation_forest(self, X: pd.DataFrame):
        """Train Isolation Forest for anomaly detection"""
        logger.info("Training Isolation Forest...")
        
        iso_forest = IsolationForest(
            contamination=self.config['anomaly_contamination'],
            random_state=42,
            n_jobs=-1
        )
        
        self.models['isolation_forest'] = iso_forest.fit(X)
        logger.info("Isolation Forest training completed")
    
    def _train_random_forest(self, X: pd.DataFrame, y: pd.Series):
        """Train Random Forest classifier"""
        logger.info("Training Random Forest...")
        
        rf = RandomForestClassifier(
            n_estimators=self.config['rf_n_estimators'],
            max_depth=self.config['rf_max_depth'],
            random_state=42,
            n_jobs=-1,
            class_weight='balanced'
        )
        
        self.models['random_forest'] = rf.fit(X, y)
        logger.info("Random Forest training completed")
    
    def _train_neural_network(self, X_train: pd.DataFrame, y_train: pd.Series, 
                             X_test: pd.DataFrame, y_test: pd.Series):
        """Train deep neural network"""
        logger.info("Training Neural Network...")
        
        # Build model architecture
        model = tf.keras.Sequential()
        
        # Input layer
        model.add(tf.keras.layers.Dense(
            self.config['neural_network_layers'][0],
            input_shape=(X_train.shape[1],),
            activation='relu'
        ))
        model.add(tf.keras.layers.Dropout(0.3))
        
        # Hidden layers
        for units in self.config['neural_network_layers'][1:]:
            model.add(tf.keras.layers.Dense(units, activation='relu'))
            model.add(tf.keras.layers.Dropout(0.3))
        
        # Output layer
        model.add(tf.keras.layers.Dense(1, activation='sigmoid'))
        
        # Compile model
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=self.config['learning_rate']),
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        # Callbacks
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                patience=self.config['early_stopping_patience'],
                restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                factor=0.5,
                patience=5,
                min_lr=1e-7
            )
        ]
        
        # Train model
        history = model.fit(
            X_train, y_train,
            batch_size=self.config['batch_size'],
            epochs=self.config['epochs'],
            validation_data=(X_test, y_test),
            callbacks=callbacks,
            verbose=1
        )
        
        self.models['neural_network'] = model
        self.training_history = history
        logger.info("Neural Network training completed")
    
    def _evaluate_models(self, X_test: pd.DataFrame, y_test: pd.Series):
        """Evaluate all trained models"""
        logger.info("Evaluating models...")
        
        results = {}
        
        # Evaluate Random Forest
        if 'random_forest' in self.models:
            rf_pred = self.models['random_forest'].predict(X_test)
            rf_prob = self.models['random_forest'].predict_proba(X_test)[:, 1]
            
            results['random_forest'] = {
                'classification_report': classification_report(y_test, rf_pred),
                'confusion_matrix': confusion_matrix(y_test, rf_pred).tolist()
            }
        
        # Evaluate Neural Network
        if 'neural_network' in self.models:
            nn_pred = (self.models['neural_network'].predict(X_test) > 0.5).astype(int)
            nn_prob = self.models['neural_network'].predict(X_test).flatten()
            
            results['neural_network'] = {
                'classification_report': classification_report(y_test, nn_pred),
                'confusion_matrix': confusion_matrix(y_test, nn_pred).tolist()
            }
        
        # Evaluate Isolation Forest
        if 'isolation_forest' in self.models:
            iso_pred = self.models['isolation_forest'].predict(X_test)
            iso_pred = (iso_pred == -1).astype(int)  # Convert to 0/1
            
            results['isolation_forest'] = {
                'classification_report': classification_report(y_test, iso_pred),
                'confusion_matrix': confusion_matrix(y_test, iso_pred).tolist()
            }
        
        self.evaluation_results = results
        logger.info("Model evaluation completed")
    
    def predict(self, data: pd.DataFrame) -> Dict:
        """
        Make predictions using ensemble of trained models
        
        Args:
            data: Input data for prediction
            
        Returns:
            Dictionary containing predictions from all models
        """
        if not self.is_trained:
            raise ValueError("Models must be trained before making predictions")
        
        # Preprocess data
        processed_data = self.preprocess_data(data.copy())
        
        predictions = {}
        
        # Random Forest predictions
        if 'random_forest' in self.models:
            rf_pred = self.models['random_forest'].predict(processed_data)
            rf_prob = self.models['random_forest'].predict_proba(processed_data)[:, 1]
            predictions['random_forest'] = {
                'predictions': rf_pred.tolist(),
                'probabilities': rf_prob.tolist()
            }
        
        # Neural Network predictions
        if 'neural_network' in self.models:
            nn_prob = self.models['neural_network'].predict(processed_data).flatten()
            nn_pred = (nn_prob > 0.5).astype(int)
            predictions['neural_network'] = {
                'predictions': nn_pred.tolist(),
                'probabilities': nn_prob.tolist()
            }
        
        # Isolation Forest predictions
        if 'isolation_forest' in self.models:
            iso_scores = self.models['isolation_forest'].decision_function(processed_data)
            iso_pred = self.models['isolation_forest'].predict(processed_data)
            iso_pred = (iso_pred == -1).astype(int)
            predictions['isolation_forest'] = {
                'predictions': iso_pred.tolist(),
                'anomaly_scores': iso_scores.tolist()
            }
        
        # Ensemble prediction (weighted average)
        ensemble_prob = self._ensemble_predict(predictions)
        predictions['ensemble'] = {
            'predictions': (ensemble_prob > 0.5).astype(int).tolist(),
            'probabilities': ensemble_prob.tolist()
        }
        
        return predictions
    
    def _ensemble_predict(self, predictions: Dict) -> np.ndarray:
        """Create ensemble predictions using weighted average"""
        weights = {'random_forest': 0.4, 'neural_network': 0.4, 'isolation_forest': 0.2}
        ensemble_prob = np.zeros(len(predictions['random_forest']['probabilities']))
        
        for model_name, weight in weights.items():
            if model_name in predictions:
                if 'probabilities' in predictions[model_name]:
                    ensemble_prob += weight * np.array(predictions[model_name]['probabilities'])
                elif 'anomaly_scores' in predictions[model_name]:
                    # Convert anomaly scores to probabilities
                    scores = np.array(predictions[model_name]['anomaly_scores'])
                    prob = 1 / (1 + np.exp(scores))  # Sigmoid transformation
                    ensemble_prob += weight * prob
        
        return ensemble_prob
    
    def save_models(self, filepath: str):
        """Save trained models to disk"""
        model_data = {
            'models': {},
            'scalers': self.scalers,
            'encoders': self.encoders,
            'config': self.config,
            'is_trained': self.is_trained
        }
        
        # Save non-TensorFlow models
        for name, model in self.models.items():
            if name != 'neural_network':
                model_data['models'][name] = model
        
        # Save the main model data
        joblib.dump(model_data, f"{filepath}_models.pkl")
        
        # Save TensorFlow model separately
        if 'neural_network' in self.models:
            self.models['neural_network'].save(f"{filepath}_neural_network.h5")
        
        logger.info(f"Models saved to {filepath}")
    
    def load_models(self, filepath: str):
        """Load trained models from disk"""
        try:
            model_data = joblib.load(f"{filepath}_models.pkl")
            self.scalers = model_data['scalers']
            self.encoders = model_data['encoders']
            self.config = model_data['config']
            self.is_trained = model_data['is_trained']
            self.models = model_data['models']
            logger.info(f"Models loaded from {filepath}")
        except FileNotFoundError:
            logger.warning(f"Model file not found at {filepath}_models.pkl, using untrained models")
            self.is_trained = False
        except Exception as e:
            logger.warning(f"Failed to load models from {filepath}: {e}")
            self.is_trained = False
        
        # Load TensorFlow model
        try:
            self.models['neural_network'] = tf.keras.models.load_model(f"{filepath}_neural_network.h5")
        except:
            logger.warning("Neural network model not found or could not be loaded")

class RealTimeThreatDetector:
    """Real-time threat detection system using trained ML models"""
    
    def __init__(self, model_path: str):
        self.model = AdvancedThreatDetectionModel()
        self.model.load_models(model_path)
        self.threat_buffer = []
        
    async def process_request(self, request_data: Dict) -> Dict:
        """Process incoming request in real-time"""
        # Convert request to DataFrame
        df = pd.DataFrame([request_data])
        
        # Make prediction
        prediction = self.model.predict(df)
        
        # Calculate threat score
        threat_score = self._calculate_threat_score(prediction)
        
        # Determine action
        action = self._determine_action(threat_score)
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'threat_score': threat_score,
            'action': action,
            'predictions': prediction,
            'request_id': request_data.get('request_id', 'unknown')
        }
        
        # Store in buffer for analysis
        self.threat_buffer.append(result)
        if len(self.threat_buffer) > 1000:
            self.threat_buffer.pop(0)
        
        return result
    
    def _calculate_threat_score(self, predictions: Dict) -> float:
        """Calculate overall threat score from model predictions"""
        if 'ensemble' in predictions:
            return float(np.mean(predictions['ensemble']['probabilities']))
        
        # Fallback to individual model scores
        scores = []
        for model_name, pred in predictions.items():
            if 'probabilities' in pred:
                scores.append(np.mean(pred['probabilities']))
        
        return float(np.mean(scores)) if scores else 0.0
    
    def _determine_action(self, threat_score: float) -> str:
        """Determine action based on threat score"""
        if threat_score >= 0.9:
            return 'block'
        elif threat_score >= 0.7:
            return 'challenge'
        elif threat_score >= 0.5:
            return 'monitor'
        else:
            return 'allow'

# Example usage and testing
if __name__ == "__main__":
    # Initialize model
    model = AdvancedThreatDetectionModel()
    
    # Generate sample training data
    np.random.seed(42)
    n_samples = 10000
    
    sample_data = pd.DataFrame({
        'timestamp': pd.date_range('2024-01-01', periods=n_samples, freq='1min'),
        'ip_address': np.random.choice(['192.168.1.1', '10.0.0.1', '172.16.0.1'], n_samples),
        'user_agent': np.random.choice(['Mozilla/5.0 Chrome', 'Mozilla/5.0 Firefox', 'Bot/1.0'], n_samples),
        'endpoint': np.random.choice(['/api/data', '/login', '/admin'], n_samples),
        'response_time': np.random.normal(200, 50, n_samples),
        'status_code': np.random.choice([200, 404, 500], n_samples),
        'country': np.random.choice(['US', 'CA', 'RU', 'CN'], n_samples),
        'session_id': np.random.randint(1, 1000, n_samples),
        'request_id': range(n_samples),
        'minute': np.random.randint(0, 60, n_samples),
        'is_threat': np.random.choice([0, 1], n_samples, p=[0.9, 0.1])
    })
    
    # Preprocess data
    X = model.preprocess_data(sample_data.drop('is_threat', axis=1))
    y = sample_data['is_threat']
    
    # Train models
    model.train_models(X, y)
    
    # Save models
    model.save_models('phantom_flow_model')
    
    # Test real-time detection
    detector = RealTimeThreatDetector('phantom_flow_model')
    
    test_request = {
        'timestamp': datetime.now().isoformat(),
        'ip_address': '192.168.1.100',
        'user_agent': 'Suspicious Bot/1.0',
        'endpoint': '/admin',
        'response_time': 1000,
        'status_code': 200,
        'country': 'RU',
        'session_id': 9999,
        'request_id': 'test_001',
        'minute': 30
    }
    
    # Async test
    async def test_detection():
        result = await detector.process_request(test_request)
        print("Threat Detection Result:")
        print(json.dumps(result, indent=2))
    
    # Run test
    asyncio.run(test_detection())
