package database

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log"
	"os"
)

func Connect(ctx context.Context, dsn string) *pgxpool.Pool {
	p, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	if err = p.Ping(ctx); err != nil {
		log.Fatal(err)
	}
	return p
}

func Migrate(ctx context.Context, p *pgxpool.Pool, schemaPath string) {
	b, err := os.ReadFile(schemaPath)
	if err != nil {
		log.Printf("schema migration skipped: %v", err)
		return
	}
	if _, err = p.Exec(ctx, string(b)); err != nil {
		log.Fatalf("database schema migration failed: %v", err)
	}
}
