package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"freshcart/backend/services"
	"github.com/gin-gonic/gin"
	"strings"
	"time"
)

func (h *H) JazzInitiate(c *gin.Context) {
	var x struct {
		OrderID int64 `json:"order_id"`
	}
	if c.ShouldBindJSON(&x) != nil {
		err(c, 400, fmt.Errorf("order_id required"))
		return
	}
	var total float64
	var pm string
	if e := h.DB.QueryRow(c, `SELECT total,payment_method FROM orders WHERE id=$1 AND user_id=$2`, x.OrderID, id(c)).Scan(&total, &pm); e != nil || pm != "jazzcash" {
		err(c, 400, fmt.Errorf("JazzCash order not found"))
		return
	}
	b := make([]byte, 6)
	rand.Read(b)
	txn := "FC" + time.Now().Format("20060102150405") + hex.EncodeToString(b)
	if _, e := h.DB.Exec(c, `INSERT INTO payments(order_id,txn_ref,amount) VALUES($1,$2,$3)`, x.OrderID, txn, total); e != nil {
		err(c, 409, fmt.Errorf("payment already initiated"))
		return
	}
	r, e := h.J.Initiate(c, txn, total, fmt.Sprintf("FC-%d", x.OrderID))
	if e != nil {
		h.DB.Exec(c, `UPDATE payments SET status='failed',response_message=$1 WHERE txn_ref=$2`, e.Error(), txn)
		err(c, 502, e)
		return
	}
	raw, _ := json.Marshal(r)
	responseValues := map[string]string{}
	for k, value := range r {
		responseValues[k] = fmt.Sprint(value)
	}
	if !services.Verify(responseValues, h.C.JazzCashSharedSecret) {
		h.DB.Exec(c, `UPDATE payments SET status='failed',response_message=$1,raw_response=$2,updated_at=now() WHERE txn_ref=$3`, "invalid JazzCash response signature", raw, txn)
		err(c, 502, fmt.Errorf("invalid JazzCash response signature"))
		return
	}
	code, _ := r["pp_ResponseCode"].(string)
	msg, _ := r["pp_ResponseMessage"].(string)
	st := "pending"
	if code == "000" {
		st = "paid"
	}
	h.DB.Exec(c, `UPDATE payments SET status=$1,response_code=$2,response_message=$3,raw_response=$4,updated_at=now() WHERE txn_ref=$5`, st, code, msg, raw, txn)
	if st == "paid" {
		_, _ = h.DB.Exec(c, `UPDATE orders SET status='confirmed',updated_at=now() WHERE id=$1 AND status='pending'`, x.OrderID)
	}
	c.JSON(200, gin.H{"txn_ref": txn, "status": st, "gateway_response": r})
}
func (h *H) PaymentStatus(c *gin.Context) {
	var paymentID, orderID int64
	var txn, gw, st, code, msg, rr string
	var amount float64
	e := h.DB.QueryRow(c, `SELECT id,order_id,txn_ref,gateway,amount,status,COALESCE(response_code,''),COALESCE(response_message,''),COALESCE(retrieval_reference,'') FROM payments WHERE txn_ref=$1`, c.Param("txnRef")).Scan(&paymentID, &orderID, &txn, &gw, &amount, &st, &code, &msg, &rr)
	if e != nil {
		err(c, 404, fmt.Errorf("payment not found"))
		return
	}
	var ownerID int64
	if e = h.DB.QueryRow(c, `SELECT user_id FROM orders WHERE id=$1`, orderID).Scan(&ownerID); e != nil || ownerID != id(c) {
		err(c, 403, fmt.Errorf("payment access denied"))
		return
	}
	c.JSON(200, gin.H{"id": paymentID, "order_id": orderID, "txn_ref": txn, "gateway": gw, "amount": amount, "status": st, "response_code": code, "response_message": msg, "retrieval_reference": rr})
}
func (h *H) JazzCallback(c *gin.Context) {
	if e := c.Request.ParseForm(); e != nil {
		err(c, 400, fmt.Errorf("invalid callback payload"))
		return
	}
	v := map[string]string{}
	for k, vs := range c.Request.PostForm {
		if len(vs) > 0 {
			v[k] = vs[0]
		}
	}
	if len(v) == 0 {
		var x map[string]any
		if c.ShouldBindJSON(&x) == nil {
			for k, z := range x {
				v[k] = fmt.Sprint(z)
			}
		}
	}
	if !services.Verify(v, h.C.JazzCashSharedSecret) {
		err(c, 401, fmt.Errorf("invalid payment signature"))
		return
	}

	txn := strings.TrimSpace(v["pp_TxnRefNo"])
	if txn == "" {
		err(c, 400, fmt.Errorf("transaction reference required"))
		return
	}

	var paymentID, orderID int64
	var expectedAmount float64
	e := h.DB.QueryRow(c, `SELECT id,order_id,amount FROM payments WHERE txn_ref=$1`, txn).Scan(&paymentID, &orderID, &expectedAmount)
	if e != nil {
		err(c, 404, fmt.Errorf("payment not found"))
		return
	}

	if v["pp_MerchantID"] != "" && v["pp_MerchantID"] != h.C.JazzCashMerchantID {
		err(c, 400, fmt.Errorf("invalid merchant"))
		return
	}
	if amount := strings.TrimSpace(v["pp_Amount"]); amount != "" {
		expected := fmt.Sprintf("%.0f", expectedAmount*100)
		if amount != expected {
			err(c, 400, fmt.Errorf("payment amount mismatch"))
			return
		}
	}

	code := strings.TrimSpace(v["pp_ResponseCode"])
	msg := v["pp_ResponseMessage"]
	rr := v["pp_RetreivalReferenceNo"]
	if rr == "" {
		rr = v["pp_RetrievalReferenceNo"]
	}
	st := "failed"
	if code == "000" {
		st = "paid"
	} else if code == "157" {
		st = "pending"
	}

	raw, _ := json.Marshal(v)
	_, e = h.DB.Exec(c, `UPDATE payments SET status=$1,response_code=$2,response_message=$3,retrieval_reference=$4,raw_response=$5,updated_at=now() WHERE id=$6 AND status<>'paid'`, st, code, msg, rr, raw, paymentID)
	if e != nil {
		err(c, 500, e)
		return
	}
	if st == "paid" {
		_, _ = h.DB.Exec(c, `UPDATE orders SET status='confirmed',updated_at=now() WHERE id=$1 AND status='pending'`, orderID)
	}

	c.JSON(200, gin.H{"ok": true, "txn_ref": txn, "status": st})
}
