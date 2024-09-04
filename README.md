# LRU Replay Subject

## Overview

`LRUReplaySubject` is a specialized implementation of RxJS `Subject` that combines the functionalities of least-recently-used (LRU) caching with replaying capabilities. This ensures efficient memory usage by retaining frequently accessed items and re-emitting them to new subscribers in descending order of recent usage.

## Features

- **LRU Cache Implementation**: Efficiently caches and manages data using `QuickLRU`.
- **Replay Cached Values**: Emits cached values to new subscribers.
- **Configurable Cache**: Supports `maxSize` and `maxAge` limits for the cache.
- **Eviction Notifications**: Notifies about evicted items via `onEviction`.

## Installation

```sh
npm install lrureplaysubject
```

## Usage

### Real-World Example: Stock Price Feed

Let's consider a real-world scenario where you have a real-time stock price feed, and you want to cache and replay the most recent prices to new subscribers.

```javascript
import { LRUReplaySubject, shareLRUReplay } from 'lrureplaysubject';
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

// Log eviction notifications (Optional)
lruReplaySubject.onEviction.subscribe((value) => {
    console.log('Evicted:', value);
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

    // Clean up the new subscriber
    setTimeout(() => {
        subscription2.unsubscribe();
    }, 7000); // Unsubscribe after 7 seconds
}, 5000); // New subscriber joins after 5 seconds

// Clean up the original subscriber
setTimeout(() => {
    subscription1.unsubscribe();
}, 15000); // Unsubscribe after 15 seconds
```

### Additional Examples from Test Cases

#### 1. Eviction on Exceeding `maxSize`

```javascript
import { LRUReplaySubject } from 'lrureplaysubject';
import { Subject } from 'rxjs';

const onEvictionSubject = new Subject();
onEvictionSubject.subscribe(value => {
    console.log('Evicted:', value);
});

const lruSubject = new LRUReplaySubject({ maxSize: 1, onEviction: onEvictionSubject });
lruSubject.next(1); // Adds item 1
lruSubject.next(2); // Item 1 is evicted, item 2 is added

// Subscribe to the subject to receive cached values
lruSubject.subscribe(value => {
    console.log('Received:', value);
});

// Output: "Evicted: 1"
// Output: "Received: 2" (Only item 2 is in the cache)
```

#### 2. Eviction on Exceeding `maxAge`

```javascript
import { LRUReplaySubject } from 'lrureplaysubject';
import { Subject } from 'rxjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const onEvictionSubject = new Subject();
onEvictionSubject.subscribe(value => {
    console.log('Evicted:', value);
});

const lruSubject = new LRUReplaySubject({
    maxSize: 5,
    maxAge: 1000 // 1 second
});

// Add an item and delay to see the effect of maxAge
lruSubject.next({ id: 1, value: 'test1' });

delay(1500).then(() => {
    lruSubject.next({ id: 2, value: 'test2' });

    // Subscribe to the subject to receive cached values
    lruSubject.subscribe(value => {
        console.log('Received:', value);
    });

    // Output: "Evicted: { id: 1, value: 'test1' }"
    // Output: "Received: { id: 2, value: 'test2' }" (Only item 2 is in the cache)
});
```

## API Documentation

Detailed API documentation can be found in [API.md](./API.md).

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.

## Homepage

For more information, visit the [homepage](https://github.com/zacharygriffee/lrureplaysubject#readme).