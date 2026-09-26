package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"net/smtp"
	"strings"
	"time"
)

func (h *H) Register(c *gin.Context) {
	var x struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}

	if c.ShouldBindJSON(&x) != nil ||
		len(strings.TrimSpace(x.Name)) < 2 ||
		!strings.Contains(x.Email, "@") ||
		len(x.Password) < 8 {
		err(c, 400, fmt.Errorf(
			"valid name, email and password (8+ characters) required",
		))
		return
	}

	x.Name = strings.TrimSpace(x.Name)
	x.Email = strings.ToLower(strings.TrimSpace(x.Email))
	x.Phone = strings.TrimSpace(x.Phone)

	// Check email and phone before creating the account.
	var exists bool

	e := h.DB.QueryRow(c, `
		SELECT EXISTS(
			SELECT 1
			FROM users
			WHERE LOWER(email) = LOWER($1)
			   OR phone = $2
		)
	`, x.Email, x.Phone).Scan(&exists)

	if e != nil {
		err(c, 500, e)
		return
	}

	if exists {
		var emailExists, phoneExists bool

		e = h.DB.QueryRow(c, `
			SELECT
				EXISTS(
					SELECT 1
					FROM users
					WHERE LOWER(email) = LOWER($1)
				),
				EXISTS(
					SELECT 1
					FROM users
					WHERE phone = $2
				)
		`, x.Email, x.Phone).Scan(
			&emailExists,
			&phoneExists,
		)

		if e != nil {
			err(c, 500, e)
			return
		}

		if emailExists && phoneExists {
			err(c, 409, fmt.Errorf(
				"email and phone number are already registered",
			))
			return
		}

		if emailExists {
			err(c, 409, fmt.Errorf(
				"email is already registered",
			))
			return
		}

		if phoneExists {
			err(c, 409, fmt.Errorf(
				"phone number is already registered",
			))
			return
		}
	}

	ph, e := bcrypt.GenerateFromPassword(
		[]byte(x.Password),
		bcrypt.DefaultCost,
	)

	if e != nil {
		err(c, 500, e)
		return
	}

	var uid int64
	var role string
	var active bool

	e = h.DB.QueryRow(c, `
		INSERT INTO users(
			name,
			email,
			phone,
			password_hash
		)
		VALUES($1, $2, $3, $4)
		RETURNING id, role, is_active
	`,
		x.Name,
		x.Email,
		x.Phone,
		string(ph),
	).Scan(
		&uid,
		&role,
		&active,
	)

	if e != nil {
		err(c, 409, fmt.Errorf(
			"email or phone number may already be registered",
		))
		return
	}

	c.JSON(201, gin.H{
		"token": h.jwt(uid, role),
		"user": gin.H{
			"id":        uid,
			"name":      x.Name,
			"email":     x.Email,
			"phone":     x.Phone,
			"role":      role,
			"is_active": active,
		},
	})
}
func (h *H) Login(c *gin.Context) {
	var x struct{ Email, Password string }
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("invalid login"))
		return
	}
	var uid int64
	var name, email, phone, hash, role string
	var active bool
	e := h.DB.QueryRow(c, `SELECT id,name,email,COALESCE(phone,''),password_hash,role,is_active FROM users WHERE email=$1`, strings.ToLower(x.Email)).Scan(&uid, &name, &email, &phone, &hash, &role, &active)
	if e != nil || !active || bcrypt.CompareHashAndPassword([]byte(hash), []byte(x.Password)) != nil {
		err(c, 401, fmt.Errorf("invalid email or password"))
		return
	}
	c.JSON(200, gin.H{"token": h.jwt(uid, role), "user": gin.H{"id": uid, "name": name, "email": email, "phone": phone, "role": role, "is_active": active}})
}
func (h *H) ForgotPassword(c *gin.Context) {
	var x struct {
		Email string `json:"email"`
	}

	if c.ShouldBindJSON(&x) != nil || !strings.Contains(strings.TrimSpace(x.Email), "@") {
		err(c, 400, fmt.Errorf("valid email address required"))
		return
	}

	email := strings.ToLower(strings.TrimSpace(x.Email))

	var uid int64
	var name string

	e := h.DB.QueryRow(
		c,
		`SELECT id, name FROM users WHERE email=$1 AND is_active=true`,
		email,
	).Scan(&uid, &name)

	// Email is not registered
	if e == pgx.ErrNoRows {
		c.JSON(404, gin.H{
			"message": "This email is not registered with FreshCart.",
		})
		return
	}

	// Database error
	if e != nil {
		err(c, 500, e)
		return
	}

	// Generate 6-digit OTP
	b := make([]byte, 4)
	if _, e = rand.Read(b); e != nil {
		err(c, 500, e)
		return
	}

	otp := fmt.Sprintf(
		"%06d",
		(int(b[0])<<16|int(b[1])<<8|int(b[2]))%1000000,
	)

	// Hash OTP before storing
	hash := fmt.Sprintf(
		"%x",
		sha256.Sum256([]byte(otp)),
	)

	// Invalidate previous unused reset codes
	_, _ = h.DB.Exec(
		c,
		`UPDATE password_reset_tokens
		 SET used_at=now()
		 WHERE user_id=$1 AND used_at IS NULL`,
		uid,
	)

	// Store new OTP
	_, e = h.DB.Exec(
		c,
		`INSERT INTO password_reset_tokens
		 (user_id, token_hash, expires_at)
		 VALUES($1, $2, now()+interval '10 minutes')`,
		uid,
		hash,
	)

	if e != nil {
		err(c, 500, e)
		return
	}

	// Send email
	if h.C.SMTPHost != "" &&
		h.C.SMTPUsername != "" &&
		h.C.SMTPPassword != "" {

		auth := smtp.PlainAuth(
			"",
			h.C.SMTPUsername,
			h.C.SMTPPassword,
			h.C.SMTPHost,
		)

		subject := "FreshCart password reset code"

		body := fmt.Sprintf(
			"Hello %s,\n\n"+
				"Your FreshCart password reset code is: %s\n\n"+
				"This code expires in 10 minutes.\n\n"+
				"If you did not request this, you can ignore this email.\n",
			name,
			otp,
		)

		msg := []byte(
			"From: " + h.C.SMTPFrom + "\r\n" +
				"To: " + email + "\r\n" +
				"Subject: " + subject + "\r\n" +
				"Content-Type: text/plain; charset=UTF-8\r\n" +
				"\r\n" +
				body,
		)

		if e = smtp.SendMail(
			h.C.SMTPHost+":"+h.C.SMTPPort,
			auth,
			h.C.SMTPFrom,
			[]string{email},
			msg,
		); e != nil {
			fmt.Printf("password reset email failed: %v\n", e)

			err(c, 500, fmt.Errorf("failed to send reset email"))
			return
		}
	} else {
		// Development fallback
		fmt.Printf(
			"FreshCart password reset OTP for %s: %s\n",
			email,
			otp,
		)
	}

	c.JSON(200, gin.H{
		"message": "A verification code has been sent to your email.",
	})
}
func (h *H) ResetPassword(c *gin.Context) {
	var x struct{ Email, OTP, Password string }
	if c.ShouldBindJSON(&x) != nil || !strings.Contains(strings.TrimSpace(x.Email), "@") || len(x.OTP) != 6 || len(x.Password) < 8 {
		err(c, 400, fmt.Errorf("email, 6-digit verification code and 8+ character password are required"))
		return
	}
	email := strings.ToLower(strings.TrimSpace(x.Email))
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(strings.TrimSpace(x.OTP))))
	var uid int64
	e := h.DB.QueryRow(c, `SELECT u.id FROM users u JOIN password_reset_tokens p ON p.user_id=u.id WHERE u.email=$1 AND p.token_hash=$2 AND p.used_at IS NULL AND p.expires_at>now() ORDER BY p.created_at DESC LIMIT 1`, email, hash).Scan(&uid)
	if e != nil {
		err(c, 400, fmt.Errorf("invalid or expired verification code"))
		return
	}
	ph, e := bcrypt.GenerateFromPassword([]byte(x.Password), bcrypt.DefaultCost)
	if e != nil {
		err(c, 500, e)
		return
	}
	tx, e := h.DB.Begin(c)
	if e != nil {
		err(c, 500, e)
		return
	}
	defer tx.Rollback(c)
	if _, e = tx.Exec(c, `UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2`, string(ph), uid); e != nil {
		err(c, 500, e)
		return
	}
	if _, e = tx.Exec(c, `UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND token_hash=$2`, uid, hash); e != nil {
		err(c, 500, e)
		return
	}
	if e = tx.Commit(c); e != nil {
		err(c, 500, e)
		return
	}
	c.JSON(200, gin.H{"message": "Password reset successfully. You can now sign in."})
}
func (h *H) jwt(uid int64, role string) string {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": uid, "role": role, "exp": time.Now().Add(7 * 24 * time.Hour).Unix()})
	s, _ := t.SignedString([]byte(h.C.JWTSecret))
	return s
}
