package config

import (
	"encoding/json"
	"github.com/joho/godotenv"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port, DatabaseURL, JWTSecret, PublicBaseURL, UploadDir, CORSOrigins                                                    string
	Polygon                                                                                                                [][]float64
	JazzCashMerchantID, JazzCashPassword, JazzCashSharedSecret, JazzCashMWalletURL, JazzCashStatusURL, JazzCashCallbackURL string
	JazzCashTimeout                                                                                                        time.Duration
	SMTPHost, SMTPPort, SMTPUsername, SMTPPassword, SMTPFrom                                                               string
}

func Load() Config {
	_ = godotenv.Load()
	sec, _ := strconv.Atoi(get("JAZZCASH_TIMEOUT_SECONDS", "30"))
	var p [][]float64
	_ = json.Unmarshal([]byte(get("SERVICE_AREA_POLYGON", "[]")), &p)
	return Config{get("PORT", "8080"), get("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/freshcart?sslmode=disable"), get("JWT_SECRET", "change-me"), strings.TrimRight(get("PUBLIC_BASE_URL", "http://localhost:8080"), "/"), get("UPLOAD_DIR", "./uploads"), get("CORS_ORIGINS", "*"), p, os.Getenv("JAZZCASH_MERCHANT_ID"), os.Getenv("JAZZCASH_PASSWORD"), os.Getenv("JAZZCASH_SHARED_SECRET"), os.Getenv("JAZZCASH_MWALLET_URL"), os.Getenv("JAZZCASH_STATUS_URL"), os.Getenv("JAZZCASH_CALLBACK_URL"), time.Duration(sec) * time.Second, os.Getenv("SMTP_HOST"), get("SMTP_PORT", "587"), os.Getenv("SMTP_USERNAME"), os.Getenv("SMTP_PASSWORD"), get("SMTP_FROM", os.Getenv("SMTP_USERNAME"))}
}
func get(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
