package handlers

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"time"
)

func (h *H) Seed(ctx context.Context) {
	var n int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	if n > 0 {
		return
	}
	mk := func(name, email, pw, role string) int64 {
		p, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		var i int64
		h.DB.QueryRow(ctx, `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id`, name, email, string(p), role).Scan(&i)
		return i
	}
	r := mk("Azeem Tahir Rider", "rider@gmail.com", "FreshCart123", "rider")
	h.DB.Exec(ctx, `INSERT INTO riders(user_id,vehicle) VALUES($1,'Bike')`, r)
	mk("FreshCart Admin", "admin@gmail.com", "FreshCart123", "admin")
	mk("Azeem Tahir Customer", "customer@gmail.com", "FreshCart123", "customer")
	for day := 0; day < 14; day++ {
		d := time.Now().AddDate(0, 0, day).Format("2006-01-02")
		for _, x := range [][2]string{{"9:00", "10:00"}, {"10:00", "11:00"}, {"11:00", "12:00"}, {"12:00", "13:00"}, {"13:00", "14:00"}, {"14:00", "15:00"}, {"15:00", "16:00"}, {"16:00", "17:00"}, {"17:00", "18:00"}} {
			h.DB.Exec(ctx, `INSERT INTO time_slots(slot_date,start_time,end_time,max_orders,is_active) VALUES($1,$2,$3,10,true) ON CONFLICT DO NOTHING`, d, x[0], x[1])
		}
	}
}
