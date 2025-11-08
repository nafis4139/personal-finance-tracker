// backend/internal/handler/transaction.go

package handler

import (
	"net/http"
	"strconv"
	"time"

	"pft/internal/repo"

	"github.com/gin-gonic/gin"
)

// txnCreateReq describes the expected payload for creating or updating a transaction.
// - CategoryID: required category identifier
// - Amount: positive or negative values allowed depending on type semantics
// - Type: must be "income" or "expense"
// - Date: expected in YYYY-MM-DD format
// - Description: optional free-text note
type txnCreateReq struct {
	CategoryID  int64   `json:"category_id" binding:"required"`
	Amount      float64 `json:"amount" binding:"required"`
	Type        string  `json:"type" binding:"required,oneof=income expense"`
	Date        string  `json:"date" binding:"required"` // YYYY-MM-DD
	Description string  `json:"description"`
}

// Alias to reuse the same validation and fields for updates.
type txnUpdateReq = txnCreateReq

// ListTransactions returns paginated transactions for the authenticated user.
// Optional filters:
// - from/to: date range in YYYY-MM-DD
// - type: "income" or "expense"
// - category_id: integer category filter
// - limit/offset: pagination (offset is a row index, not a page number)
func (api *API) ListTransactions(c *gin.Context) {
	userID := MustUserID(c)
	var (
		fromStr = c.Query("from")
		toStr   = c.Query("to")
		typ     = c.Query("type")
		cidStr  = c.Query("category_id")
	)

	// Parse optional date bounds; ignore invalid formats silently.
	var from, to *time.Time
	if fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = &t
		}
	}
	if toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			to = &t
		}
	}

	// Normalize and validate optional type filter.
	var typePtr *string
	if typ == "income" || typ == "expense" {
		typePtr = &typ
	}

	// Parse optional category ID.
	var cidPtr *int64
	if cidStr != "" {
		if v, err := strconv.ParseInt(cidStr, 10, 64); err == nil {
			cidPtr = &v
		}
	}

	// --- limit / offset with sane defaults and clamps ---
	limit := asInt(c.Query("limit"), 500)
	if limit <= 0 {
		limit = 500
	}
	if limit > 5000 {
		limit = 5000
	}
	offset := asInt(c.Query("offset"), 0)
	if offset < 0 {
		offset = 0
	}

	// Query repository with assembled filters and pagination.
	list, err := api.Repos.TransactionRepo().List(c.Request.Context(), userID, repo.TxnListFilter{
		From:       from,
		To:         to,
		CategoryID: cidPtr,
		Type:       typePtr,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateTransaction inserts a new transaction row.
// Validates payload, parses the date, and passes a pointer for CategoryID to support nullable DB columns.
func (api *API) CreateTransaction(c *gin.Context) {
	userID := MustUserID(c)
	var req txnCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid"})
		return
	}
	d, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_date"})
		return
	}
	// Use a local variable so a pointer can be passed to the repo model.
	cid := req.CategoryID
	t := &repo.Transaction{
		UserID:      userID,
		CategoryID:  &cid,
		Amount:      req.Amount,
		Type:        req.Type,
		Date:        d,
		Description: req.Description,
	}
	out, err := api.Repos.TransactionRepo().Create(c.Request.Context(), t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server"})
		return
	}
	c.JSON(http.StatusCreated, out)
}

// UpdateTransaction modifies a transaction identified by path parameter :id.
// Applies the same validation and parsing rules as creation.
func (api *API) UpdateTransaction(c *gin.Context) {
	userID := MustUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var req txnUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid"})
		return
	}
	d, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_date"})
		return
	}
	cid := req.CategoryID
	t := &repo.Transaction{
		CategoryID:  &cid,
		Amount:      req.Amount,
		Type:        req.Type,
		Date:        d,
		Description: req.Description,
	}
	out, err := api.Repos.TransactionRepo().Update(c.Request.Context(), userID, id, t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server"})
		return
	}
	c.JSON(http.StatusOK, out)
}

// DeleteTransaction removes a transaction by ID for the authenticated user.
// Returns 204 on success, 404 if not found, or 500 on repository errors.
func (api *API) DeleteTransaction(c *gin.Context) {
	userID := MustUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ok, err := api.Repos.TransactionRepo().Delete(c.Request.Context(), userID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server"})
		return
	}
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// asInt parses a string into an int with a default fallback.
// Returns def when s is empty or cannot be parsed as a base-10 integer.
func asInt(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
