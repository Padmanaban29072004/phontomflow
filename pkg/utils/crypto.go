// PHANTOM-Flow Cryptographic Utilities
package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
)

type CryptoUtils struct{}

func NewCryptoUtils() *CryptoUtils {
	return &CryptoUtils{}
}

func (cu *CryptoUtils) GenerateKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, err
	}
	return key, nil
}

func (cu *CryptoUtils) HashData(data []byte) []byte {
	hash := sha256.Sum256(data)
	return hash[:]
}

func (cu *CryptoUtils) Encrypt(data, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return ciphertext, nil
}

func (cu *CryptoUtils) Decrypt(data, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func (cu *CryptoUtils) VerifyHash(data, hash []byte) bool {
	computed := cu.HashData(data)
	if len(computed) != len(hash) {
		return false
	}
	
	for i := range computed {
		if computed[i] != hash[i] {
			return false
		}
	}
	return true
}
