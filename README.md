# LRU Replay Subject

[![npm version](https://badge.fury.io/js/lru-replay-subject.svg)](https://badge.fury.io/js/lru-replay-subject)

## Overview

`LRUReplaySubject` is a specialized implementation of RxJS `Subject` that combines the functionalities of least-recently-used (LRU) caching with replaying capabilities. This ensures efficient memory usage by retaining frequently accessed items and re-emitting them to new subscribers in descending order of recent usage.

## Features

- LRU cache implementation using **QuickLRU**
- Emits cached values to new subscribers
- Configurable cache size and age limits (`maxSize` and `maxAge`)
- Custom eviction notifications using `onEviction`

## Installation

```sh
npm install rxjs quick-lru delegates
```

## Usage

### Real-World Example: Stock Price Feed

Let's consider a real-world scenario where you have a real-time stock price feed, and you want to cache and replay the most recent prices to new subscribers.

```javascript
import { LRUReplaySubject, shareLRUReplay } from './path-to-lru-replay-subject';
import { interval, Subject } from 'rxjs';
import { map, take } from 'rxjs/operators';

// Simulate a real-time stock price feed
const stockPriceFeed = interval(1000).pipe(
    take(10), // Simulate 10 stock price updates
    map(i => ({ symbol: 'AAPL', price: (150 + i).toFixed(2) })) // Generate example stock price data
);

// Create an LRUReplaySubject with custom configuration
const lruReplaySubject = new LRUReplaySubject({
    maxSize: 5, // Keep the last 5 prices
    maxAge: 1000 * 60, // 1 minute
    onEviction: new Subject() // Subject to handle evictions
});

// Subscribe to eviction notifications (Optional)
lruReplaySubject.subscribe((evt) => {
    console.log('Evicted:', evt);
});

// Share the observable using LRUReplaySubject
const sharedObservable = stockPriceFeed.pipe(
    shareLRUReplay({
        maxSize: 5,
        maxAge: 1000 * 60 // 1 minute
    })
);

// Subscribe to the shared observable to receive real-time updates
const subscription1 = sharedObservable.subscribe({
    next: value => console.log('[Subscriber 1] Received:', value),
    error: err => console.error('[Subscriber 1] Error:', err),
    complete: () => console.log('[Subscriber 1] Completed')
});

// Simulate a new subscriber joining after some initial values are emitted
setTimeout(() => {
    const subscription2 = sharedObservable.subscribe({
        next: value => console.log('[Subscriber 2] Received:', value),
        error: err => console.error('[Subscriber 2] Error:', err),
        complete: () => console.log('[Subscriber 2] Completed')
    });

    // Clean up new subscriber
    setTimeout(() => {
        subscription2.unsubscribe();
    }, 7000); // Unsubscribe after 7 seconds
}, 5000); // New subscriber joins after 5 seconds

// Clean up original subscriber
setTimeout(() => {
    subscription1.unsubscribe();
}, 15000); // Unsubscribe after 15 seconds
```

### Additional Examples from Test Cases

#### 1. Eviction on Exceeding `maxSize`

```javascript
import { LRUReplaySubject } from './path-to-lru-replay-subject';
import { Subject } from 'rxjs';

const onEvictionSubject = new Subject();
onEvictionSubject.subscribe(value => {
    console.log('Evicted:', value);
});

const lruSubject = new LRUReplaySubject({ maxSize: 1, onEviction: onEvictionSubject });
lruSubject.next(1); // Adds item 1
lruSubject.next(2); // Item 1 is evicted, item 2 is added

// Output: "Evicted: 1"
```

#### 2. Eviction on Exceeding `maxAge`

```javascript
import { LRUReplaySubject } from './path-to-lru-replay-subject';
import { Subject } from 'rxjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const onEvictionSubject = new Subject();
onEvictionSubject.subscribe(value => {
    console.log('Evicted:', value);
});

const lruSubject = new LRUReplaySubject({ maxSize: 1, maxAge: 100, onEviction: onEvictionSubject });
lruSubject.next('test');

(async () => {
    await delay(200); // Wait for 200ms
    lruSubject.subscribe(value => console.log('Received:', value)); // Receives no items since 'test' is expired and evicted

    // Output: "Evicted: test"
})();
```

### Conclusion

The `LRUReplaySubject` provides a robust mechanism for managing real-time data streams with constraints on memory and time. The provided test cases ensure its reliable behavior across various scenarios.

## License

This project is licensed under the MIT License.