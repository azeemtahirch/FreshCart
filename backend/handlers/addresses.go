package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"strconv"
	"strings"
)

func (h *H) Addresses(c *gin.Context) {
	rows, e := h.DB.Query(c, `
		SELECT
			a.id,
			a.label,
			a.address_line,
			COALESCE(a.city_id, 0),
			COALESCE(a.area_id, 0),
			COALESCE(sc.name, a.city, ''),
			COALESCE(sa.name, ''),
			a.latitude,
			a.longitude,
			a.is_default
		FROM addresses a
		LEFT JOIN shipping_cities sc ON sc.id = a.city_id
		LEFT JOIN shipping_areas sa ON sa.id = a.area_id
		WHERE a.user_id = $1
		ORDER BY a.is_default DESC, a.id DESC
	`, id(c))

	if e != nil {
		err(c, 500, e)
		return
	}

	defer rows.Close()

	var out []gin.H

	for rows.Next() {
		var (
			i                  int64
			cityID, areaID     int64
			label, addressLine string
			city, area         string
			lat, lng           float64
			isDefault          bool
		)

		if e = rows.Scan(
			&i,
			&label,
			&addressLine,
			&cityID,
			&areaID,
			&city,
			&area,
			&lat,
			&lng,
			&isDefault,
		); e != nil {
			err(c, 500, e)
			return
		}

		out = append(out, gin.H{
			"id":           i,
			"label":        label,
			"address_line": addressLine,
			"city_id":      cityID,
			"area_id":      areaID,
			"city":         city,
			"area":         area,
			"latitude":     lat,
			"longitude":    lng,
			"is_default":   isDefault,
		})
	}

	if e = rows.Err(); e != nil {
		err(c, 500, e)
		return
	}

	c.JSON(200, out)
}
func (h *H) CreateAddress(c *gin.Context) {
	var x struct {
		Label       string  `json:"label"`
		AddressLine string  `json:"address_line"`
		CityID      int64   `json:"city_id"`
		AreaID      int64   `json:"area_id"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
	}

	if e := c.ShouldBindJSON(&x); e != nil {
		err(c, 400, fmt.Errorf("invalid address payload: %w", e))
		return
	}

	x.Label = strings.TrimSpace(x.Label)
	x.AddressLine = strings.TrimSpace(x.AddressLine)

	if x.Label == "" {
		err(c, 400, fmt.Errorf("address label is required"))
		return
	}

	if x.AddressLine == "" {
		err(c, 400, fmt.Errorf("address is required"))
		return
	}

	if x.CityID <= 0 {
		err(c, 400, fmt.Errorf("city is required"))
		return
	}

	if x.AreaID <= 0 {
		err(c, 400, fmt.Errorf("area is required"))
		return
	}

	// Validate city and area.
	var valid bool
	var cityName, areaName string

	e := h.DB.QueryRow(
		c,
		`
		SELECT
			sc.is_active AND sa.is_active,
			sc.name,
			sa.name
		FROM shipping_cities sc
		JOIN shipping_areas sa
			ON sa.city_id = sc.id
		WHERE sc.id = $1
		  AND sa.id = $2
		`,
		x.CityID,
		x.AreaID,
	).Scan(&valid, &cityName, &areaName)

	if e != nil {
		err(c, 400, fmt.Errorf(
			"delivery is not available in the selected area",
		))
		return
	}

	if !valid {
		err(c, 400, fmt.Errorf(
			"delivery is not available in the selected area",
		))
		return
	}

	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}

	defer tx.Rollback(c)

	// Check whether this user already has an address.
	var addressCount int

	e = tx.QueryRow(
		c,
		`
		SELECT COUNT(*)
		FROM addresses
		WHERE user_id = $1
		`,
		id(c),
	).Scan(&addressCount)

	if e != nil {
		err(c, 500, e)
		return
	}

	// First address is automatically the default address.
	isDefault := addressCount == 0

	var addressID int64

	e = tx.QueryRow(
		c,
		`
		INSERT INTO addresses (
			user_id,
			label,
			address_line,
			city,
			city_id,
			area_id,
			latitude,
			longitude,
			is_default
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9
		)
		RETURNING id
		`,
		id(c),
		x.Label,
		x.AddressLine,
		cityName,
		x.CityID,
		x.AreaID,
		x.Latitude,
		x.Longitude,
		isDefault,
	).Scan(&addressID)

	if e != nil {
		err(c, 500, e)
		return
	}

	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}

	c.JSON(201, gin.H{
		"id":           addressID,
		"label":        x.Label,
		"address_line": x.AddressLine,
		"city_id":      x.CityID,
		"area_id":      x.AreaID,
		"city":         cityName,
		"area":         areaName,
		"latitude":     x.Latitude,
		"longitude":    x.Longitude,
		"is_default":   isDefault,
	})
}
func (h *H) UpdateAddress(c *gin.Context) {
	addressID, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid address id"))
		return
	}

	var x struct {
		Label       string  `json:"label"`
		AddressLine string  `json:"address_line"`
		CityID      int64   `json:"city_id"`
		AreaID      int64   `json:"area_id"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
		IsDefault   bool    `json:"is_default"`
	}

	if e = c.ShouldBindJSON(&x); e != nil {
		err(c, 400, fmt.Errorf("invalid address payload: %w", e))
		return
	}

	x.Label = strings.TrimSpace(x.Label)
	x.AddressLine = strings.TrimSpace(x.AddressLine)

	// Required fields.
	if x.Label == "" {
		err(c, 400, fmt.Errorf("address label is required"))
		return
	}

	if x.AddressLine == "" {
		err(c, 400, fmt.Errorf("address is required"))
		return
	}

	if x.CityID <= 0 {
		err(c, 400, fmt.Errorf("city is required"))
		return
	}

	if x.AreaID <= 0 {
		err(c, 400, fmt.Errorf("area is required"))
		return
	}

	// Validate city + area.
	var valid bool
	var cityName, areaName string

	e = h.DB.QueryRow(
		c,
		`
		SELECT
			sc.is_active AND sa.is_active,
			sc.name,
			sa.name
		FROM shipping_cities sc
		JOIN shipping_areas sa
			ON sa.city_id = sc.id
		WHERE sc.id = $1
		  AND sa.id = $2
		`,
		x.CityID,
		x.AreaID,
	).Scan(&valid, &cityName, &areaName)

	if e != nil {
		err(c, 400, fmt.Errorf(
			"delivery is not available in the selected area",
		))
		return
	}

	if !valid {
		err(c, 400, fmt.Errorf(
			"delivery is not available in the selected area",
		))
		return
	}

	// Verify that the address belongs to the logged-in user.
	var exists bool

	e = h.DB.QueryRow(
		c,
		`
		SELECT EXISTS (
			SELECT 1
			FROM addresses
			WHERE id = $1
			  AND user_id = $2
		)
		`,
		addressID,
		id(c),
	).Scan(&exists)

	if e != nil {
		err(c, 500, e)
		return
	}

	if !exists {
		err(c, 404, fmt.Errorf("address not found"))
		return
	}

	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}

	defer tx.Rollback(c)

	// If this address is becoming default,
	// remove default from all other addresses.
	if x.IsDefault {
		_, e = tx.Exec(
			c,
			`
			UPDATE addresses
			SET is_default = false
			WHERE user_id = $1
			  AND id <> $2
			`,
			id(c),
			addressID,
		)

		if e != nil {
			err(c, 500, e)
			return
		}
	}

	_, e = tx.Exec(
		c,
		`
		UPDATE addresses
		SET
			label = $1,
			address_line = $2,
			city = $3,
			city_id = $4,
			area_id = $5,
			latitude = $6,
			longitude = $7,
			is_default = $8,
			updated_at = now()
		WHERE id = $9
		  AND user_id = $10
		`,
		x.Label,
		x.AddressLine,
		cityName,
		x.CityID,
		x.AreaID,
		x.Latitude,
		x.Longitude,
		x.IsDefault,
		addressID,
		id(c),
	)

	if e != nil {
		err(c, 500, e)
		return
	}

	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}

	c.JSON(200, gin.H{
		"ok":           true,
		"id":           addressID,
		"label":        x.Label,
		"address_line": x.AddressLine,
		"city_id":      x.CityID,
		"area_id":      x.AreaID,
		"city":         cityName,
		"area":         areaName,
		"latitude":     x.Latitude,
		"longitude":    x.Longitude,
		"is_default":   x.IsDefault,
	})
}
func (h *H) DeleteAddress(c *gin.Context) {
	v, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid address id"))
		return
	}

	var used bool

	e = h.DB.QueryRow(
		c,
		`
		SELECT EXISTS (
			SELECT 1
			FROM orders
			WHERE address_id = $1
		)
		`,
		v,
	).Scan(&used)

	if e != nil {
		err(c, 500, e)
		return
	}

	if used {
		err(
			c,
			409,
			fmt.Errorf("this address cannot be deleted because it is used by an existing order"),
		)
		return
	}

	result, e := h.DB.Exec(
		c,
		`
		DELETE FROM addresses
		WHERE id = $1
		  AND user_id = $2
		`,
		v,
		id(c),
	)

	if e != nil {
		err(c, 500, e)
		return
	}

	if result.RowsAffected() == 0 {
		err(c, 404, fmt.Errorf("address not found"))
		return
	}

	c.Status(204)
}
