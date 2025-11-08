// backend/internal/repo/transaction.go

package repo

import (
	"context"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Transaction is the repository-layer DTO mirroring the transactions table.
// CategoryID is nullable (ON DELETE SET NULL). Description is stored as text.
type Transaction struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	CategoryID  *int64    `json:"category_id"` // nullable because of ON DELETE SET NULL
	Amount      float64   `json:"amount"`
	Type        string    `json:"type"` // "income" | "expense"
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// TransactionRepo provides CRUD and list operations for transactions via pgx.
type TransactionRepo struct{ pool *pgxpool.Pool }

// TransactionRepo accessor bound to the Store's pool.
func (s *Store) TransactionRepo() *TransactionRepo { return &TransactionRepo{pool: s.Pool} }

// TxnListFilter captures optional filters and pagination for listing queries.
// - From/To: inclusive date range bounds
// - CategoryID: limit to a specific category
// - Type: limit to "income" or "expense"
// - Limit/Offset: pagination parameters
type TxnListFilter struct {
	From       *time.Time
	To         *time.Time
	CategoryID *int64
	Type       *string
	Limit      int
	Offset     int
}

// List returns transactions for a user with optional filters and pagination.
// Builds SQL dynamically with positional parameters ($1, $2, ...) to avoid injection.
func (r *TransactionRepo) List(ctx context.Context, userID int64, f TxnListFilter) ([]Transaction, error) {
	q := `SELECT id, user_id, category_id, amount, type, date, description, created_at
	      FROM transactions
	      WHERE user_id=$1`
	args := []any{userID}
	i := 2

	// Conditionally append filters; positional placeholders are generated with itoa.
	if f.From != nil {
		q += " AND date >= $" + itoa(i)
		args = append(args, *f.From)
		i++
	}
	if f.To != nil {
		q += " AND date <= $" + itoa(i)
		args = append(args, *f.To)
		i++
	}
	if f.CategoryID != nil {
		q += " AND category_id = $" + itoa(i)
		args = append(args, *f.CategoryID)
		i++
	}
	if f.Type != nil {
		q += " AND type = $" + itoa(i)
		args = append(args, *f.Type)
		i++
	}

	// Ascending order feels natural for Jan→Dec charts; id tie-breaker for stability.
	q += " ORDER BY date ASC, id ASC"

	// Guardrails for pagination inputs.
	// Generous defaults and upper bounds so the yearly view can fetch everything in one go.
	if f.Limit <= 0 || f.Limit > 5000 {
		f.Limit = 500
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	q += " LIMIT $" + itoa(i)
	args = append(args, f.Limit)
	i++
	q += " OFFSET $" + itoa(i)
	args = append(args, f.Offset)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Transaction
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.CategoryID, &t.Amount, &t.Type, &t.Date, &t.Description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Create inserts a new transaction and returns the inserted row with timestamps.
func (r *TransactionRepo) Create(ctx context.Context, t *Transaction) (*Transaction, error) {
	const q = `INSERT INTO transactions (user_id, category_id, amount, type, date, description)
	           VALUES ($1,$2,$3,$4,$5,$6)
	           RETURNING id, user_id, category_id, amount, type, date, description, created_at`
	var out Transaction
	if err := r.pool.QueryRow(ctx, q,
		t.UserID, t.CategoryID, t.Amount, t.Type, t.Date, t.Description,
	).Scan(
		&out.ID, &out.UserID, &out.CategoryID, &out.Amount, &out.Type, &out.Date, &out.Description, &out.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update modifies an existing transaction (scoped by userID) and returns the updated row.
// Matching on both user_id and id enforces tenant isolation at the SQL level.
func (r *TransactionRepo) Update(ctx context.Context, userID, id int64, t *Transaction) (*Transaction, error) {
	const q = `UPDATE transactions
	           SET category_id=$3, amount=$4, type=$5, date=$6, description=$7
	           WHERE user_id=$1 AND id=$2
	           RETURNING id, user_id, category_id, amount, type, date, description, created_at`
	var out Transaction
	if err := r.pool.QueryRow(ctx, q,
		userID, id, t.CategoryID, t.Amount, t.Type, t.Date, t.Description,
	).Scan(
		&out.ID, &out.UserID, &out.CategoryID, &out.Amount, &out.Type, &out.Date, &out.Description, &out.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a transaction by id for the given user.
// Returns true when a row was affected; false indicates no match.
func (r *TransactionRepo) Delete(ctx context.Context, userID, id int64) (bool, error) {
	const q = `DELETE FROM transactions WHERE user_id=$1 AND id=$2`
	ct, err := r.pool.Exec(ctx, q, userID, id)
	if err != nil {
		return false, err
	}
	return ct.RowsAffected() > 0, nil
}

// itoa converts an integer to a string for SQL placeholder construction.
func itoa(i int) string { return strconv.Itoa(i) }
