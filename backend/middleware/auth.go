package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
	"strings"
)

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		s := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		t, e := jwt.Parse(s, func(t *jwt.Token) (any, error) { return []byte(secret), nil })
		if e != nil || !t.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authentication"})
			return
		}
		cl, ok := t.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid claims"})
			return
		}
		uid, ok1 := cl["user_id"].(float64)
		role, ok2 := cl["role"].(string)
		if !ok1 || !ok2 {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid claims"})
			return
		}
		c.Set("user_id", int64(uid))
		c.Set("role", role)
		c.Next()
	}
}
func Role(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		r, _ := c.Get("role")
		for _, x := range roles {
			if r == x {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(403, gin.H{"error": "insufficient permissions"})
	}
}
