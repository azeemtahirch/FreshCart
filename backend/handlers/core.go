package handlers

import (
	"fmt"
	"freshcart/backend/config"
	"freshcart/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"time"
)

type H struct {
	DB *pgxpool.Pool
	C  config.Config
	J  *services.JazzCash
}

func New(db *pgxpool.Pool, c config.Config) *H { return &H{db, c, services.NewJazzCash(c)} }
func err(c *gin.Context, s int, e error)       { c.JSON(s, gin.H{"error": e.Error()}) }
func id(c *gin.Context) int64                  { v, _ := c.Get("user_id"); return v.(int64) }
func slotConflict(c *gin.Context, slotID, riderID int64, start, end, riderName string) {
	message := fmt.Sprintf("Time slot %s - %s is already assigned to Rider %s.", displaySlotTime(start), displaySlotTime(end), riderName)
	c.JSON(409, gin.H{"success": false, "message": message, "slot_id": slotID, "assigned_rider_id": riderID, "assigned_rider_name": riderName, "error": message})
}
func displaySlotTime(value string) string {
	parsed, e := time.Parse("15:04:05", strings.TrimSpace(value))
	if e != nil {
		parsed, e = time.Parse("15:04", strings.TrimSpace(value))
	}
	if e != nil {
		return strings.TrimSuffix(strings.TrimSuffix(value, ":00"), ":00")
	}
	return parsed.Format("3:04 PM")
}
func (h *H) Health(c *gin.Context) { c.JSON(200, gin.H{"ok": true, "service": "FreshCart API"}) }
func (h *H) Area(c *gin.Context) {
	c.JSON(200, gin.H{"city": "Worldwide", "country": "Worldwide", "polygon": []any{}, "message": "FreshCart is available worldwide. Delivery availability depends on configured delivery slots and service operations."})
}
