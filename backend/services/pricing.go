package services

import (
	"fmt"
	"strings"
)

var Sizes = []int{250, 500, 1000, 2000, 3000, 4000, 5000}

// ProductSize is a customer-selectable quantity for kg/liter products.
// Value is grams for kg products and milliliters for liter products.
// Dozen products use value=1.
type ProductSize struct {
	Value int    `json:"value"`
	Label string `json:"label"`
}

func DefaultProductSizes(unit string) []ProductSize {
	if unit == "dozen" {
		return []ProductSize{{Value: 1, Label: "1 dozen"}}
	}
	out := make([]ProductSize, 0, len(Sizes))
	for _, v := range Sizes {
		out = append(out, ProductSize{Value: v, Label: SizeLabel(v, unit)})
	}
	return out
}

func NormalizeProductSizes(unit string, options []ProductSize) []ProductSize {
	if unit == "dozen" {
		return []ProductSize{{Value: 1, Label: "1 dozen"}}
	}
	seen := map[int]bool{}
	out := make([]ProductSize, 0, len(options))
	for _, o := range options {
		if o.Value <= 0 || seen[o.Value] {
			continue
		}
		o.Label = strings.TrimSpace(o.Label)
		if o.Label == "" {
			o.Label = SizeLabel(o.Value, unit)
		}
		seen[o.Value] = true
		out = append(out, o)
	}
	if len(out) == 0 {
		return DefaultProductSizes(unit)
	}
	return out
}

func ValidSize(x int) bool {
	for _, v := range Sizes {
		if x == v {
			return true
		}
	}
	return false
}
func UnitPrice(base float64, size int) float64 { return base * float64(size) / 1000 }

type ShippingSettings struct {
	MinimumOrderAmount    float64
	ShippingFee           float64
	ShippingTiers         []ShippingTier
	FreeShippingThreshold float64
	Currency              string
	FreeShippingEnabled   bool
}

// ShippingTier applies from MinAmount (inclusive) up to MaxAmount (exclusive).
// A zero MaxAmount means the tier has no upper limit.
type ShippingTier struct {
	MinAmount float64 `json:"min_amount"`
	MaxAmount float64 `json:"max_amount"`
	Fee       float64 `json:"fee"`
}

func tierFee(subtotal float64, settings ShippingSettings) float64 {
	for _, tier := range settings.ShippingTiers {
		if subtotal >= tier.MinAmount && (tier.MaxAmount == 0 || subtotal < tier.MaxAmount) {
			return tier.Fee
		}
	}
	// Retain a safe fallback for installations that have not yet been migrated.
	return settings.ShippingFee
}

func Shipping(subtotal float64, settings ShippingSettings) (float64, bool) {
	if subtotal < settings.MinimumOrderAmount {
		return tierFee(subtotal, settings), false
	}
	if settings.FreeShippingEnabled && settings.FreeShippingThreshold > 0 && subtotal >= settings.FreeShippingThreshold {
		return 0, true
	}
	return tierFee(subtotal, settings), true
}
func SizeLabel(size int, unit string) string {
	if size < 1000 {
		if unit == "liter" {
			return fmt.Sprintf("%d ml", size)
		}
		return fmt.Sprintf("%d g", size)
	}
	if unit == "liter" {
		return fmt.Sprintf("%d L", size/1000)
	}
	return fmt.Sprintf("%d kg", size/1000)
}
func Progress(s float64, settings ShippingSettings) map[string]any {
	ship, ok := Shipping(s, settings)
	m := map[string]any{"minimum_order": settings.MinimumOrderAmount, "shipping": ship, "allowed": ok, "shipping_fee": settings.ShippingFee, "shipping_tiers": settings.ShippingTiers, "free_shipping_threshold": settings.FreeShippingThreshold, "free_shipping_enabled": settings.FreeShippingEnabled, "currency": settings.Currency}
	if s < settings.MinimumOrderAmount {
		m["message"] = fmt.Sprintf("Add %s %.0f more to place your order.", settings.Currency, settings.MinimumOrderAmount-s)
	} else if settings.FreeShippingEnabled && settings.FreeShippingThreshold > 0 && s < settings.FreeShippingThreshold {
		m["message"] = fmt.Sprintf("Add %s %.0f more for free shipping.", settings.Currency, settings.FreeShippingThreshold-s)
	} else if settings.FreeShippingEnabled {
		m["message"] = "Free shipping unlocked."
	} else {
		m["message"] = "Standard shipping applies."
	}
	return m
}
