package handlers

import (
	"encoding/json"
	"fmt"
	"freshcart/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"strconv"
	"strings"
	"time"
)

func (h *H) AdminSlotList(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,slot_date::text,start_time::text,end_time::text,max_orders,booked_orders,is_active FROM time_slots ORDER BY slot_date,start_time`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id, maxOrders, bookedOrders int
		var date, startTime, endTime string
		var active bool
		if e = rows.Scan(&id, &date, &startTime, &endTime, &maxOrders, &bookedOrders, &active); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": id, "date": date, "start_time": startTime, "end_time": endTime, "max_orders": maxOrders, "booked_orders": bookedOrders, "is_active": active})
	}
	c.JSON(200, out)
}
func (h *H) AdminPriceList(c *gin.Context) {
	settings, e := scanShippingSettings(h.DB.QueryRow(c, `SELECT minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled FROM shipping_settings WHERE id=1`))
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, []gin.H{shippingSettingsJSON(settings)})
}
func (h *H) AdminDashboard(c *gin.Context) {
	var orders, customers, products int
	var revenue float64
	h.DB.QueryRow(c, `SELECT COUNT(*) FROM orders`).Scan(&orders)
	h.DB.QueryRow(c, `SELECT COALESCE(SUM(total),0) FROM orders WHERE status<>'cancelled'`).Scan(&revenue)
	h.DB.QueryRow(c, `SELECT COUNT(*) FROM users WHERE role='customer'`).Scan(&customers)
	h.DB.QueryRow(c, `SELECT COUNT(*) FROM products WHERE is_active`).Scan(&products)
	c.JSON(200, gin.H{"orders": orders, "revenue": revenue, "customers": customers, "products": products})
}
func scanShippingSettings(row interface{ Scan(...any) error }) (services.ShippingSettings, error) {
	var settings services.ShippingSettings
	var tiersJSON []byte
	e := row.Scan(&settings.MinimumOrderAmount, &settings.ShippingFee, &tiersJSON, &settings.FreeShippingThreshold, &settings.Currency, &settings.FreeShippingEnabled)
	if e != nil {
		return settings, e
	}
	if len(tiersJSON) > 0 {
		e = json.Unmarshal(tiersJSON, &settings.ShippingTiers)
	}
	return settings, e
}
func shippingSettingsJSON(settings services.ShippingSettings) gin.H {
	return gin.H{"minimum_order_amount": settings.MinimumOrderAmount, "shipping_fee": settings.ShippingFee, "shipping_tiers": settings.ShippingTiers, "free_shipping_threshold": settings.FreeShippingThreshold, "currency": settings.Currency, "free_shipping_enabled": settings.FreeShippingEnabled}
}
func (h *H) ShippingSettings(c *gin.Context) {
	settings, e := scanShippingSettings(h.DB.QueryRow(c, `SELECT minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled FROM shipping_settings WHERE id=1`))
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, shippingSettingsJSON(settings))
}
func (h *H) AdminShippingSettings(c *gin.Context) {
	settings, e := scanShippingSettings(h.DB.QueryRow(c, `SELECT minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled FROM shipping_settings WHERE id=1`))
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, shippingSettingsJSON(settings))
}
func (h *H) AdminUpdateShippingSettings(c *gin.Context) {
	var x struct {
		MinimumOrderAmount    float64                 `json:"minimum_order_amount"`
		ShippingFee           float64                 `json:"shipping_fee"`
		ShippingTiers         []services.ShippingTier `json:"shipping_tiers"`
		FreeShippingThreshold float64                 `json:"free_shipping_threshold"`
		Currency              string                  `json:"currency"`
		FreeShippingEnabled   bool                    `json:"free_shipping_enabled"`
	}
	if c.ShouldBindJSON(&x) != nil || x.MinimumOrderAmount < 0 || x.ShippingFee < 0 || x.FreeShippingThreshold < 0 || strings.TrimSpace(x.Currency) == "" || !validShippingTiers(x.ShippingTiers, x.MinimumOrderAmount) {
		err(c, 400, fmt.Errorf("valid shipping settings are required"))
		return
	}
	x.Currency = strings.ToUpper(strings.TrimSpace(x.Currency))
	if x.FreeShippingEnabled && x.FreeShippingThreshold < x.MinimumOrderAmount {
		err(c, 400, fmt.Errorf("free shipping threshold must be at least the minimum order amount"))
		return
	}
	tiersJSON, _ := json.Marshal(x.ShippingTiers)
	_, e := h.DB.Exec(c, `UPDATE shipping_settings SET minimum_order_amount=$1,shipping_fee=$2,shipping_tiers=$3::jsonb,free_shipping_threshold=$4,currency=$5,free_shipping_enabled=$6,updated_by=$7,updated_at=now() WHERE id=1`, x.MinimumOrderAmount, x.ShippingFee, string(tiersJSON), x.FreeShippingThreshold, x.Currency, x.FreeShippingEnabled, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"success": true, "message": "Shipping settings updated successfully.", "settings": shippingSettingsJSON(services.ShippingSettings{MinimumOrderAmount: x.MinimumOrderAmount, ShippingFee: x.ShippingFee, ShippingTiers: x.ShippingTiers, FreeShippingThreshold: x.FreeShippingThreshold, Currency: x.Currency, FreeShippingEnabled: x.FreeShippingEnabled})})
}
func validShippingTiers(tiers []services.ShippingTier, minimumOrder float64) bool {
	if len(tiers) == 0 || tiers[0].MinAmount != minimumOrder {
		return false
	}
	for i, tier := range tiers {
		if tier.MinAmount < minimumOrder || tier.Fee < 0 || (tier.MaxAmount != 0 && tier.MaxAmount <= tier.MinAmount) {
			return false
		}
		if i < len(tiers)-1 && (tier.MaxAmount == 0 || tier.MaxAmount != tiers[i+1].MinAmount) {
			return false
		}
		if i == len(tiers)-1 && tier.MaxAmount != 0 {
			return false
		}
	}
	return true
}
func (h *H) AdminOrders(c *gin.Context) {
	query := `SELECT o.id,o.order_number,o.user_id,o.rider_id,o.delivery_address,o.delivery_date::text,o.time_slot_id,s.start_time::text,s.end_time::text,o.payment_method,o.status,o.subtotal,o.shipping,o.total,COALESCE(r.name,''),COALESCE(u.name,''),COALESCE(u.email,'') FROM orders o JOIN time_slots s ON s.id=o.time_slot_id JOIN users u ON u.id=o.user_id LEFT JOIN users r ON r.id=o.rider_id WHERE 1=1`
	args := []any{}
	add := func(condition string, value any) {
		query += fmt.Sprintf(" AND %s", condition)
		args = append(args, value)
	}
	if value := strings.TrimSpace(c.Query("date")); value != "" {
		add(fmt.Sprintf("o.delivery_date=$%d", len(args)+1), value)
	}
	if value := strings.TrimSpace(c.Query("slot_id")); value != "" {
		add(fmt.Sprintf("o.time_slot_id=$%d", len(args)+1), value)
	}
	if value := strings.TrimSpace(c.Query("rider_id")); value != "" {
		add(fmt.Sprintf("o.rider_id=$%d", len(args)+1), value)
	}
	if value := strings.TrimSpace(c.Query("status")); value != "" {
		add(fmt.Sprintf("o.status=$%d", len(args)+1), value)
	}
	if value := strings.TrimSpace(c.Query("customer")); value != "" {
		add(fmt.Sprintf("(u.name ILIKE $%d OR u.email ILIKE $%d OR o.order_number ILIKE $%d)", len(args)+1, len(args)+1, len(args)+1), "%"+value+"%")
	}
	query += ` ORDER BY o.delivery_date DESC,s.start_time,o.created_at DESC`
	rows, e := h.DB.Query(c, query, args...)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var oid, uid int64
		var rid *int64
		var num, addr, date, slotStart, slotEnd, pm, st, riderName, customerName, customerEmail string
		var slotID int64
		var sub, ship, total float64
		if e = rows.Scan(&oid, &num, &uid, &rid, &addr, &date, &slotID, &slotStart, &slotEnd, &pm, &st, &sub, &ship, &total, &riderName, &customerName, &customerEmail); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": oid, "order_number": num, "user_id": uid, "customer_name": customerName, "customer_email": customerEmail, "rider_id": rid, "rider_name": riderName, "delivery_address": addr, "delivery_date": date, "time_slot_id": slotID, "slot_start_time": slotStart, "slot_end_time": slotEnd, "payment_method": pm, "status": st, "subtotal": sub, "shipping": ship, "total": total})
	}
	c.JSON(200, out)
}
func (h *H) AdminOrderStatus(c *gin.Context) {
	oid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var x struct {
		Status string `json:"status"`
	}
	c.ShouldBindJSON(&x)
	ok := false
	for _, s := range []string{"pending", "confirmed", "preparing", "assigned", "out_for_delivery", "delivered", "cancelled"} {
		if x.Status == s {
			ok = true
		}
	}
	if !ok {
		err(c, 400, fmt.Errorf("invalid status"))
		return
	}
	if x.Status == "delivered" {
		var proofCount int
		if e := h.DB.QueryRow(c, `SELECT COUNT(*) FROM delivery_proofs WHERE order_id=$1`, oid).Scan(&proofCount); e != nil {
			err(c, 500, e)
			return
		}
		if proofCount == 0 {
			err(c, 400, fmt.Errorf("delivery proof photo is required before marking delivered"))
			return
		}
	}
	var userID int64
	var orderNumber, previousStatus string
	e := h.DB.QueryRow(c, `SELECT user_id,order_number,status FROM orders WHERE id=$1`, oid).Scan(&userID, &orderNumber, &previousStatus)
	if e != nil {
		err(c, 404, fmt.Errorf("order not found"))
		return
	}
	_, e = h.DB.Exec(c, `UPDATE orders SET status=$1,updated_at=now() WHERE id=$2`, x.Status, oid)
	if e != nil {
		err(c, 500, e)
		return
	}
	if x.Status == "delivered" && previousStatus != "delivered" {
		data := map[string]any{"order_id": oid, "order_number": orderNumber, "type": "order_delivered"}
		message := fmt.Sprintf("Your FreshCart order %s (ID: %d) has been delivered successfully.", orderNumber, oid)
		_ = h.insertNotification(c, userID, "Order Delivered", message, "order_delivered", data)
		_ = sendPush(h.pushTokensForUser(c, userID), "Order Delivered", message, data)
	}
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) AdminRiders(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT u.id,u.name,u.email,COALESCE(u.phone,''),u.is_active,COALESCE(r.vehicle_type,r.vehicle,''),COALESCE(r.vehicle_number,''),COALESCE(r.is_available,true),COUNT(o.id) FILTER (WHERE o.status IN ('assigned','out_for_delivery')) FROM users u JOIN riders r ON r.user_id=u.id LEFT JOIN orders o ON o.rider_id=u.id WHERE u.role='rider' GROUP BY u.id,r.id ORDER BY u.name`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var i int64
		var n, em, ph, vehicleType, vehicleNumber string
		var a, av bool
		var activeOrders int
		rows.Scan(&i, &n, &em, &ph, &a, &vehicleType, &vehicleNumber, &av, &activeOrders)
		out = append(out, gin.H{"id": i, "name": n, "email": em, "phone": ph, "is_active": a, "vehicle_type": vehicleType, "vehicle_number": vehicleNumber, "vehicle": vehicleType, "is_available": av, "active_orders": activeOrders})
	}
	c.JSON(200, out)
}
func (h *H) AdminAddRider(c *gin.Context) {
	var x struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		Phone         string `json:"phone"`
		Password      string `json:"password"`
		VehicleType   string `json:"vehicle_type"`
		Vehicle       string `json:"vehicle"`
		VehicleNumber string `json:"vehicle_number"`
		IsActive      bool   `json:"is_active"`
		IsAvailable   bool   `json:"is_available"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("valid rider data required"))
		return
	}
	x.Name = strings.TrimSpace(x.Name)
	x.Email = strings.ToLower(strings.TrimSpace(x.Email))
	x.Phone = strings.TrimSpace(x.Phone)
	x.VehicleType = strings.TrimSpace(x.VehicleType)
	if x.VehicleType == "" {
		x.VehicleType = strings.TrimSpace(x.Vehicle)
	}
	x.VehicleNumber = strings.TrimSpace(x.VehicleNumber)
	if x.Name == "" || !strings.Contains(x.Email, "@") || len(x.Password) < 8 {
		err(c, 400, fmt.Errorf("valid rider data required"))
		return
	}
	if !x.IsActive {
		x.IsActive = true
	}
	ph, _ := bcrypt.GenerateFromPassword([]byte(x.Password), bcrypt.DefaultCost)
	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer tx.Rollback(c)
	var uid int64
	e = tx.QueryRow(c, `INSERT INTO users(name,email,phone,password_hash,role,is_active) VALUES($1,$2,$3,$4,'rider',$5) RETURNING id`, x.Name, x.Email, x.Phone, string(ph), x.IsActive).Scan(&uid)
	if e != nil {
		err(c, 409, e)
		return
	}
	if _, e = tx.Exec(c, `INSERT INTO riders(user_id,vehicle,vehicle_type,vehicle_number,is_available) VALUES($1,$2,$3,$4,$5)`, uid, x.VehicleType, x.VehicleType, x.VehicleNumber, x.IsAvailable); e != nil {
		err(c, 500, e)
		return
	}
	tx.Commit(c)
	c.JSON(201, gin.H{"id": uid})
}
func (h *H) AdminUpdateRider(c *gin.Context) {
	uid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var x struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		Phone         string `json:"phone"`
		Password      string `json:"password"`
		VehicleType   string `json:"vehicle_type"`
		VehicleNumber string `json:"vehicle_number"`
		IsActive      bool   `json:"is_active"`
		IsAvailable   bool   `json:"is_available"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	if strings.TrimSpace(x.Name) == "" || !strings.Contains(x.Email, "@") {
		err(c, 400, fmt.Errorf("valid rider data required"))
		return
	}
	result, e := h.DB.Exec(c, `UPDATE users SET name=$1,email=$2,phone=$3,is_active=$4,updated_at=now() WHERE id=$5 AND role='rider'`, strings.TrimSpace(x.Name), strings.ToLower(strings.TrimSpace(x.Email)), strings.TrimSpace(x.Phone), x.IsActive, uid)
	if e != nil {
		err(c, 409, fmt.Errorf("rider email may already be registered"))
		return
	}
	if result.RowsAffected() == 0 {
		err(c, 404, fmt.Errorf("rider not found"))
		return
	}
	if x.Password != "" {
		if len(x.Password) < 8 {
			err(c, 400, fmt.Errorf("password must be at least 8 characters"))
			return
		}
		hash, _ := bcrypt.GenerateFromPassword([]byte(x.Password), bcrypt.DefaultCost)
		if _, e = h.DB.Exec(c, `UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2`, string(hash), uid); e != nil {
			err(c, 500, e)
			return
		}
	}
	if _, e = h.DB.Exec(c, `UPDATE riders SET vehicle=$1,vehicle_type=$2,vehicle_number=$3,is_available=$4 WHERE user_id=$5`, x.VehicleType, x.VehicleType, x.VehicleNumber, x.IsAvailable, uid); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) AdminDeleteRider(c *gin.Context) {
	uid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	result, e := h.DB.Exec(c, `UPDATE users SET is_active=false,updated_at=now() WHERE id=$1 AND role='rider'`, uid)
	if e != nil {
		err(c, 500, e)
		return
	}
	if result.RowsAffected() == 0 {
		err(c, 404, fmt.Errorf("rider not found"))
		return
	}
	h.DB.Exec(c, `UPDATE riders SET is_available=false WHERE user_id=$1`, uid)
	c.Status(204)
}
func (h *H) AdminAssign(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	var x struct {
		RiderID int64 `json:"rider_id"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("rider_id required"))
		return
	}
	var slotID int64
	var orderNumber string
	if e = h.DB.QueryRow(c, `SELECT time_slot_id,order_number FROM orders WHERE id=$1 AND status NOT IN ('delivered','cancelled')`, oid).Scan(&slotID, &orderNumber); e != nil {
		err(c, 404, fmt.Errorf("order not found or already closed"))
		return
	}
	var eligible bool
	e = h.DB.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM users u JOIN riders r ON r.user_id=u.id JOIN rider_time_slots rts ON rts.rider_id=u.id WHERE u.id=$1 AND u.role='rider' AND u.is_active=true AND r.is_available=true AND rts.time_slot_id=$2)`, x.RiderID, slotID).Scan(&eligible)
	if e != nil {
		err(c, 500, e)
		return
	}
	if !eligible {
		err(c, 409, fmt.Errorf("rider is not eligible for this delivery slot"))
		return
	}
	_, e = h.DB.Exec(c, `UPDATE orders SET rider_id=$1,status=CASE WHEN status IN ('pending','confirmed','preparing') THEN 'assigned' ELSE status END,updated_at=now() WHERE id=$2`, x.RiderID, oid)
	if e != nil {
		err(c, 500, e)
		return
	}
	h.notifyRiderAssignment(c, x.RiderID, oid)
	_ = orderNumber
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) AdminEligibleRiders(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	var slotID int64
	if e = h.DB.QueryRow(c, `SELECT time_slot_id FROM orders WHERE id=$1`, oid).Scan(&slotID); e != nil {
		err(c, 404, fmt.Errorf("order not found"))
		return
	}
	rows, e := h.DB.Query(c, `SELECT u.id,u.name,COALESCE(u.phone,''),COALESCE(r.vehicle_type,r.vehicle,''),COALESCE(r.vehicle_number,''),COUNT(o.id) FILTER (WHERE o.status IN ('assigned','out_for_delivery')) FROM users u JOIN riders r ON r.user_id=u.id JOIN rider_time_slots rts ON rts.rider_id=u.id AND rts.time_slot_id=$1 LEFT JOIN orders o ON o.rider_id=u.id WHERE u.role='rider' AND u.is_active=true AND r.is_available=true GROUP BY u.id,r.id ORDER BY COUNT(o.id) FILTER (WHERE o.status IN ('assigned','out_for_delivery')),u.name`, slotID)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var riderID, activeOrders int64
		var name, phone, vehicleType, vehicleNumber string
		if e = rows.Scan(&riderID, &name, &phone, &vehicleType, &vehicleNumber, &activeOrders); e == nil {
			out = append(out, gin.H{"id": riderID, "name": name, "phone": phone, "vehicle_type": vehicleType, "vehicle_number": vehicleNumber, "active_orders": activeOrders})
		}
	}
	c.JSON(200, out)
}
func (h *H) AdminRiderSlots(c *gin.Context) {
	riderID, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	date := strings.TrimSpace(c.Query("date"))
	query := `SELECT s.id,s.slot_date::text,s.start_time::text,s.end_time::text,s.is_active,(rts.id IS NOT NULL) FROM time_slots s LEFT JOIN rider_time_slots rts ON rts.time_slot_id=s.id AND rts.rider_id=$1`
	args := []any{riderID}
	if date != "" {
		query += ` WHERE s.slot_date=$2`
		args = append(args, date)
	}
	query += ` ORDER BY s.slot_date,s.start_time`
	rows, e := h.DB.Query(c, query, args...)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var slotID int64
		var date, start, end string
		var active, assigned bool
		if rows.Scan(&slotID, &date, &start, &end, &active, &assigned) == nil {
			out = append(out, gin.H{"id": slotID, "slot_date": date, "start_time": start, "end_time": end, "is_active": active, "assigned": assigned})
		}
	}
	c.JSON(200, out)
}
func (h *H) AdminSlotAvailability(c *gin.Context) {
	date := strings.TrimSpace(c.Query("date"))
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	rows, e := h.DB.Query(c, `SELECT s.id,s.slot_date::text,s.start_time::text,s.end_time::text,s.is_active,rts.rider_id,COALESCE(u.name,'') FROM time_slots s LEFT JOIN rider_time_slots rts ON rts.time_slot_id=s.id LEFT JOIN users u ON u.id=rts.rider_id WHERE s.slot_date=$1 ORDER BY s.start_time`, date)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var slotID int64
		var slotDate, start, end, riderName string
		var active bool
		var riderID *int64
		if e = rows.Scan(&slotID, &slotDate, &start, &end, &active, &riderID, &riderName); e != nil {
			err(c, 500, e)
			return
		}
		var assigned any
		if riderID != nil {
			assigned = gin.H{"id": *riderID, "name": riderName}
		}
		out = append(out, gin.H{"slot_id": slotID, "slot_date": slotDate, "start_time": start, "end_time": end, "is_active": active, "time": fmt.Sprintf("%s - %s", displaySlotTime(start), displaySlotTime(end)), "available": active && riderID == nil, "assigned_rider": assigned})
	}
	c.JSON(200, out)
}
func (h *H) AdminAssignSlot(c *gin.Context) {
	riderID, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	var x struct {
		TimeSlotID int64 `json:"time_slot_id"`
	}
	if c.ShouldBindJSON(&x) != nil || x.TimeSlotID < 1 {
		err(c, 400, fmt.Errorf("time_slot_id required"))
		return
	}
	var valid bool
	if e = h.DB.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM users u JOIN riders r ON r.user_id=u.id WHERE u.id=$1 AND u.role='rider' AND u.is_active=true) AND EXISTS(SELECT 1 FROM time_slots WHERE id=$2 AND is_active=true)`, riderID, x.TimeSlotID).Scan(&valid); e != nil {
		err(c, 500, e)
		return
	}
	if !valid {
		err(c, 409, fmt.Errorf("rider must be active and the time slot must be active"))
		return
	}
	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer tx.Rollback(c)
	if _, e = tx.Exec(c, `SELECT id FROM time_slots WHERE id=$1 FOR UPDATE`, x.TimeSlotID); e != nil {
		err(c, 500, e)
		return
	}
	var assigned bool
	var assignedRider string
	if e = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM rider_time_slots rts WHERE rts.rider_id=$1 AND rts.time_slot_id=$2), COALESCE((SELECT u.name FROM rider_time_slots rts JOIN users u ON u.id=rts.rider_id WHERE rts.time_slot_id=$2 AND rts.rider_id<>$1 LIMIT 1),'')`, riderID, x.TimeSlotID).Scan(&assigned, &assignedRider); e != nil {
		err(c, 500, e)
		return
	}
	if assignedRider != "" {
		var assignedRiderID int64
		var start, end string
		if e = tx.QueryRow(c, `SELECT rts.rider_id,s.start_time::text,s.end_time::text FROM rider_time_slots rts JOIN time_slots s ON s.id=rts.time_slot_id JOIN users u ON u.id=rts.rider_id WHERE rts.time_slot_id=$1 AND rts.rider_id<>$2 LIMIT 1`, x.TimeSlotID, riderID).Scan(&assignedRiderID, &start, &end); e != nil {
			err(c, 500, e)
			return
		}
		slotConflict(c, x.TimeSlotID, assignedRiderID, start, end, assignedRider)
		return
	}
	if assigned {
		err(c, 409, fmt.Errorf("this time slot is already assigned to this rider"))
		return
	}
	result, e := tx.Exec(c, `INSERT INTO rider_time_slots(rider_id,time_slot_id) VALUES($1,$2) ON CONFLICT(rider_id,time_slot_id) DO NOTHING`, riderID, x.TimeSlotID)
	if e != nil {
		err(c, 500, e)
		return
	}
	if result.RowsAffected() == 0 {
		err(c, 409, fmt.Errorf("this time slot is already assigned to this rider"))
		return
	}
	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(201, gin.H{"ok": true})
}
func (h *H) AdminSetRiderSlots(c *gin.Context) {
	riderID, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	var x struct {
		TimeSlotIDs []int64 `json:"time_slot_ids"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("time_slot_ids required"))
		return
	}
	seen := map[int64]bool{}
	date := strings.TrimSpace(c.Query("date"))
	if date != "" {
		if _, e = time.Parse("2006-01-02", date); e != nil {
			err(c, 400, fmt.Errorf("invalid assignment date"))
			return
		}
	}
	for _, slotID := range x.TimeSlotIDs {
		if slotID < 1 {
			err(c, 400, fmt.Errorf("invalid time slot"))
			return
		}
		if seen[slotID] {
			err(c, 409, fmt.Errorf("duplicate time slot assignment"))
			return
		}
		seen[slotID] = true
	}
	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer tx.Rollback(c)
	var active bool
	if e = tx.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM users u JOIN riders r ON r.user_id=u.id WHERE u.id=$1 AND u.role='rider' AND u.is_active=true)`, riderID).Scan(&active); e != nil || !active {
		err(c, 409, fmt.Errorf("rider must be active"))
		return
	}
	if len(x.TimeSlotIDs) > 0 {
		if _, e = tx.Exec(c, `SELECT id FROM time_slots WHERE id=ANY($1) FOR UPDATE`, x.TimeSlotIDs); e != nil {
			err(c, 500, e)
			return
		}
		var assignedRider string
		var assignedRiderID, assignedSlotID int64
		var assignedStart, assignedEnd string
		if e = tx.QueryRow(c, `SELECT s.id,rts.rider_id,s.start_time::text,s.end_time::text,u.name FROM rider_time_slots rts JOIN time_slots s ON s.id=rts.time_slot_id JOIN users u ON u.id=rts.rider_id WHERE rts.time_slot_id=ANY($1) AND rts.rider_id<>$2 LIMIT 1`, x.TimeSlotIDs, riderID).Scan(&assignedSlotID, &assignedRiderID, &assignedStart, &assignedEnd, &assignedRider); e == nil {
			slotConflict(c, assignedSlotID, assignedRiderID, assignedStart, assignedEnd, assignedRider)
			return
		}
		if e != pgx.ErrNoRows {
			err(c, 500, e)
			return
		}
		var inactive int
		query := `SELECT COUNT(*) FROM time_slots WHERE id=ANY($1) AND (is_active=false`
		args := []any{x.TimeSlotIDs}
		if date != "" {
			query += ` OR slot_date<>$2`
			args = append(args, date)
		}
		query += `)`
		if e = tx.QueryRow(c, query, args...).Scan(&inactive); e != nil {
			err(c, 500, e)
			return
		}
		if inactive > 0 {
			err(c, 409, fmt.Errorf("inactive time slots cannot be assigned"))
			return
		}
	}
	deleteQuery := `DELETE FROM rider_time_slots WHERE rider_id=$1`
	deleteArgs := []any{riderID}
	if date != "" {
		deleteQuery += ` AND time_slot_id IN (SELECT id FROM time_slots WHERE slot_date=$2)`
		deleteArgs = append(deleteArgs, date)
	}
	if _, e = tx.Exec(c, deleteQuery, deleteArgs...); e != nil {
		err(c, 500, e)
		return
	}
	for _, slotID := range x.TimeSlotIDs {
		if _, e = tx.Exec(c, `INSERT INTO rider_time_slots(rider_id,time_slot_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, riderID, slotID); e != nil {
			err(c, 500, e)
			return
		}
	}
	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"ok": true, "assigned": len(x.TimeSlotIDs)})
}
func (h *H) AdminRemoveSlot(c *gin.Context) {
	riderID, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid rider"))
		return
	}
	slotID, e := strconv.ParseInt(c.Param("slotID"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid time slot"))
		return
	}
	h.DB.Exec(c, `DELETE FROM rider_time_slots WHERE rider_id=$1 AND time_slot_id=$2`, riderID, slotID)
	c.Status(204)
}
func (h *H) notifyRiderAssignment(c *gin.Context, riderID, orderID int64) {
	var orderNumber string
	var total float64
	var slotDate, slotStart, slotEnd string
	if h.DB.QueryRow(c, `SELECT o.order_number,o.total,o.delivery_date::text,s.start_time::text,s.end_time::text FROM orders o JOIN time_slots s ON s.id=o.time_slot_id WHERE o.id=$1`, orderID).Scan(&orderNumber, &total, &slotDate, &slotStart, &slotEnd) != nil {
		return
	}
	data := map[string]any{"order_id": orderID, "order_number": orderNumber, "total": total, "delivery_date": slotDate, "slot_start_time": slotStart, "slot_end_time": slotEnd, "type": "order_assigned"}
	message := fmt.Sprintf("Order %s has been assigned to you for %s %s-%s.", orderNumber, slotDate, slotStart, slotEnd)
	_ = h.insertNotification(c, riderID, "New Order Assigned", message, "order_assigned", data)
	_ = sendPush(h.pushTokensForUser(c, riderID), "New Order Assigned", message, data)
}
func (h *H) AdminSlot(c *gin.Context) {
	var x struct {
		SlotDate  string `json:"slot_date"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
		MaxOrders int    `json:"max_orders"`
		IsActive  bool   `json:"is_active"`
	}

	if c.ShouldBindJSON(&x) != nil || x.MaxOrders < 1 {
		err(c, 400, fmt.Errorf("invalid slot"))
		return
	}

	// Validate date.
	if _, dateErr := time.Parse("2006-01-02", x.SlotDate); dateErr != nil {
		err(c, 400, fmt.Errorf("invalid slot date"))
		return
	}

	// Validate start/end time.
	start, startErr := time.Parse("15:04", x.StartTime)
	end, endErr := time.Parse("15:04", x.EndTime)

	if startErr != nil || endErr != nil {
		err(c, 400, fmt.Errorf("invalid slot time"))
		return
	}

	/*
		Calculate duration.

		Normal:
		13:00 -> 15:00 = 2 hours

		Midnight:
		23:00 -> 01:00 = 2 hours
	*/
	duration := end.Sub(start)

	if duration < 0 {
		duration += 24 * time.Hour
	}

	/*
		Only allow:
		1 hour
		2 hours
		3 hours
	*/
	if duration != time.Hour &&
		duration != 2*time.Hour &&
		duration != 3*time.Hour {
		err(c, 400, fmt.Errorf(
			"delivery time slots must be exactly 1, 2, or 3 hours",
		))
		return
	}

	var sid int

	e := h.DB.QueryRow(
		c,
		`INSERT INTO time_slots
			(slot_date, start_time, end_time, max_orders, is_active)
		 VALUES
			($1, $2, $3, $4, $5)
		 RETURNING id`,
		x.SlotDate,
		x.StartTime,
		x.EndTime,
		x.MaxOrders,
		x.IsActive,
	).Scan(&sid)

	if e != nil {
		err(
			c,
			409,
			fmt.Errorf(
				"a time slot with the same date and time already exists",
			),
		)
		return
	}

	c.JSON(201, gin.H{
		"id": sid,
	})
}
func (h *H) AdminUpdateSlot(c *gin.Context) {
	sid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid time slot"))
		return
	}

	var x struct {
		SlotDate  string `json:"slot_date"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
		MaxOrders int    `json:"max_orders"`
		IsActive  bool   `json:"is_active"`
	}

	// Validate request
	if c.ShouldBindJSON(&x) != nil ||
		x.SlotDate == "" ||
		x.StartTime == "" ||
		x.EndTime == "" ||
		x.MaxOrders < 1 {
		err(c, 400, fmt.Errorf("invalid slot"))
		return
	}

	// Validate date
	if _, dateErr := time.Parse("2006-01-02", x.SlotDate); dateErr != nil {
		err(c, 400, fmt.Errorf("invalid slot date"))
		return
	}

	// Validate start time
	start, startErr := time.Parse("15:04", x.StartTime)
	if startErr != nil {
		err(c, 400, fmt.Errorf("invalid start time"))
		return
	}

	// Validate end time
	end, endErr := time.Parse("15:04", x.EndTime)
	if endErr != nil {
		err(c, 400, fmt.Errorf("invalid end time"))
		return
	}

	// Calculate duration
	duration := end.Sub(start)

	// Support slots crossing midnight.
	// Example:
	// 23:00 -> 01:00 = 2 hours
	if duration < 0 {
		duration += 24 * time.Hour
	}

	// Allow ONLY:
	// 1 hour
	// 2 hours
	// 3 hours
	if duration != time.Hour &&
		duration != 2*time.Hour &&
		duration != 3*time.Hour {
		err(
			c,
			400,
			fmt.Errorf(
				"delivery time slots must be exactly 1, 2, or 3 hours",
			),
		)
		return
	}

	// Get current booked orders
	var booked int

	e = h.DB.QueryRow(
		c,
		`
		SELECT booked_orders
		FROM time_slots
		WHERE id=$1
		`,
		sid,
	).Scan(&booked)

	if e != nil {
		err(c, 404, fmt.Errorf("time slot not found"))
		return
	}

	// Do not allow capacity below already booked orders
	if x.MaxOrders < booked {
		err(
			c,
			409,
			fmt.Errorf(
				"capacity cannot be lower than current booked orders",
			),
		)
		return
	}

	// Update slot
	result, e := h.DB.Exec(
		c,
		`
		UPDATE time_slots
		SET
			slot_date=$1,
			start_time=$2,
			end_time=$3,
			max_orders=$4,
			is_active=$5
		WHERE id=$6
		`,
		x.SlotDate,
		x.StartTime,
		x.EndTime,
		x.MaxOrders,
		x.IsActive,
		sid,
	)

	if e != nil {
		err(
			c,
			409,
			fmt.Errorf(
				"time slot conflicts with an existing slot or is invalid",
			),
		)
		return
	}

	if result.RowsAffected() == 0 {
		err(c, 404, fmt.Errorf("time slot not found"))
		return
	}

	c.JSON(200, gin.H{
		"ok":            true,
		"id":            sid,
		"slot_date":     x.SlotDate,
		"start_time":    x.StartTime,
		"end_time":      x.EndTime,
		"max_orders":    x.MaxOrders,
		"is_active":     x.IsActive,
		"booked_orders": booked,
	})
}
func (h *H) AdminDeleteSlot(c *gin.Context) {
	sid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid time slot"))
		return
	}
	var booked int
	if e = h.DB.QueryRow(c, `SELECT booked_orders FROM time_slots WHERE id=$1`, sid).Scan(&booked); e != nil {
		err(c, 404, fmt.Errorf("time slot not found"))
		return
	}
	if booked > 0 {
		err(c, 409, fmt.Errorf("cannot delete a time slot with booked orders; deactivate it instead"))
		return
	}
	if _, e = h.DB.Exec(c, `DELETE FROM time_slots WHERE id=$1`, sid); e != nil {
		err(c, 500, e)
		return
	}
	c.Status(204)
}
