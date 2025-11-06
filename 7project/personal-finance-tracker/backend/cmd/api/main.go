// backend/cmd/api/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"pft/internal/handler"
	"pft/internal/platform"
	"pft/internal/repo"
)

func main() {
	// Load config (PORT, DB_DSN, JWT_SECRET)
	cfg := platform.Load()

	// --- DB pool ---
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pcfg, err := pgxpool.ParseConfig(cfg.DB_DSN)
	if err != nil {
		log.Fatalf("pgx parse config: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, pcfg)
	if err != nil {
		log.Fatalf("pgxpool new: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	// --- Migrations ---
	if err := platform.RunMigrations(ctx, pool, "/migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// --- Dependencies ---
	store := repo.New(pool)
	api := handler.New(store, cfg.JWTSecret)

	// --- HTTP server (Gin) ---
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	_ = r.SetTrustedProxies(nil)

	// Public endpoints
	r.GET("/api/healthz", api.Healthz)
	r.POST("/api/register", api.Register)
	r.POST("/api/login", api.Login)

	// Authenticated endpoints
	authMw := handler.JWTMiddleware(handler.AuthConfig{JWTSecret: cfg.JWTSecret})
	auth := r.Group("/api", authMw)

	// Me
	auth.GET("/me", api.Me)

	// Categories
	auth.GET("/categories", api.ListCategories)
	auth.POST("/categories", api.CreateCategory)
	auth.PUT("/categories/:id", api.UpdateCategory)
	auth.DELETE("/categories/:id", api.DeleteCategory)

	// Transactions
	auth.GET("/transactions", api.ListTransactions)
	auth.POST("/transactions", api.CreateTransaction)
	auth.PUT("/transactions/:id", api.UpdateTransaction)
	auth.DELETE("/transactions/:id", api.DeleteTransaction)

	// Budgets
	auth.GET("/budgets", api.ListBudgets)
	auth.POST("/budgets", api.CreateBudget)
	auth.PUT("/budgets/:id", api.UpdateBudget)
	auth.DELETE("/budgets/:id", api.DeleteBudget)

	// Dashboard
	auth.GET("/dashboard/summary", api.MonthSummary)

	// HTTP server + graceful shutdown
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}
	log.Println("server stopped cleanly")
}
