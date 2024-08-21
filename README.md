# LRUReplaySubject

A custom implementation of an RxJS `Subject` that combines the functionality of a Least Recently Used (LRU) cache with replay capabilities. This utility allows you to cache and replay values to new subscribers, making it particularly useful for scenarios where you want to limit memory usage while still providing a replay of recent events.

Uses [quick-lru](https://github.com/sindresorhus/quick-lru) under the hood.

## Features

- **LRU Caching:** Automatically evicts least recently used items when the cache reaches its maximum size.
- **Replay Subject:** Replays cached values to new subscribers.
- **Configurable:** Supports various configuration options like `maxSize`, `maxAge`, and `onEviction` callbacks.
- **Delegated Methods:** Includes methods like `resize`, `peek`, `delete`, `clear`, and more to interact with the cache.
- **22kb** Minified size

## Installation

Install the necessary dependencies via npm:

```bash
npm install rxjs quick-lru delegates
```

## Usage

Here's a basic example of how to use the `LRUReplaySubject` and `shareLRUReplay` operator:

```javascript
import { LRUReplaySubject, shareLRUReplay } from './index.js';

// Example with LRUReplaySubject
const subject = new LRUReplaySubject({ maxSize: 3 });

subject.subscribe(value => console.log('Subscriber 1:', value));
subject.next(1);
subject.next(2);
subject.next(3);
subject.next(4); // The value 1 should be evicted

subject.subscribe(value => console.log('Subscriber 2:', value)); // Replays [4, 3, 2]

// Example with shareLRUReplay operator
const shared$ = someObservable$.pipe(shareLRUReplay({ maxSize: 2 }));

shared$.subscribe(value => console.log('Shared Subscriber:', value)); // Replays last 2 emitted values from someObservable$
```

## Configuration Options

- **maxSize:** Maximum number of items the cache can hold.
- **maxAge:** Maximum age for items before they are considered stale and eligible for eviction.
- **onEviction:** A `Subject` that will receive evicted items from the cache.

## Methods

The `LRUReplaySubject` class provides several methods to manage the cache:

- `resize(newSize)`: Resize the cache.
- `peek(key)`: Peek at the value associated with the key without affecting its recency.
- `delete(key)`: Delete a key-value pair from the cache.
- `clear()`: Clear the entire cache.
- `entries()`: Get an iterator for the cache entries in ascending order of usage.
- `values()`: Get an iterator for the cache values in ascending order of usage.
- `keys()`: Get an iterator for the cache keys in ascending order of usage.
- `entriesAscending()`: Get an iterator for the cache entries in ascending order.
- `entriesDescending()`: Get an iterator for the cache entries in descending order.

## [API](./API.md)

## License

This project is licensed under the MIT License.
