package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"freshcart/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func productSizes(unit string, raw []byte) []services.ProductSize {
	var options []services.ProductSize
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &options)
	}
	return services.NormalizeProductSizes(unit, options)
}
func (h *H) Products(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	cat := c.Query("category_id")

	sql := `
		SELECT
			p.id,
			p.category_id,
			c.name,
			p.name,
			COALESCE(p.description, ''),
			COALESCE(p.image_url, ''),
			p.base_price,
			p.unit_type,
			p.stock_quantity,
			p.is_active,
			p.size_options
		FROM products p
		JOIN categories c ON c.id = p.category_id
		WHERE p.is_active = true
		  AND c.is_active = true
	`

	args := []any{}
	n := 1

	if q != "" {
		sql += fmt.Sprintf(
			` AND (p.name ILIKE $%d OR p.description ILIKE $%d)`,
			n,
			n,
		)

		args = append(args, "%"+q+"%")
		n++
	}

	if cat != "" {
		v, e := strconv.ParseInt(cat, 10, 64)
		if e != nil {
			err(c, 400, e)
			return
		}

		sql += fmt.Sprintf(` AND p.category_id = $%d`, n)
		args = append(args, v)
		n++
	}

	sql += ` ORDER BY p.name`

	rows, e := h.DB.Query(c, sql, args...)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()

	var out []gin.H

	for rows.Next() {
		var id, catid int64
		var name, catname, desc, img, unit string
		var price, stock float64
		var active bool
		var sizeOptions []byte

		if e = rows.Scan(
			&id,
			&catid,
			&catname,
			&name,
			&desc,
			&img,
			&price,
			&unit,
			&stock,
			&active,
			&sizeOptions,
		); e != nil {
			err(c, 500, e)
			return
		}

		out = append(out, gin.H{
			"id":             id,
			"category_id":    catid,
			"category_name":  catname,
			"name":           name,
			"description":    desc,
			"image_url":      img,
			"base_price":     price,
			"unit_type":      unit,
			"stock_quantity": stock,
			"is_active":      active,
			"size_options":   productSizes(unit, sizeOptions),
		})
	}

	if e = rows.Err(); e != nil {
		err(c, 500, e)
		return
	}

	c.JSON(200, out)
}
func (h *H) AdminProductList(c *gin.Context) {
	rows, e := h.DB.Query(
		c,
		`
		SELECT
			p.id,
			p.category_id,
			c.name,
			p.name,
			COALESCE(p.description, ''),
			COALESCE(p.image_url, ''),
			p.base_price,
			p.unit_type,
			p.stock_quantity,
			p.is_active,
			p.size_options
		FROM products p
		JOIN categories c ON c.id = p.category_id
		ORDER BY p.name
		`,
	)

	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()

	var out []gin.H

	for rows.Next() {
		var id, catid int64
		var name, catname, desc, img, unit string
		var price, stock float64
		var active bool
		var sizeOptions []byte

		if e = rows.Scan(
			&id,
			&catid,
			&catname,
			&name,
			&desc,
			&img,
			&price,
			&unit,
			&stock,
			&active,
			&sizeOptions,
		); e != nil {
			err(c, 500, e)
			return
		}

		out = append(out, gin.H{
			"id":             id,
			"category_id":    catid,
			"category_name":  catname,
			"name":           name,
			"description":    desc,
			"image_url":      img,
			"base_price":     price,
			"unit_type":      unit,
			"stock_quantity": stock,
			"is_active":      active,
			"size_options":   productSizes(unit, sizeOptions),
		})
	}

	if e = rows.Err(); e != nil {
		err(c, 500, e)
		return
	}

	c.JSON(200, out)
}
func (h *H) Product(c *gin.Context) {
	v, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}

	var id, catid int64
	var name, catname, desc, img, unit string
	var price, stock float64
	var active bool
	var sizeOptions []byte

	e = h.DB.QueryRow(
		c,
		`
		SELECT
			p.id,
			p.category_id,
			c.name,
			p.name,
			COALESCE(p.description, ''),
			COALESCE(p.image_url, ''),
			p.base_price,
			p.unit_type,
			p.stock_quantity,
			p.is_active,
			p.size_options
		FROM products p
		JOIN categories c ON c.id = p.category_id
		WHERE p.id = $1
		`,
		v,
	).Scan(
		&id,
		&catid,
		&catname,
		&name,
		&desc,
		&img,
		&price,
		&unit,
		&stock,
		&active,
		&sizeOptions,
	)

	if e != nil {
		err(c, 404, fmt.Errorf("product not found"))
		return
	}

	c.JSON(200, gin.H{
		"id":             id,
		"category_id":    catid,
		"category_name":  catname,
		"name":           name,
		"description":    desc,
		"image_url":      img,
		"base_price":     price,
		"unit_type":      unit,
		"stock_quantity": stock,
		"is_active":      active,
		"size_options":   productSizes(unit, sizeOptions),
	})
}
func (h *H) Prices(c *gin.Context) {
	subtotal, _ := strconv.ParseFloat(c.Query("subtotal"), 64)
	settings, e := scanShippingSettings(h.DB.QueryRow(c, `SELECT minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled FROM shipping_settings WHERE id=1`))
	if e != nil {
		err(c, 500, e)
		return
	}
	p := services.Progress(subtotal, settings)
	p["sizes"] = services.Sizes
	c.JSON(200, p)
}
func (h *H) Slots(c *gin.Context) {
	d := c.Query("date")
	if d == "" {
		d = time.Now().Format("2006-01-02")
	}
	rows, e := h.DB.Query(c, `SELECT id,slot_date::text,start_time::text,end_time::text,max_orders,booked_orders,is_active FROM time_slots WHERE slot_date=$1 AND is_active=true AND booked_orders<max_orders ORDER BY start_time`, d)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var i, max, b int
		var date, st, en string
		var ok bool
		rows.Scan(&i, &date, &st, &en, &max, &b, &ok)
		out = append(out, gin.H{"id": i, "slot_date": date, "start_time": st, "end_time": en, "max_orders": max, "booked_orders": b, "is_active": ok, "available": b < max})
	}
	c.JSON(200, out)
}
func (h *H) AdminProducts(c *gin.Context) {
	var x struct {
		CategoryID    int64                  `json:"category_id"`
		Name          string                 `json:"name"`
		Description   string                 `json:"description"`
		ImageURL      string                 `json:"image_url"`
		UnitType      string                 `json:"unit_type"`
		BasePrice     float64                `json:"base_price"`
		StockQuantity float64                `json:"stock_quantity"`
		SizeOptions   []services.ProductSize `json:"size_options"`
		IsActive      bool                   `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil || x.Name == "" || x.CategoryID < 1 || x.BasePrice < 0 || x.StockQuantity < 0 || (x.UnitType != "kg" && x.UnitType != "liter" && x.UnitType != "dozen") {
		err(c, 400, fmt.Errorf("invalid product"))
		return
	}
	if !x.IsActive {
		x.IsActive = true
	}
	x.SizeOptions = services.NormalizeProductSizes(x.UnitType, x.SizeOptions)
	sizeJSON, _ := json.Marshal(x.SizeOptions)
	var pid int64
	e := h.DB.QueryRow(c, `INSERT INTO products(category_id,name,description,image_url,base_price,unit_type,stock_quantity,is_active,size_options) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, x.CategoryID, x.Name, x.Description, x.ImageURL, x.BasePrice, x.UnitType, x.StockQuantity, x.IsActive, sizeJSON).Scan(&pid)
	if e != nil {
		err(c, 400, e)
		return
	}
	c.JSON(201, gin.H{"id": pid})
}
func (h *H) AdminUpdateProduct(c *gin.Context) {
	pid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var x struct {
		CategoryID    int64                  `json:"category_id"`
		Name          string                 `json:"name"`
		Description   string                 `json:"description"`
		ImageURL      string                 `json:"image_url"`
		UnitType      string                 `json:"unit_type"`
		BasePrice     float64                `json:"base_price"`
		StockQuantity float64                `json:"stock_quantity"`
		SizeOptions   []services.ProductSize `json:"size_options"`
		IsActive      bool                   `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil || x.Name == "" || x.CategoryID < 1 || x.BasePrice < 0 || x.StockQuantity < 0 || (x.UnitType != "kg" && x.UnitType != "liter" && x.UnitType != "dozen") {
		err(c, 400, fmt.Errorf("invalid product"))
		return
	}
	x.SizeOptions = services.NormalizeProductSizes(x.UnitType, x.SizeOptions)
	sizeJSON, _ := json.Marshal(x.SizeOptions)
	var oldName, oldImage, oldUnit string
	var oldPrice float64
	if e := h.DB.QueryRow(c, `SELECT name,COALESCE(image_url,''),unit_type,base_price FROM products WHERE id=$1`, pid).Scan(&oldName, &oldImage, &oldUnit, &oldPrice); e != nil {
		err(c, 404, fmt.Errorf("product not found"))
		return
	}
	_, e := h.DB.Exec(c, `UPDATE products SET category_id=$1,name=$2,description=$3,image_url=$4,base_price=$5,unit_type=$6,stock_quantity=$7,is_active=$8,size_options=$9,updated_at=now() WHERE id=$10`, x.CategoryID, x.Name, x.Description, x.ImageURL, x.BasePrice, x.UnitType, x.StockQuantity, x.IsActive, sizeJSON, pid)
	if e != nil {
		err(c, 500, e)
		return
	}
	sent, failed := 0, 0
	if x.BasePrice != oldPrice {
		sent, failed = h.notifyPriceUpdate(c, pid, x.Name, x.ImageURL, x.UnitType, oldPrice, x.BasePrice, "")
	}
	c.JSON(200, gin.H{"ok": true, "sent": sent, "failed": failed})
}
func (h *H) AdminDeleteProduct(c *gin.Context) {
	pid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	_, e := h.DB.Exec(c, `UPDATE products SET is_active=false,updated_at=now() WHERE id=$1`, pid)
	if e != nil {
		err(c, 500, e)
		return
	}
	c.Status(204)
}
func (h *H) AdminProductImage(c *gin.Context) {
	pid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	f, e := c.FormFile("image")
	if e != nil {
		err(c, 400, fmt.Errorf("image required"))
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
	h.DB.Exec(c, `UPDATE products SET image_url=$1 WHERE id=$2`, url, pid)
	c.JSON(200, gin.H{"image_url": url})
}
func (h *H) AdminPrice(c *gin.Context) {
	var x struct {
		ProductID           int64   `json:"product_id"`
		BasePrice           float64 `json:"base_price"`
		NotificationMessage string  `json:"notification_message"`
	}
	if c.ShouldBindJSON(&x) != nil || x.ProductID < 1 || x.BasePrice < 0 {
		err(c, 400, fmt.Errorf("invalid price"))
		return
	}
	var name, image, unit string
	var oldPrice float64
	e := h.DB.QueryRow(c, `SELECT name,COALESCE(image_url,''),unit_type,base_price FROM products WHERE id=$1`, x.ProductID).Scan(&name, &image, &unit, &oldPrice)
	if e != nil {
		err(c, 404, fmt.Errorf("product not found"))
		return
	}
	if _, e = h.DB.Exec(c, `UPDATE products SET base_price=$1,updated_at=now() WHERE id=$2`, x.BasePrice, x.ProductID); e != nil {
		err(c, 500, e)
		return
	}
	sent, failed := h.notifyPriceUpdate(c, x.ProductID, name, image, unit, oldPrice, x.BasePrice, x.NotificationMessage)
	c.JSON(200, gin.H{"ok": true, "sent": sent, "failed": failed})
}
func (h *H) notifyPriceUpdate(ctx context.Context, productID int64, name, image, unit string, oldPrice, newPrice float64, customMessage string) (int, int) {
	message := strings.TrimSpace(customMessage)
	if message == "" {
		if newPrice < oldPrice {
			message = fmt.Sprintf("%s price dropped from Rs. %.0f to Rs. %.0f per %s.", name, oldPrice, newPrice, unit)
		} else if newPrice > oldPrice {
			message = fmt.Sprintf("%s price updated from Rs. %.0f to Rs. %.0f per %s.", name, oldPrice, newPrice, unit)
		} else {
			message = fmt.Sprintf("%s price is now Rs. %.0f per %s.", name, newPrice, unit)
		}
	}
	data := map[string]any{"product_id": productID, "product_name": name, "product_image": image, "old_price": oldPrice, "new_price": newPrice, "unit_type": unit, "type": "price_update"}
	rows, _ := h.DB.Query(ctx, `SELECT id FROM users WHERE role='customer' AND is_active=true`)
	sent := 0
	failed := 0
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var uid int64
			if rows.Scan(&uid) == nil {
				_ = h.insertNotification(ctx, uid, "Price Update", message, "price_update", data)
				tokens := h.pushTokensForUser(ctx, uid)
				if len(tokens) > 0 {
					if pushErr := sendPush(tokens, "FreshCart Price Update", message, data); pushErr != nil {
						failed++
						continue
					}
					sent++
				}
			}
		}
	}
	return sent, failed
}
