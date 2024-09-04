# API Documentation

## `tryExtractKey(key)`

**Description**:
Helper function to extract a value from an object based on a specified key which can be a string or an array of strings.

**Parameters**:
- `key` (string | string[]): The key or path to extract the value from the object.

**Returns**:
- A function that accepts an object and returns the extracted value.

---

## `class LRUReplaySubject`

**Description**:
An extension of the RxJS `Subject` class with additional LRU (Least Recently Used) caching functionality using `quick-lru`.

**Constructor Parameters**:
- `config` (object):
  - `maxSize` (number): The maximum size of the cache. Default is `Number.POSITIVE_INFINITY`.
  - `maxAge` (number): The maximum age of items in the cache in milliseconds. Default is `Number.POSITIVE_INFINITY`.
  - `onEviction` (Subject): A subject that emits values when they are evicted from the cache.
  - `key` (string | string[]): A key or path to be used to extract the key from the items.
  - `map` (function): A custom map function to extract the key from the items. Takes precedence over the `key` configuration if both are provided.

**Methods**:
- `next(value)`:
  - Adds a new value to the subject and the cache. Logs an error if the value is `null` or `undefined`.
  - `value` (any): The value to be added.

- `subscribe(subscriber)`:
  - Subscribes to the subject and replays the cached values in descending order.
  - `subscriber` (function | object): A function or an object with a `next` method.

**Inherited Methods from QuickLRU via Delegates**:
- `size` (getter): Returns the current size of the cache.
- `resize(newSize)`: Resizes the cache to the specified new size.
  - `newSize` (number): The new size of the cache.
- `delete(key)`: Deletes an item from the cache.
  - `key` (any): The key of the item to delete.
- `clear()`: Clears all items from the cache.
- `entries()`: Returns an iterator of the cache entries.
- `values()`: Returns an iterator of the cache values.
- `entriesAscending()`: Returns an iterator of the cache entries in ascending order.
- `entriesDescending()`: Returns an iterator of the cache entries in descending order.

**Events**:
- `onEviction`: Emits values that are evicted from the cache.

---

## `shareLRUReplay(config)`

**Description**:
A higher-order function that returns an Observable which shares a single subscription to the source Observable using `LRUReplaySubject`.

**Parameters**:
- `config` (object):
  - `maxSize` (number): The maximum size of the cache for the LRUReplaySubject. Default is `Number.POSITIVE_INFINITY`.
  - `maxAge` (number): The maximum age of items in the cache in milliseconds for the LRUReplaySubject. Default is `Number.POSITIVE_INFINITY`.
  - `onEviction` (Subject): A subject that emits values when they are evicted from the cache for the LRUReplaySubject.
  - `key` (string | string[]): A key or path to be used to extract the key from the items for the LRUReplaySubject.
  - `map` (function): A custom map function to extract the key from the items for the LRUReplaySubject. Takes precedence over the `key` configuration if both are provided.

**Returns**:
- A function that takes a source Observable and returns a new Observable which replays and shares the values from the source using `LRUReplaySubject`.

---