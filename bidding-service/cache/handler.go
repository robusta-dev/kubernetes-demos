package cache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/robusta-dev/bidding-service/internal/metrics"
	"go.uber.org/zap"
)

const (
	// DefaultBidCacheTTL is the default time-to-live for cached bid entries.
	// A 5-minute TTL balances freshness with cache hit rate for auction data.
	DefaultBidCacheTTL = 300 * time.Second
)

type BidCacheHandler struct {
	client     *redis.Client
	logger     *zap.Logger
	mu         sync.RWMutex
	hitCount   int64
	missCount  int64
}

func NewBidCacheHandler(client *redis.Client, logger *zap.Logger) *BidCacheHandler {
	return &BidCacheHandler{
		client: client,
		logger: logger,
	}
}

// GetCachedBid retrieves a cached bid response for the given auction ID.
// Returns nil if the bid is not found in cache.
func (h *BidCacheHandler) GetCachedBid(ctx context.Context, auctionID string) ([]byte, error) {
	key := fmt.Sprintf("bid:auction:%s", auctionID)

	val, err := h.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		h.mu.Lock()
		h.missCount++
		h.mu.Unlock()
		metrics.BidCacheMisses.Inc()
		return nil, nil
	}
	if err != nil {
		h.logger.Error("cache lookup failed", zap.String("auction_id", auctionID), zap.Error(err))
		return nil, fmt.Errorf("cache get failed: %w", err)
	}

	h.mu.Lock()
	h.hitCount++
	h.mu.Unlock()
	metrics.BidCacheHits.Inc()
	return val, nil
}

// SetCachedBid stores a bid response in cache with the configured TTL.
func (h *BidCacheHandler) SetCachedBid(ctx context.Context, auctionID string, data []byte) error {
	key := fmt.Sprintf("bid:auction:%s", auctionID)
	ttl := DefaultBidCacheTTL

	if err := h.client.Set(ctx, key, data, ttl).Err(); err != nil {
		h.logger.Error("cache write failed",
			zap.String("auction_id", auctionID),
			zap.Duration("ttl", ttl),
			zap.Error(err),
		)
		return fmt.Errorf("cache set failed: %w", err)
	}

	h.logger.Debug("bid cached",
		zap.String("auction_id", auctionID),
		zap.Duration("ttl", ttl),
		zap.Int("data_size", len(data)),
	)
	return nil
}

// Stats returns current cache hit/miss statistics.
func (h *BidCacheHandler) Stats() (hits, misses int64) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.hitCount, h.missCount
}
