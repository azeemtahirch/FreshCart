package main

import (
	"context"
	"freshcart/backend/config"
	"freshcart/backend/database"
	"freshcart/backend/handlers"
	"freshcart/backend/middleware"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	c := config.Load()
	os.MkdirAll(c.UploadDir, 0755)
	db := database.Connect(context.Background(), c.DatabaseURL)
	database.Migrate(context.Background(), db, "schema.sql")
	defer db.Close()
	h := handlers.New(db, c)
	h.Seed(context.Background())
	startNotificationCleanup(context.Background(), h)
	r := gin.Default()
	r.Use(cors.New(cors.Config{AllowOrigins: strings.Split(c.CORSOrigins, ","), AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Authorization"}, AllowCredentials: true, MaxAge: 12 * time.Hour}))
	r.Static("/uploads", c.UploadDir)
	a := r.Group("/api")
	a.GET("/health", h.Health)
	a.GET("/service-area", h.Area)
	a.POST("/auth/register", h.Register)
	a.POST("/auth/login", h.Login)
	a.POST("/auth/forgot-password", h.ForgotPassword)
	a.POST("/auth/reset-password", h.ResetPassword)
	a.GET("/categories", h.Categories)
	a.GET("/products", h.Products)
	a.GET("/products/:id", h.Product)
	a.GET("/prices/today", h.Prices)
	a.GET("/shipping-settings", h.ShippingSettings)
	a.GET("/shipping/cities", h.ShippingCities)
	a.GET("/shipping/cities/:cityID/areas", h.ShippingAreas)
	a.GET("/coupons", h.Coupons)
	a.POST("/coupons/validate", h.ValidateCoupon)
	a.GET("/time-slots", h.Slots)
	a.POST("/payments/jazzcash/callback", h.JazzCallback)
	a.GET("/payments/:txnRef/status", h.PaymentStatus)
	auth := a.Group("")
	auth.Use(middleware.Auth(c.JWTSecret))
	auth.GET("/addresses", h.Addresses)
	auth.POST("/addresses", h.CreateAddress)
	auth.PUT("/addresses/:id", h.UpdateAddress)
	auth.DELETE("/addresses/:id", h.DeleteAddress)
	auth.POST("/orders", h.CreateOrder)
	auth.GET("/notifications", h.Notifications)
	auth.PUT("/notifications/:id/read", h.MarkNotificationRead)
	auth.POST("/notifications/push-token", h.PushToken)
	auth.GET("/orders", h.Orders)
	auth.GET("/orders/:id", h.Order)
	auth.POST("/payments/jazzcash/initiate", h.JazzInitiate)
	ri := auth.Group("/rider")
	ri.Use(middleware.Role("rider"))
	ri.GET("/orders", h.RiderOrders)
	ri.PUT("/orders/:id/status", h.RiderStatus)
	ri.POST("/orders/:id/start", h.RiderStart)
	ri.POST("/orders/:id/photo", h.RiderPhoto)
	ri.POST("/orders/:id/complete", h.RiderComplete)
	ad := auth.Group("/admin")
	ad.Use(middleware.Role("admin"))
	ad.GET("/dashboard", h.AdminDashboard)
	ad.GET("/notifications", h.AdminNotifications)
	ad.GET("/products", h.AdminProductList)
	ad.GET("/categories", h.AdminCategoryList)
	ad.POST("/categories", h.AdminCategory)
	ad.PUT("/categories/:id", h.AdminUpdateCategory)
	ad.POST("/products", h.AdminProducts)
	ad.PUT("/products/:id", h.AdminUpdateProduct)
	ad.DELETE("/products/:id", h.AdminDeleteProduct)
	ad.POST("/products/:id/image", h.AdminProductImage)
	ad.GET("/orders", h.AdminOrders)
	ad.GET("/orders/:id/eligible-riders", h.AdminEligibleRiders)
	ad.PUT("/orders/:id/status", h.AdminOrderStatus)
	ad.POST("/orders/:id/assign-rider", h.AdminAssign)
	ad.GET("/riders", h.AdminRiders)
	ad.POST("/riders", h.AdminAddRider)
	ad.PUT("/riders/:id", h.AdminUpdateRider)
	ad.DELETE("/riders/:id", h.AdminDeleteRider)
	ad.GET("/time-slots/availability", h.AdminSlotAvailability)
	ad.GET("/riders/:id/time-slots", h.AdminRiderSlots)
	ad.POST("/riders/:id/time-slots", h.AdminAssignSlot)
	ad.PUT("/riders/:id/time-slots", h.AdminSetRiderSlots)
	ad.DELETE("/riders/:id/time-slots/:slotID", h.AdminRemoveSlot)
	ad.GET("/time-slots", h.AdminSlotList)
	ad.POST("/time-slots", h.AdminSlot)
	ad.PUT("/time-slots/:id", h.AdminUpdateSlot)
	ad.DELETE("/time-slots/:id", h.AdminDeleteSlot)
	ad.GET("/prices", h.AdminPriceList)
	ad.GET("/settings/shipping", h.AdminShippingSettings)
	ad.GET("/shipping-cities", h.AdminShippingCities)
	ad.POST("/shipping-cities", h.AdminAddShippingCity)
	ad.PUT("/shipping-cities/:id", h.AdminUpdateShippingCity)
	ad.DELETE("/shipping-cities/:id", h.AdminDeleteShippingCity)
	ad.GET("/shipping-areas", h.AdminShippingAreas)
	ad.POST("/shipping-areas", h.AdminAddShippingArea)
	ad.PUT("/shipping-areas/:id", h.AdminUpdateShippingArea)
	ad.DELETE("/shipping-areas/:id", h.AdminDeleteShippingArea)
	ad.PUT("/settings/shipping", h.AdminUpdateShippingSettings)
	ad.POST("/prices", h.AdminPrice)
	ad.GET("/coupons", h.AdminCoupons)
	ad.POST("/coupons", h.AdminCreateCoupon)
	ad.PUT("/coupons/:id", h.AdminUpdateCoupon)
	log.Printf("FreshCart API listening on :%s", c.Port)
	log.Fatal(r.Run(":" + c.Port))
}

func startNotificationCleanup(ctx context.Context, h *handlers.H) {
	go func() {
		h.CleanupOldNotifications(ctx)

		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				h.CleanupOldNotifications(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}
