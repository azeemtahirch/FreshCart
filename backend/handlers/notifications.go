package handlers

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *H) CleanupOldNotifications(ctx context.Context) {
	cleanupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	result, err := h.DB.Exec(cleanupCtx, `
		DELETE FROM notifications
		WHERE created_at < now() - interval '1 day'
	`)
	if err != nil {
		log.Printf("notification cleanup failed: %v", err)
		return
	}
	log.Printf("notification cleanup deleted %d old record(s)", result.RowsAffected())
}

func (h *H) Notifications(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,title,message,type,data,is_read,created_at::text FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var nid int64
		var title, message, typ, created string
		var data []byte
		var read bool
		if e = rows.Scan(&nid, &title, &message, &typ, &data, &read, &created); e != nil {
			continue
		}
		out = append(out, gin.H{"id": nid, "title": title, "message": message, "type": typ, "data": string(data), "is_read": read, "created_at": created})
	}
	c.JSON(200, out)
}

func (h *H) MarkNotificationRead(c *gin.Context) {
	nid, e := strconv.ParseInt(c.Param("id"), 10, 64)
	if e != nil {
		err(c, 400, e)
		return
	}
	res, e := h.DB.Exec(c, `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`, nid, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	if res.RowsAffected() == 0 {
		err(c, 404, fmt.Errorf("notification not found"))
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (h *H) AdminNotifications(c *gin.Context) {
	rows, e := h.DB.Query(c, `SELECT id,title,message,type,data,is_read,created_at::text FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, id(c))
	if e != nil {
		err(c, 500, e)
		return
	}
	defer rows.Close()
	var out []gin.H
	for rows.Next() {
		var nid int64
		var title, message, typ, created string
		var data []byte
		var read bool
		if rows.Scan(&nid, &title, &message, &typ, &data, &read, &created) == nil {
			out = append(out, gin.H{"id": nid, "title": title, "message": message, "type": typ, "data": string(data), "is_read": read, "created_at": created})
		}
	}
	c.JSON(200, out)
}
