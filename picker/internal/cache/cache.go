// Package cache provides a small key/value cache with TTLs, backed by Redis
// when available and by process memory otherwise.
package cache

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration)
}

// New returns a Redis-backed cache if redisURL is set and reachable,
// otherwise an in-memory cache.
func New(ctx context.Context, redisURL string) (Cache, string) {
	if redisURL != "" {
		opts, err := redis.ParseURL(redisURL)
		if err == nil {
			client := redis.NewClient(opts)
			pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			defer cancel()
			if err := client.Ping(pingCtx).Err(); err == nil {
				return &redisCache{client: client}, "redis"
			}
		}
	}
	return &memoryCache{items: map[string]memItem{}}, "memory"
}

type redisCache struct{ client *redis.Client }

func (r *redisCache) Get(ctx context.Context, key string) ([]byte, bool) {
	b, err := r.client.Get(ctx, "cynatra:"+key).Bytes()
	if err != nil {
		return nil, false
	}
	return b, true
}

func (r *redisCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) {
	_ = r.client.Set(ctx, "cynatra:"+key, val, ttl).Err()
}

type memItem struct {
	val     []byte
	expires time.Time
}

type memoryCache struct {
	mu    sync.RWMutex
	items map[string]memItem
}

func (m *memoryCache) Get(_ context.Context, key string) ([]byte, bool) {
	m.mu.RLock()
	it, ok := m.items[key]
	m.mu.RUnlock()
	if !ok || time.Now().After(it.expires) {
		return nil, false
	}
	return it.val, true
}

func (m *memoryCache) Set(_ context.Context, key string, val []byte, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Opportunistic sweep so the map doesn't grow forever.
	if len(m.items) > 5000 {
		now := time.Now()
		for k, it := range m.items {
			if now.After(it.expires) {
				delete(m.items, k)
			}
		}
	}
	m.items[key] = memItem{val: val, expires: time.Now().Add(ttl)}
}
