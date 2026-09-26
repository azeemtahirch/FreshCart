package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"freshcart/backend/config"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

type JazzCash struct{ C config.Config }

func NewJazzCash(c config.Config) *JazzCash { return &JazzCash{c} }
func SecureHash(v map[string]string, secret string) string {
	keys := []string{}
	for k, x := range v {
		if k != "pp_SecureHash" && x != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	raw := secret
	for _, k := range keys {
		raw += "&" + v[k]
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(raw))
	return strings.ToUpper(hex.EncodeToString(m.Sum(nil)))
}
func Verify(v map[string]string, s string) bool {
	g := v["pp_SecureHash"]
	if g == "" || s == "" {
		return false
	}
	return hmac.Equal([]byte(strings.ToUpper(strings.TrimSpace(g))), []byte(SecureHash(v, s)))
}
func (j *JazzCash) Initiate(ctx context.Context, txn string, amount float64, bill string) (map[string]any, error) {
	if j.C.JazzCashMerchantID == "" || j.C.JazzCashPassword == "" || j.C.JazzCashSharedSecret == "" || j.C.JazzCashMWalletURL == "" {
		return nil, fmt.Errorf("JazzCash is not configured")
	}
	now := time.Now()
	v := map[string]string{"pp_Version": "2.0", "pp_TxnType": "MWALLET", "pp_Language": "EN", "pp_MerchantID": j.C.JazzCashMerchantID, "pp_Password": j.C.JazzCashPassword, "pp_TxnRefNo": txn, "pp_Amount": fmt.Sprintf("%.0f", amount*100), "pp_TxnCurrency": "PKR", "pp_TxnDateTime": now.Format("20060102150405"), "pp_TxnExpiryDateTime": now.Add(30 * time.Minute).Format("20060102150405"), "pp_BillReference": bill, "pp_Description": "FreshCart grocery order", "pp_ReturnURL": j.C.JazzCashCallbackURL}
	v["pp_SecureHash"] = SecureHash(v, j.C.JazzCashSharedSecret)
	b, _ := json.Marshal(v)
	req, e := http.NewRequestWithContext(ctx, http.MethodPost, j.C.JazzCashMWalletURL, bytes.NewReader(b))
	if e != nil {
		return nil, e
	}
	req.Header.Set("Content-Type", "application/json")
	cl := http.Client{Timeout: j.C.JazzCashTimeout}
	resp, e := cl.Do(req)
	if e != nil {
		return nil, e
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("JazzCash HTTP %d", resp.StatusCode)
	}
	var out map[string]any
	if e = json.Unmarshal(raw, &out); e != nil {
		return nil, e
	}
	return out, nil
}
