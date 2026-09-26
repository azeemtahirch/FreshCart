package handlers

import (
	"errors"
	"fmt"
	"freshcart/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"strconv"
	"strings"
)

func (h *H) CreateOrder(c *gin.Context) {
	var x struct {
		AddressID     int64   `json:"address_id"`
		DeliveryLat   float64 `json:"delivery_lat"`
		DeliveryLng   float64 `json:"delivery_lng"`
		DeliveryDate  string  `json:"delivery_date"`
		TimeSlotID    int64   `json:"time_slot_id"`
		PaymentMethod string  `json:"payment_method"`
		CouponCode    string  `json:"coupon_code"`
		Items         []struct {
			ProductID int64  `json:"product_id"`
			SizeML    int    `json:"size_ml"`
			SizeLabel string `json:"size_label"`
			Quantity  int    `json:"quantity"`
		} `json:"items"`
	}
	if c.ShouldBindJSON(&x) != nil || len(x.Items) == 0 || x.PaymentMethod != "cod" && x.PaymentMethod != "jazzcash" {
		err(c, 400, fmt.Errorf("invalid order or payment method"))
		return
	}
	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer tx.Rollback(c)
	var addr string
	var areaOK bool
	if e = tx.QueryRow(c, `SELECT a.address_line, sc.is_active AND sa.is_active FROM addresses a JOIN shipping_cities sc ON sc.id=a.city_id JOIN shipping_areas sa ON sa.id=a.area_id WHERE a.id=$1 AND a.user_id=$2`, x.AddressID, id(c)).Scan(&addr, &areaOK); e != nil {
		err(c, 400, fmt.Errorf("delivery address not found"))
		return
	}
	if !areaOK {
		err(c, 400, fmt.Errorf("we are not shipping to this area yet. Coming soon."))
		return
	}
	var max, booked int
	var slotDate string
	if e = tx.QueryRow(c, `SELECT max_orders,booked_orders,slot_date::text FROM time_slots WHERE id=$1 AND slot_date=$2 AND is_active=true FOR UPDATE`, x.TimeSlotID, x.DeliveryDate).Scan(&max, &booked, &slotDate); e != nil || booked >= max {
		err(c, 409, fmt.Errorf("delivery time slot is full or unavailable"))
		return
	}
	settings, e := scanShippingSettings(tx.QueryRow(c, `SELECT minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled FROM shipping_settings WHERE id=1 FOR UPDATE`))
	if e != nil {
		err(c, 500, e)
		return
	}
	subtotal := 0.0
	type L struct {
		id                      int64
		name, img, unit         string
		size, qty               int
		label                   string
		unitPrice, total, stock float64
	}
	var lines []L
	for _, it := range x.Items {
		if it.SizeML <= 0 || it.Quantity < 1 {
			err(c, 400, fmt.Errorf("invalid product quantity"))
			return
		}
		var p L
		var active bool
		var sizeOptions []byte
		e = tx.QueryRow(c, `SELECT id,name,COALESCE(image_url,''),unit_type,base_price,stock_quantity,is_active,size_options FROM products WHERE id=$1 FOR UPDATE`, it.ProductID).Scan(&p.id, &p.name, &p.img, &p.unit, &p.unitPrice, &p.stock, &active, &sizeOptions)
		if e != nil || !active {
			err(c, 400, fmt.Errorf("product unavailable"))
			return
		}
		validOption := false
		selectedLabel := strings.TrimSpace(it.SizeLabel)

		if p.unit == "dozen" {
			// Dozen products are sold by quantity.
			// size_ml is normalized to 1.
			it.SizeML = 1
			selectedLabel = "1 dozen"
			validOption = true
		} else {
			for _, option := range productSizes(p.unit, sizeOptions) {
				if option.Value == it.SizeML {
					validOption = true
					selectedLabel = option.Label
					break
				}
			}

			if !validOption {
				err(c, 400, fmt.Errorf(
					"invalid product weight/size: product_id=%d, size_ml=%d, size_label=%q, unit=%s",
					it.ProductID,
					it.SizeML,
					it.SizeLabel,
					p.unit,
				))
				return
			}
		}
		need := float64(it.SizeML) / 1000 * float64(it.Quantity)
		if p.unit == "dozen" {
			need = float64(it.Quantity)
		}
		if need > p.stock {
			err(c, 409, fmt.Errorf("%s is out of stock", p.name))
			return
		}
		p.size, p.qty = it.SizeML, it.Quantity
		p.label = selectedLabel
		if p.unit == "dozen" {
			p.total = p.unitPrice * float64(it.Quantity)
			p.unitPrice = p.unitPrice
		} else {
			p.total = services.UnitPrice(p.unitPrice, it.SizeML) * float64(it.Quantity)
			p.unitPrice = services.UnitPrice(p.unitPrice, it.SizeML)
		}
		subtotal += p.total
		lines = append(lines, p)
	}
	ship, allowed := services.Shipping(subtotal, settings)
	if !allowed {
		err(c, 400, fmt.Errorf("Minimum order amount is %s %.0f. Please add %s %.0f more to your cart.", settings.Currency, settings.MinimumOrderAmount, settings.Currency, settings.MinimumOrderAmount-subtotal))
		return
	}
	discount := 0.0
	couponCode := strings.ToUpper(strings.TrimSpace(x.CouponCode))
	if couponCode != "" {
		var cp couponView
		e = tx.QueryRow(c, `SELECT id,code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,used_count,starts_at,expires_at,is_active FROM coupons WHERE upper(code)=upper($1) FOR UPDATE`, couponCode).Scan(&cp.ID, &cp.Code, &cp.DiscountType, &cp.DiscountValue, &cp.MinOrderAmount, &cp.MaxDiscount, &cp.UsageLimit, &cp.UsedCount, &cp.StartsAt, &cp.ExpiresAt, &cp.IsActive)
		if e != nil {
			err(c, 400, fmt.Errorf("invalid coupon code"))
			return
		}
		discount, e = couponDiscount(cp, subtotal)
		if e != nil {
			err(c, 400, e)
			return
		}
	}
	finalTotal := subtotal - discount + ship
	num := "FC-" + strings.ToUpper(uuid.NewString()[:8])
	var oid int64
	e = tx.QueryRow(c, `INSERT INTO orders(order_number,user_id,address_id,delivery_address,delivery_latitude,delivery_longitude,delivery_date,time_slot_id,payment_method,status,subtotal,shipping,total,coupon_code,discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14) RETURNING id`, num, id(c), x.AddressID, addr, x.DeliveryLat, x.DeliveryLng, x.DeliveryDate, x.TimeSlotID, x.PaymentMethod, subtotal, ship, finalTotal, nullableCoupon(couponCode), discount).Scan(&oid)
	if e != nil {
		err(c, 500, e)
		return
	}
	for _, l := range lines {
		if _, e = tx.Exec(c, `INSERT INTO order_items(order_id,product_id,product_name,image_url,unit_type,size_ml,size_label,quantity,unit_price,item_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, oid, l.id, l.name, l.img, l.unit, l.size, l.label, l.qty, l.unitPrice, l.total); e != nil {
			err(c, 500, fmt.Errorf("save order item: %w", e))
			return
		}
		if _, e = tx.Exec(c, `UPDATE products SET stock_quantity=stock_quantity-$1,updated_at=now() WHERE id=$2`, func() float64 {
			if l.unit == "dozen" {
				return float64(l.qty)
			}
			return float64(l.size) / 1000 * float64(l.qty)
		}(), l.id); e != nil {
			err(c, 500, fmt.Errorf("update product stock: %w", e))
			return
		}
	}
	var assignedRiderID int64
	if e = tx.QueryRow(c, `
		SELECT u.id
		FROM users u
		JOIN riders r ON r.user_id=u.id
		JOIN rider_time_slots rts ON rts.rider_id=u.id AND rts.time_slot_id=$1
		WHERE u.role='rider' AND u.is_active=true AND r.is_available=true
		ORDER BY (
			SELECT COUNT(*) FROM orders active
			WHERE active.rider_id=u.id AND active.status IN ('assigned','out_for_delivery')
		), u.id
		LIMIT 1`, x.TimeSlotID).Scan(&assignedRiderID); e == nil {
		if _, e = tx.Exec(c, `UPDATE orders SET rider_id=$1,status='assigned',updated_at=now() WHERE id=$2`, assignedRiderID, oid); e != nil {
			err(c, 500, e)
			return
		}
	} else if !errors.Is(e, pgx.ErrNoRows) {
		err(c, 500, fmt.Errorf("find available rider: %w", e))
		return
	}
	if _, e = tx.Exec(c, `UPDATE time_slots SET booked_orders=booked_orders+1 WHERE id=$1`, x.TimeSlotID); e != nil {
		err(c, 500, fmt.Errorf("reserve delivery time slot: %w", e))
		return
	}
	if couponCode != "" {
		if _, e = tx.Exec(c, `UPDATE coupons SET used_count=used_count+1,updated_at=now() WHERE upper(code)=upper($1)`, couponCode); e != nil {
			err(c, 500, e)
			return
		}
	}
	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}
	// Notify every active admin about the new order. The notification is stored
	// in the same notification center and, when an admin mobile push token exists,
	// is also sent as a push notification.
	adminRows, _ := h.DB.Query(c, `SELECT id FROM users WHERE role='admin' AND is_active=true`)
	if adminRows != nil {
		defer adminRows.Close()
		for adminRows.Next() {
			var adminID int64
			if adminRows.Scan(&adminID) == nil {
				data := map[string]any{"order_id": oid, "order_number": num, "total": finalTotal, "type": "new_order"}
				_ = h.insertNotification(c, adminID, "New Order Received", fmt.Sprintf("Customer placed order %s. Total: Rs. %.0f", num, finalTotal), "new_order", data)
				_ = sendPush(h.pushTokensForUser(c, adminID), "New Order Received", fmt.Sprintf("Customer placed order %s. Total: Rs. %.0f", num, finalTotal), data)
			}
		}
	}
	if assignedRiderID > 0 {
		h.notifyRiderAssignment(c, assignedRiderID, oid)
	}
	createdStatus := "pending"
	if assignedRiderID > 0 {
		createdStatus = "assigned"
	}
	c.JSON(201, gin.H{"order_id": oid, "order_number": num, "subtotal": subtotal, "shipping": ship, "discount": discount, "coupon_code": couponCode, "total": finalTotal, "status": createdStatus})
}
func nullableCoupon(code string) any {
	if code == "" {
		return nil
	}
	return code
}
func (h *H) Orders(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT o.id,o.order_number,o.user_id,o.rider_id,o.delivery_address,o.delivery_latitude,o.delivery_longitude,o.delivery_date::text,o.time_slot_id,o.payment_method,o.status,o.subtotal,o.shipping,o.total,o.created_at::text,o.updated_at::text,s.start_time::text,s.end_time::text FROM orders o JOIN time_slots s ON s.id=o.time_slot_id WHERE o.user_id=$1 ORDER BY o.created_at DESC,o.id DESC`, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var oid, uid, slot int64
		var rid *int64
		var num, addr, dd, pm, st, ca, ua, slotStart, slotEnd string
		var lat, lng, sub, ship, total float64
		if e = rows.Scan(&oid, &num, &uid, &rid, &addr, &lat, &lng, &dd, &slot, &pm, &st, &sub, &ship, &total, &ca, &ua, &slotStart, &slotEnd); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": oid, "order_number": num, "rider_id": rid, "delivery_address": addr, "delivery_date": dd, "time_slot_id": slot, "slot_start_time": slotStart, "slot_end_time": slotEnd, "payment_method": pm, "status": st, "subtotal": sub, "shipping": ship, "total": total, "created_at": ca, "updated_at": ua})
	}
	if e = rows.Err(); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, out)
}
func (h *H) Order(c *gin.Context) {
	oid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	var o gin.H = gin.H{}
	var uid, slot int64
	var rid *int64
	var num, addr, dd, pm, st, customerName, customerPhone, deliveryCity, deliveryArea, slotStart, slotEnd string
	var lat, lng, sub, ship, discount, total float64
	e = h.DB.QueryRow(c, `
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
			o.discount,
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
		WHERE o.id = $1
	`, oid).Scan(
		&oid, &num, &uid, &rid, &addr, &lat, &lng, &dd, &slot, &pm, &st,
		&sub, &ship, &discount, &total, &customerName, &customerPhone,
		&deliveryCity, &deliveryArea, &slotStart, &slotEnd,
	)
	if e != nil {
		err(c, 404, fmt.Errorf("order not found"))
		return
	}
	role, _ := c.Get("role")
	if uid != id(c) && role != "admin" && (role != "rider" || rid == nil || *rid != id(c)) {
		err(c, 403, fmt.Errorf("not allowed"))
		return
	}
	rows, _ := h.DB.Query(c, `SELECT id,product_id,product_name,COALESCE(image_url,''),unit_type,size_ml,COALESCE(size_label,''),quantity,unit_price,item_total FROM order_items WHERE order_id=$1`, oid)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, pid int64
		var n, img, u, sizeLabelValue string
		var size, q int64
		var up, it float64

		rows.Scan(
			&iid,
			&pid,
			&n,
			&img,
			&u,
			&size,
			&sizeLabelValue,
			&q,
			&up,
			&it,
		)
		items = append(items, gin.H{"id": iid, "product_id": pid, "product_name": n, "image_url": img, "unit_type": u, "size_ml": size, "size_label": sizeLabelValue, "quantity": q, "unit_price": up, "item_total": it})
	}
	o["id"] = oid
	o["order_number"] = num
	o["user_id"] = uid
	o["customer_name"] = customerName
	o["customer_phone"] = customerPhone
	o["rider_id"] = rid
	o["delivery_address"] = addr
	o["delivery_city"] = deliveryCity
	o["delivery_area"] = deliveryArea
	o["delivery_latitude"] = lat
	o["delivery_longitude"] = lng
	o["delivery_date"] = dd
	o["time_slot_id"] = slot
	o["slot_start_time"] = slotStart
	o["slot_end_time"] = slotEnd
	o["payment_method"] = pm
	o["status"] = st
	o["subtotal"] = sub
	o["shipping"] = ship
	o["discount"] = discount
	o["total"] = total
	o["items"] = items
	var proofURL, capturedAt string
	if h.DB.QueryRow(c, `SELECT file_url,captured_at::text FROM delivery_proofs WHERE order_id=$1`, oid).Scan(&proofURL, &capturedAt) == nil {
		o["delivery_proof"] = gin.H{"file_url": proofURL, "captured_at": capturedAt}
	} else {
		o["delivery_proof"] = nil
	}
	c.JSON(200, o)
}
