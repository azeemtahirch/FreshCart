package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"strconv"
	"strings"
)

func (h *H) Categories(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,name,COALESCE(icon,''),COALESCE(description,''),is_active FROM categories WHERE is_active=true ORDER BY id`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var a int64
		var n, i, d string
		var ok bool
		rows.Scan(&a, &n, &i, &d, &ok)
		out = append(out, gin.H{"id": a, "name": n, "icon": i, "description": d, "is_active": ok})
	}
	c.JSON(200, out)
}
func (h *H) ShippingCities(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,name,is_active FROM shipping_cities WHERE is_active=true ORDER BY name`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id int64
		var name string
		var active bool
		if e = rows.Scan(&id, &name, &active); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": id, "name": name, "is_active": active})
	}
	c.JSON(200, out)
}
func (h *H) ShippingAreas(c *gin.Context) {
	cityID, e := strconv.ParseInt(c.Param("cityID"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	rows, e := h.DB.Query(c, `SELECT id,name,is_active FROM shipping_areas WHERE city_id=$1 AND is_active=true ORDER BY name`, cityID)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id int64
		var name string
		var active bool
		if e = rows.Scan(&id, &name, &active); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": id, "name": name, "is_active": active})
	}
	c.JSON(200, out)
}
func (h *H) AdminShippingCities(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,name,is_active FROM shipping_cities ORDER BY name`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id int64
		var name string
		var active bool
		rows.Scan(&id, &name, &active)
		out = append(out, gin.H{"id": id, "name": name, "is_active": active})
	}
	c.JSON(200, out)
}
func (h *H) AdminAddShippingCity(c *gin.Context) {
	var x struct {
		Name string `json:"name"`
	}
	if c.ShouldBindJSON(&x) != nil || strings.TrimSpace(x.Name) == "" {
		err(c, 400, fmt.Errorf("city name is required"))
		return
	}
	var id int64
	e := h.DB.QueryRow(c, `INSERT INTO shipping_cities(name) VALUES($1) RETURNING id`, strings.TrimSpace(x.Name)).Scan(&id)
	if e != nil {
		err(c, 409, fmt.Errorf("city already exists"))
		return
	}
	c.JSON(201, gin.H{"id": id, "name": strings.TrimSpace(x.Name), "is_active": true})
}
func (h *H) AdminUpdateShippingCity(c *gin.Context) {
	id, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	var x struct {
		Name     string `json:"name"`
		IsActive bool   `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil || strings.TrimSpace(x.Name) == "" {
		err(c, 400, fmt.Errorf("city name is required"))
		return
	}
	_, e = h.DB.Exec(c, `UPDATE shipping_cities SET name=$1,is_active=$2,updated_at=now() WHERE id=$3`, strings.TrimSpace(x.Name), x.IsActive, id)
	if e != nil {
		err(c, 409, fmt.Errorf("city name may already exist"))
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) AdminDeleteShippingCity(c *gin.Context) {
	id, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	_, e = h.DB.Exec(c, `DELETE FROM shipping_cities WHERE id=$1`, id)
	if e != nil {
		err(c, 500, e)
		return
	}
	c.Status(204)
}
func (h *H) AdminShippingAreas(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT sa.id,sa.city_id,sc.name,sa.name,sa.is_active FROM shipping_areas sa JOIN shipping_cities sc ON sc.id=sa.city_id ORDER BY sc.name,sa.name`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id, cityID int64
		var city, name string
		var active bool
		rows.Scan(&id, &cityID, &city, &name, &active)
		out = append(out, gin.H{"id": id, "city_id": cityID, "city": city, "name": name, "is_active": active})
	}
	c.JSON(200, out)
}
func (h *H) AdminAddShippingArea(c *gin.Context) {
	var x struct {
		CityID int64  `json:"city_id"`
		Name   string `json:"name"`
	}
	if c.ShouldBindJSON(&x) != nil || x.CityID <= 0 || strings.TrimSpace(x.Name) == "" {
		err(c, 400, fmt.Errorf("city and area name are required"))
		return
	}
	var id int64
	e := h.DB.QueryRow(c, `INSERT INTO shipping_areas(city_id,name) VALUES($1,$2) RETURNING id`, x.CityID, strings.TrimSpace(x.Name)).Scan(&id)
	if e != nil {
		err(c, 409, fmt.Errorf("area already exists for this city"))
		return
	}
	c.JSON(201, gin.H{"id": id, "city_id": x.CityID, "name": strings.TrimSpace(x.Name), "is_active": true})
}
func (h *H) AdminUpdateShippingArea(c *gin.Context) {
	id, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	var x struct {
		CityID   int64  `json:"city_id"`
		Name     string `json:"name"`
		IsActive bool   `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil || x.CityID <= 0 || strings.TrimSpace(x.Name) == "" {
		err(c, 400, fmt.Errorf("city and area name are required"))
		return
	}
	_, e = h.DB.Exec(c, `UPDATE shipping_areas SET city_id=$1,name=$2,is_active=$3,updated_at=now() WHERE id=$4`, x.CityID, strings.TrimSpace(x.Name), x.IsActive, id)
	if e != nil {
		err(c, 409, fmt.Errorf("area already exists for this city"))
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func (h *H) AdminDeleteShippingArea(c *gin.Context) {
	id, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	_, e = h.DB.Exec(c, `DELETE FROM shipping_areas WHERE id=$1`, id)
	if e != nil {
		err(c, 500, e)
		return
	}
	c.Status(204)
}
func (h *H) AdminCategoryList(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT c.id,c.name,COALESCE(c.icon,''),COALESCE(c.description,''),c.is_active,COUNT(p.id) FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.id`)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var id, productCount int64
		var name, icon, description string
		var active bool
		if e = rows.Scan(&id, &name, &icon, &description, &active, &productCount); e != nil {
			err(c, 500, e)
			return
		}
		out = append(out, gin.H{"id": id, "name": name, "icon": icon, "description": description, "is_active": active, "product_count": productCount})
	}
	c.JSON(200, out)
}
func (h *H) AdminCategory(c *gin.Context) {
	var x struct {
		Name, Icon, Description string
		IsActive                bool `json:"is_active"`
	}
	if c.ShouldBindJSON(&x) != nil || x.Name == "" {
		err(c, 400, fmt.Errorf("category name required"))
		return
	}
	var cid int64
	e := h.DB.QueryRow(c, `INSERT INTO categories(name,icon,description,is_active) VALUES($1,$2,$3,$4) RETURNING id`, x.Name, x.Icon, x.Description, x.IsActive).Scan(&cid)
	if e != nil {
		err(c, 409, e)
		return
	}
	c.JSON(201, gin.H{"id": cid})
}
func (h *H) AdminUpdateCategory(c *gin.Context) {
	cid, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var x struct {
		Name, Icon, Description string
		IsActive                bool `json:"is_active"`
	}
	c.ShouldBindJSON(&x)
	_, e := h.DB.Exec(c, `UPDATE categories SET name=$1,icon=$2,description=$3,is_active=$4,updated_at=now() WHERE id=$5`, x.Name, x.Icon, x.Description, x.IsActive, cid)
	if e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
