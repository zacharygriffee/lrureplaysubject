
# LRUReplaySubject API

## Class: LRUReplaySubject

A specialized `Subject` that integrates an LRU cache, allowing you to store, evict, and replay values to subscribers.

### Constructor

#### `constructor(config = {})`

- **Parameters:**
  - `config` (Object): Configuration options for the LRU cache and replay subject.
    - `maxSize` (Number): Maximum number of items the cache can hold. Defaults to `Infinity`.
    - `maxAge` (Number): Maximum age for items before they are considered stale. Defaults to `Infinity`.
    - `onEviction` (Subject): A `Subject` that receives evicted items from the cache.

### Methods

#### `next(value)`

Adds a value to the cache and notifies all subscribers.

- **Parameters:**
  - `value` (any): The value to add to the cache and broadcast to subscribers.

#### `subscribe(subscriber)`

Subscribes to the subject and replays cached values in descending order.

- **Parameters:**
  - `subscriber` (Function | Object): A function or an object with a `next` method to receive values.

### Delegated Cache Methods

The following methods are delegated to the internal LRU cache instance:

- **`resize(newSize)`**: Resize the cache.
- **`peek(key)`**: Peek at a value without updating its usage.
- **`delete(key)`**: Delete a specific key from the cache.
- **`clear()`**: Clear all entries in the cache.
- **`entries()`**: Get an iterator of cache entries in ascending order.
- **`values()`**: Get an iterator of cache values in ascending order.
- **`keys()`**: Get an iterator of cache keys in ascending order.
- **`entriesAscending()`**: Get an iterator of cache entries in ascending order.
- **`entriesDescending()`**: Get an iterator of cache entries in descending order.

## Function: shareLRUReplay

Creates a shared observable that replays values from an LRU cache.

### `shareLRUReplay(config = {})`

- **Parameters:**
  - `config` (Object): Configuration options for the LRU cache used by the underlying `LRUReplaySubject`.
    - `maxSize` (Number): Maximum number of items the cache can hold. Defaults to `Infinity`.
    - `maxAge` (Number): Maximum age for items before they are considered stale. Defaults to `Infinity`.
    - `onEviction` (Subject): A `Subject` that receives evicted items from the cache.

- **Returns:**
  - `(source: Observable) => Observable`: A function that takes an `Observable` source and returns a new `Observable` that shares values using `LRUReplaySubject`.

### Example Usage

```javascript
import { shareLRUReplay } from './index.js';

const shared$ = someObservable$.pipe(shareLRUReplay({ maxSize: 2 }));

shared$.subscribe(value => console.log('Shared Subscriber:', value)); // Replays last 2 emitted values from someObservable$
```

