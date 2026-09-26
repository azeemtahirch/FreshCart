package handlers

import (
	"fmt"
	"github.com/google/uuid"
	"math"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type couponView struct {
	ID             int64
	Code           string
	DiscountType   string
	DiscountValue  float64
	MinOrderAmount float64
	MaxDiscount    float64
	UsageLimit     int
	UsedCount      int
	StartsAt       time.Time
	ExpiresAt      time.Time
	IsActive       bool
}

func couponDiscount(coupon couponView, subtotal float64) (float64, error) {
	if !coupon.IsActive {
		return 0, fmt.Errorf("coupon is inactive")
	}
	now := time.Now()
	if now.Before(coupon.StartsAt) {
		return 0, fmt.Errorf("coupon is not active yet")
	}
	if !now.Before(coupon.ExpiresAt) {
		return 0, fmt.Errorf("coupon has expired")
	}
	if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
		return 0, fmt.Errorf("coupon usage limit reached")
	}
	if subtotal < coupon.MinOrderAmount {
		return 0, fmt.Errorf("minimum subtotal for %s is Rs. %.0f", coupon.Code, coupon.MinOrderAmount)
	}

	var discount float64
	switch coupon.DiscountType {
	case "percentage":
		discount = subtotal * coupon.DiscountValue / 100
	case "fixed":
		discount = coupon.DiscountValue
	default:
		return 0, fmt.Errorf("unsupported coupon type")
	}
	if coupon.MaxDiscount > 0 && discount > coupon.MaxDiscount {
		discount = coupon.MaxDiscount
	}
	discount = math.Min(math.Max(discount, 0), subtotal)
	return math.Round(discount*100) / 100, nil
}

func (h *H) Coupons(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,used_count,starts_at,expires_at,is_active FROM coupons WHERE is_active=true AND expires_at>now() ORDER BY expires_at,code`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	out := []gin.H{}
	for rows.Next() {
		var x couponView
		if e = rows.Scan(&x.ID, &x.Code, &x.DiscountType, &x.DiscountValue, &x.MinOrderAmount, &x.MaxDiscount, &x.UsageLimit, &x.UsedCount, &x.StartsAt, &x.ExpiresAt, &x.IsActive); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{
			"id": x.ID, "code": x.Code, "discount_type": x.DiscountType,
			"discount_value": x.DiscountValue, "min_order_amount": x.MinOrderAmount,
			"max_discount": x.MaxDiscount, "usage_limit": x.UsageLimit,
			"used_count": x.UsedCount, "starts_at": x.StartsAt, "expires_at": x.ExpiresAt,
		})
	}
	c.JSON(200, out)
}

func (h *H) ValidateCoupon(c *gin.Context) {
	var x struct {
		Code     string  `json:"code"`
		Subtotal float64 `json:"subtotal"`
	}
	if c.ShouldBindJSON(&x) != nil || strings.TrimSpace(x.Code) == "" || x.Subtotal < 0 {
		err(c, 400, fmt.Errorf("coupon code and valid subtotal are required"))
		return
	}
	var cp couponView
	e := h.DB.QueryRow(c, `SELECT id,code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,used_count,starts_at,expires_at,is_active FROM coupons WHERE upper(code)=upper($1)`, strings.TrimSpace(x.Code)).Scan(&cp.ID, &cp.Code, &cp.DiscountType, &cp.DiscountValue, &cp.MinOrderAmount, &cp.MaxDiscount, &cp.UsageLimit, &cp.UsedCount, &cp.StartsAt, &cp.ExpiresAt, &cp.IsActive)
	if e != nil {
		err(c, 404, fmt.Errorf("invalid coupon code"))
		return
	}
	discount, e := couponDiscount(cp, x.Subtotal)
	if e != nil {
		err(c, 400, e)
		return
	}
	c.JSON(200, gin.H{
		"valid":             true,
		"code":              cp.Code,
		"discount_type":     cp.DiscountType,
		"discount_value":    cp.DiscountValue,
		"discount":          discount,
		"subtotal":          x.Subtotal,
		"shipping_discount": 0,
		"message":           fmt.Sprintf("%s applied. Discount is calculated on product subtotal only.", cp.Code),
	})
}

func (h *H) AdminCoupons(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,used_count,starts_at,expires_at,is_active FROM coupons ORDER BY created_at DESC`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	out := []gin.H{}
	for rows.Next() {
		var x couponView
		if e = rows.Scan(&x.ID, &x.Code, &x.DiscountType, &x.DiscountValue, &x.MinOrderAmount, &x.MaxDiscount, &x.UsageLimit, &x.UsedCount, &x.StartsAt, &x.ExpiresAt, &x.IsActive); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": x.ID, "code": x.Code, "discount_type": x.DiscountType, "discount_value": x.DiscountValue, "min_order_amount": x.MinOrderAmount, "max_discount": x.MaxDiscount, "usage_limit": x.UsageLimit, "used_count": x.UsedCount, "starts_at": x.StartsAt, "expires_at": x.ExpiresAt, "is_active": x.IsActive})
	}
	c.JSON(200, out)
}

func (h *H) AdminCreateCoupon(c *gin.Context) {
	var x struct {
		Code           string  `json:"code"`
		DiscountType   string  `json:"discount_type"`
		DiscountValue  float64 `json:"discount_value"`
		MinOrderAmount float64 `json:"min_order_amount"`
		MaxDiscount    float64 `json:"max_discount"`
		UsageLimit     int     `json:"usage_limit"`
		StartsAt       string  `json:"starts_at"`
		ExpiresAt      string  `json:"expires_at"`
		IsActive       bool    `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("invalid coupon data"))
		return
	}
	x.Code = strings.ToUpper(strings.TrimSpace(x.Code))
	if x.Code == "" {
		x.Code = "FRESH-" + strings.ToUpper(uuid.NewString()[:6])
	}
	if x.DiscountType != "percentage" && x.DiscountType != "fixed" {
		err(c, 400, fmt.Errorf("discount_type must be percentage or fixed"))
		return
	}
	if x.DiscountValue <= 0 || x.MinOrderAmount < 0 || x.MaxDiscount < 0 || x.UsageLimit < 0 {
		err(c, 400, fmt.Errorf("invalid coupon values"))
		return
	}
	start := time.Now()
	if strings.TrimSpace(x.StartsAt) != "" {
		parsed, e := time.Parse(time.RFC3339, x.StartsAt)
		if e != nil {
			err(c, 400, fmt.Errorf("starts_at must be RFC3339"))
			return
		}
		start = parsed
	}
	expiry := time.Now().AddDate(0, 0, 30)
	if strings.TrimSpace(x.ExpiresAt) != "" {
		parsed, e := time.Parse(time.RFC3339, x.ExpiresAt)
		if e != nil {
			err(c, 400, fmt.Errorf("expires_at must be RFC3339"))
			return
		}
		expiry = parsed
	}
	if !expiry.After(start) {
		err(c, 400, fmt.Errorf("expiry must be after start"))
		return
	}
	var id int64
	e := h.DB.QueryRow(c, `INSERT INTO coupons(code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,starts_at,expires_at,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, x.Code, x.DiscountType, x.DiscountValue, x.MinOrderAmount, x.MaxDiscount, x.UsageLimit, start, expiry, x.IsActive).Scan(&id)
	if e != nil {
		err(c, 409, fmt.Errorf("coupon code already exists or could not be created"))
		return
	}
	if x.IsActive {
		data := map[string]any{"coupon_id": id, "code": x.Code, "discount_type": x.DiscountType, "discount_value": x.DiscountValue, "min_order_amount": x.MinOrderAmount, "max_discount": x.MaxDiscount, "expires_at": expiry, "type": "coupon"}
		rows, _ := h.DB.Query(c, `SELECT id FROM users WHERE role='customer' AND is_active=true`)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var uid int64
				if rows.Scan(&uid) == nil {
					msg := fmt.Sprintf("Use coupon %s and save on your next FreshCart order.", x.Code)
					_ = h.insertNotification(c, uid, "New Coupon 🎁", msg, "coupon", data)
					_ = sendPush(h.pushTokensForUser(c, uid), "FreshCart Coupon 🎁", msg, data)
				}
			}
		}
	}
	c.JSON(201, gin.H{"id": id, "code": x.Code, "discount_type": x.DiscountType, "discount_value": x.DiscountValue, "min_order_amount": x.MinOrderAmount, "max_discount": x.MaxDiscount, "usage_limit": x.UsageLimit, "starts_at": start, "expires_at": expiry, "is_active": x.IsActive})
}

func (h *H) AdminUpdateCoupon(c *gin.Context) {
	var x struct {
		IsActive bool `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("invalid coupon"))
		return
	}
	id := c.Param("id")
	if _, e := h.DB.Exec(c, `UPDATE coupons SET is_active=$1,updated_at=now() WHERE id=$2`, x.IsActive, id); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
