package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"os"
	"path/filepath"
	"strconv"
)

func (h *H) RiderOrders(c *gin.Context) {
	rows, e := h.DB.Query(c, `
		SELECT
			o.id,
			o.order_number,
			o.user_id,
			o.rider_id,
			o.delivery_address,
			o.delivery_latitude,
			o.delivery_longitude,
			o.delivery_date::text,
			o.time_slot_id,
			o.payment_method,
			o.status,
			o.subtotal,
			o.shipping,
			o.total,
			u.name,
			COALESCE(u.phone, ''),
			COALESCE(sc.name, a.city, ''),
			COALESCE(sa.name, ''),
			s.start_time::text,
			s.end_time::text
		FROM orders o
		JOIN users u ON u.id = o.user_id
		JOIN time_slots s ON s.id = o.time_slot_id
		LEFT JOIN addresses a ON a.id = o.address_id
		LEFT JOIN shipping_cities sc ON sc.id = a.city_id
		LEFT JOIN shipping_areas sa ON sa.id = a.area_id
		WHERE o.rider_id = $1
		ORDER BY o.delivery_date, s.start_time, o.created_at DESC`, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var oid, uid, slot int64
		var rid *int64
		var num, addr, dd, pm, st, customerName, customerPhone, deliveryCity, deliveryArea, slotStart, slotEnd string
		var lat, lng, sub, ship, total float64
		rows.Scan(&oid, &num, &uid, &rid, &addr, &lat, &lng, &dd, &slot, &pm, &st, &sub, &ship, &total, &customerName, &customerPhone, &deliveryCity, &deliveryArea, &slotStart, &slotEnd)
		out = append(out, gin.H{"id": oid, "order_number": num, "user_id": uid, "rider_id": rid, "customer_name": customerName, "customer_phone": customerPhone, "delivery_address": addr, "delivery_city": deliveryCity, "delivery_area": deliveryArea, "delivery_latitude": lat, "delivery_longitude": lng, "delivery_date": dd, "time_slot_id": slot, "slot_start_time": slotStart, "slot_end_time": slotEnd, "payment_method": pm, "status": st, "subtotal": sub, "shipping": ship, "total": total})
	}
	c.JSON(200, out)
}
func (h *H) RiderStart(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	result, e := h.DB.Exec(c, `UPDATE orders SET status='out_for_delivery',updated_at=now() WHERE id=$1 AND rider_id=$2 AND status IN('assigned','confirmed','preparing')`, oid, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	if result.RowsAffected() == 0 {
		err(c, 409, fmt.Errorf("order is not assigned to you or cannot start delivery"))
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) RiderStatus(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	var x struct {
		Status string `json:"status"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("status required"))
		return
	}
	allowed := map[string]bool{"accepted": true, "preparing": true, "out_for_delivery": true, "failed": true}
	if !allowed[x.Status] {
		err(c, 400, fmt.Errorf("rider cannot set this status"))
		return
	}
	var current string
	if e = h.DB.QueryRow(c, `SELECT status FROM orders WHERE id=$1 AND rider_id=$2`, oid, id(c)).Scan(&current); e != nil {
		err(c, 404, fmt.Errorf("assigned order not found"))
		return
	}
	valid := (current == "assigned" && x.Status == "accepted") || (current == "accepted" && x.Status == "preparing") || (current == "preparing" && x.Status == "out_for_delivery") || (current == "out_for_delivery" && x.Status == "failed")
	if !valid {
		err(c, 409, fmt.Errorf("invalid status transition from %s to %s", current, x.Status))
		return
	}
	if _, e = h.DB.Exec(c, `UPDATE orders SET status=$1,updated_at=now() WHERE id=$2 AND rider_id=$3`, x.Status, oid, id(c)); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"ok": true, "status": x.Status})
}
func (h *H) RiderPhoto(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	var orderStatus string
	if e = h.DB.QueryRow(c, `SELECT status FROM orders WHERE id=$1 AND rider_id=$2`, oid, id(c)).Scan(&orderStatus); e != nil {
		err(c, 404, fmt.Errorf("assigned order not found"))
		return
	}
	if orderStatus != "out_for_delivery" {
		err(c, 409, fmt.Errorf("start delivery before uploading proof"))
		return
	}
	f, e := c.FormFile("photo")
	if e != nil {
		err(c, 400, fmt.Errorf("photo required"))
		return
	}
	os.MkdirAll(h.C.UploadDir, 0755)
	name := uuid.NewString() + filepath.Ext(f.Filename)
	path := filepath.Join(h.C.UploadDir, name)
	if e = c.SaveUploadedFile(f, path); e != nil {
		err(c, 500, e)
		return
	}
	url := h.C.PublicBaseURL + "/uploads/" + name
	_, e = h.DB.Exec(c, `INSERT INTO delivery_proofs(order_id,rider_id,file_url) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET file_url=excluded.file_url,rider_id=excluded.rider_id,captured_at=now()`, oid, id(c), url)
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(201, gin.H{"file_url": url})
}
func (h *H) RiderComplete(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid order"))
		return
	}
	var n int
	e = h.DB.QueryRow(c, `SELECT COUNT(*) FROM delivery_proofs p JOIN orders o ON o.id=p.order_id WHERE p.order_id=$1 AND p.rider_id=$2 AND o.rider_id=$2 AND o.status='out_for_delivery'`, oid, id(c)).Scan(&n)
	if e != nil {
		err(c, 500, e)
		return
	}
	if n == 0 {
		err(c, 400, fmt.Errorf("delivery proof photo is required"))
		return
	}
	var userID int64
	e = h.DB.QueryRow(c, `UPDATE orders SET status='delivered',updated_at=now() WHERE id=$1 AND rider_id=$2 AND status='out_for_delivery' RETURNING user_id`, oid, id(c)).Scan(&userID)
	if e != nil {
		err(c, 409, fmt.Errorf("order is not ready to be completed"))
		return
	}
	var orderNumber string
	_ = h.DB.QueryRow(c, `SELECT order_number FROM orders WHERE id=$1`, oid).Scan(&orderNumber)
	data := map[string]any{"order_id": oid, "order_number": orderNumber, "type": "order_delivered"}
	message := fmt.Sprintf("Your FreshCart order %s has been delivered successfully.", orderNumber)
	_ = h.insertNotification(c, userID, "Order Delivered 🎉", message, "order_delivered", data)
	_ = sendPush(h.pushTokensForUser(c, userID), "Order Delivered 🎉", message, data)
	c.JSON(200, gin.H{"ok": true})
}
