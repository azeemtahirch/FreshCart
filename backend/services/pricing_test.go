package services

import "testing"

func TestShippingUsesConfiguredRules(t *testing.T) {
	settings := ShippingSettings{MinimumOrderAmount: 250, ShippingFee: 70, ShippingTiers: []ShippingTier{{250, 500, 70}, {500, 700, 60}, {700, 1000, 50}, {1000, 0, 30}}, FreeShippingThreshold: 1500, Currency: "PKR", FreeShippingEnabled: false}

	if fee, allowed := Shipping(200, settings); allowed || fee != 70 {
		t.Fatalf("subtotal below minimum: got fee=%v allowed=%v", fee, allowed)
	}
	if fee, allowed := Shipping(250, settings); !allowed || fee != 70 {
		t.Fatalf("subtotal at minimum: got fee=%v allowed=%v", fee, allowed)
	}
	if fee, allowed := Shipping(500, settings); !allowed || fee != 60 {
		t.Fatalf("regular eligible order: got fee=%v allowed=%v", fee, allowed)
	}
	if fee, allowed := Shipping(1200, settings); !allowed || fee != 30 {
		t.Fatalf("highest tier: got fee=%v allowed=%v", fee, allowed)
	}
	if fee, allowed := Shipping(2000, settings); !allowed || fee != 30 {
		t.Fatalf("free shipping must be off by default: got fee=%v allowed=%v", fee, allowed)
	}
	settings.FreeShippingEnabled = true
	if fee, allowed := Shipping(1500, settings); !allowed || fee != 0 {
		t.Fatalf("free shipping threshold: got fee=%v allowed=%v", fee, allowed)
	}

	settings.MinimumOrderAmount = 500
	settings.ShippingFee = 50
	if fee, allowed := Shipping(400, settings); allowed || fee != 70 {
		t.Fatalf("updated configuration: got fee=%v allowed=%v", fee, allowed)
	}
}
