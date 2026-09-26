package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

type expoPushMessage struct {
	To          string           `json:"to"`
	Title       string           `json:"title"`
	Body        string           `json:"body"`
	Sound       string           `json:"sound,omitempty"`
	Priority    string           `json:"priority,omitempty"`
	ChannelID   string           `json:"channelId,omitempty"`
	Data        map[string]any   `json:"data,omitempty"`
	RichContent *expoRichContent `json:"richContent,omitempty"`
}

type expoRichContent struct {
	Image string `json:"image,omitempty"`
}

type expoPushResponse struct {
	Data []struct {
		Status  string `json:"status"`
		ID      string `json:"id"`
		Message string `json:"message"`
		Details struct {
			Error string `json:"error"`
		} `json:"details"`
	} `json:"data"`
}

func sendPush(
	tokens []string,
	title string,
	body string,
	data map[string]any,
) error {
	if len(tokens) == 0 {
		log.Printf("[PUSH] No push tokens for: %s", title)
		return nil
	}

	var allErr error

	for start := 0; start < len(tokens); start += 100 {
		end := start + 100

		if end > len(tokens) {
			end = len(tokens)
		}

		messages := make([]expoPushMessage, 0, end-start)

		for _, rawToken := range tokens[start:end] {
			token := strings.TrimSpace(rawToken)

			if token == "" {
				continue
			}

			if !strings.HasPrefix(
				token,
				"ExponentPushToken[",
			) {
				log.Printf(
					"[PUSH] Invalid Expo token skipped: %s",
					token,
				)
				continue
			}

			message := expoPushMessage{
				To:        token,
				Title:     title,
				Body:      body,
				Sound:     "default",
				Priority:  "high",
				ChannelID: "freshcart-high",
				Data:      data,
			}

			// Optional notification/product image.
			imageURL := ""

			if data != nil {
				if value, ok := data["image"].(string); ok {
					imageURL = strings.TrimSpace(value)
				}

				if imageURL == "" {
					if value, ok := data["product_image"].(string); ok {
						imageURL = strings.TrimSpace(value)
					}
				}

				if imageURL == "" {
					if value, ok := data["image_url"].(string); ok {
						imageURL = strings.TrimSpace(value)
					}
				}
			}

			if imageURL != "" {
				message.RichContent = &expoRichContent{
					Image: imageURL,
				}
			}

			messages = append(messages, message)
		}

		if len(messages) == 0 {
			continue
		}

		payload, marshalErr := json.Marshal(messages)
		if marshalErr != nil {
			allErr = fmt.Errorf(
				"marshal Expo push payload: %w",
				marshalErr,
			)

			log.Printf(
				"[PUSH] JSON marshal error: %v",
				marshalErr,
			)

			continue
		}

		req, requestErr := http.NewRequest(
			http.MethodPost,
			expoPushEndpoint,
			bytes.NewReader(payload),
		)

		if requestErr != nil {
			allErr = fmt.Errorf(
				"create Expo push request: %w",
				requestErr,
			)

			log.Printf(
				"[PUSH] Request creation error: %v",
				requestErr,
			)

			continue
		}

		req.Header.Set(
			"Accept",
			"application/json",
		)

		req.Header.Set(
			"Content-Type",
			"application/json",
		)

		req.Header.Set(
			"Accept-Encoding",
			"gzip, deflate",
		)

		client := &http.Client{
			Timeout: 15 * time.Second,
		}

		resp, requestErr := client.Do(req)

		if requestErr != nil {
			allErr = fmt.Errorf(
				"send Expo push request: %w",
				requestErr,
			)

			log.Printf(
				"[PUSH] Expo request error: %v",
				requestErr,
			)

			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()

		if readErr != nil {
			allErr = fmt.Errorf(
				"read Expo push response: %w",
				readErr,
			)

			log.Printf(
				"[PUSH] Response read error: %v",
				readErr,
			)

			continue
		}

		log.Printf(
			"[PUSH] Expo response status=%d body=%s",
			resp.StatusCode,
			string(respBody),
		)

		if resp.StatusCode < 200 ||
			resp.StatusCode >= 300 {
			allErr = fmt.Errorf(
				"Expo push returned HTTP %d: %s",
				resp.StatusCode,
				string(respBody),
			)

			continue
		}

		var result expoPushResponse

		decodeErr := json.Unmarshal(
			respBody,
			&result,
		)

		if decodeErr != nil {
			allErr = fmt.Errorf(
				"decode Expo push response: %w",
				decodeErr,
			)

			continue
		}

		for _, ticket := range result.Data {
			if ticket.Status != "error" {
				log.Printf(
					"[PUSH] Expo ticket OK id=%s",
					ticket.ID,
				)

				continue
			}

			reason := ticket.Details.Error

			if reason == "" {
				reason = ticket.Message
			}

			if reason == "" {
				reason = "unknown Expo push error"
			}

			log.Printf(
				"[PUSH] Expo ticket ERROR id=%s reason=%s",
				ticket.ID,
				reason,
			)

			allErr = fmt.Errorf(
				"Expo push rejected notification: %s",
				reason,
			)
		}
	}

	return allErr
}

func (h *H) PushToken(c *gin.Context) {
	var x struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}

	if bindErr := c.ShouldBindJSON(&x); bindErr != nil {
		err(c, 400, fmt.Errorf(
			"invalid push token request: %w",
			bindErr,
		))
		return
	}

	x.Token = strings.TrimSpace(x.Token)
	x.Platform = strings.TrimSpace(x.Platform)

	if !strings.HasPrefix(
		x.Token,
		"ExponentPushToken[",
	) {
		err(
			c,
			400,
			fmt.Errorf("valid Expo push token required"),
		)
		return
	}

	if x.Platform == "" {
		x.Platform = "unknown"
	}

	_, dbErr := h.DB.Exec(
		c,
		`INSERT INTO push_tokens(
			user_id,
			token,
			platform,
			updated_at
		)
		VALUES(
			$1,
			$2,
			$3,
			now()
		)
		ON CONFLICT(token)
		DO UPDATE SET
			user_id=EXCLUDED.user_id,
			platform=EXCLUDED.platform,
			updated_at=now()`,
		id(c),
		x.Token,
		x.Platform,
	)

	if dbErr != nil {
		err(c, 500, dbErr)
		return
	}

	log.Printf(
		"[PUSH] Token registered successfully user=%d platform=%s",
		id(c),
		x.Platform,
	)

	c.JSON(
		200,
		gin.H{
			"ok": true,
		},
	)
}

func (h *H) pushTokensForUser(
	ctx context.Context,
	userID int64,
) []string {
	rows, queryErr := h.DB.Query(
		ctx,
		`SELECT token
		 FROM push_tokens
		 WHERE user_id=$1`,
		userID,
	)

	if queryErr != nil {
		log.Printf(
			"[PUSH] Failed to get tokens for user %d: %v",
			userID,
			queryErr,
		)

		return nil
	}

	defer rows.Close()

	var tokens []string

	for rows.Next() {
		var token string

		if scanErr := rows.Scan(&token); scanErr == nil {
			token = strings.TrimSpace(token)

			if token != "" {
				tokens = append(tokens, token)
			}
		}
	}

	return tokens
}

func (h *H) pushTokensForRole(
	ctx context.Context,
	role string,
) []string {
	rows, queryErr := h.DB.Query(
		ctx,
		`SELECT pt.token
		 FROM push_tokens pt
		 JOIN users u
		   ON u.id=pt.user_id
		 WHERE u.role=$1
		   AND u.is_active=true`,
		role,
	)

	if queryErr != nil {
		log.Printf(
			"[PUSH] Failed to get tokens for role %s: %v",
			role,
			queryErr,
		)

		return nil
	}

	defer rows.Close()

	var tokens []string

	for rows.Next() {
		var token string

		if scanErr := rows.Scan(&token); scanErr == nil {
			token = strings.TrimSpace(token)

			if token != "" {
				tokens = append(tokens, token)
			}
		}
	}

	return tokens
}

func (h *H) insertNotification(
	ctx context.Context,
	userID int64,
	title string,
	message string,
	typ string,
	data map[string]any,
) error {
	raw, marshalErr := json.Marshal(data)

	if marshalErr != nil {
		return fmt.Errorf(
			"marshal notification data: %w",
			marshalErr,
		)
	}

	_, dbErr := h.DB.Exec(
		ctx,
		`INSERT INTO notifications(
			user_id,
			title,
			message,
			type,
			data
		)
		VALUES(
			$1,
			$2,
			$3,
			$4,
			$5::jsonb
		)`,
		userID,
		title,
		message,
		typ,
		string(raw),
	)

	return dbErr
}
