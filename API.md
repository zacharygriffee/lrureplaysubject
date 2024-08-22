# API Documentation

## Classes

### LRUReplaySubject

A specialized RxJS `Subject` with LRU caching capabilities.

#### Constructor

```typescript
constructor(config?: LRUReplaySubjectConfig)
```

**Parameters:**

- `config`: Optional configuration object

  - `maxSize` (number): Maximum size of the cache. Default is `Number.POSITIVE_INFINITY`.
  - `maxAge` (number): Maximum age of the cache items in milliseconds. Default is `Number.POSITIVE_INFINITY`.
  - `onEviction` (Subject): Subject to emit evicted items.

#### Example

```javascript
const lruReplaySubject = new LRUReplaySubject({
    maxSize: 100,
    maxAge: 60 * 60 * 1000, // 1 hour
    onEviction: new Subject()
});
```

#### Methods

##### next(value: any)

Adds a value to the subject and the LRU cache. Emits the value to all subscribers.

**Parameters:**

- `value`: The value to be added.

**Example:**

```javascript
lruReplaySubject.next('newValue');
```

##### subscribe(subscriber: function | object)

Subscribes to the subject and replays cached values in descending order of recent usage.

**Parameters:**

- `subscriber`: A function or an object with a `next` method.

**Example:**

```javascript
lruReplaySubject.subscribe(value => {
    console.log('Received:', value);
});
```

## Functions

### shareLRUReplay

Creates a shared observable using `LRUReplaySubject`.

#### Signature

```typescript
shareLRUReplay(config?: LRUReplaySubjectConfig): (source: Observable) => Observable
```

**Parameters:**

- `config`: Optional configuration for `LRUReplaySubject`

  - `maxSize` (number): Maximum size of the cache.
  - `maxAge` (number): Maximum age of the cache items in milliseconds.

**Returns:**

- A function that takes a source observable and returns a shared observable.

#### Example

```javascript
import { of } from 'rxjs';
import { shareLRUReplay } from './path-to-lru-replay-subject';

// Create a source observable
const sourceObservable = of('data1', 'data2', 'data3');

// Use the shareLRUReplay operator in the observable pipeline
const sharedObservable = sourceObservable.pipe(
    shareLRUReplay({
        maxSize: 5,
        maxAge: 1000 * 30 // 30 seconds
    })
);

const subscription = sharedObservable.subscribe({
    next: value => console.log('Received:', value),
    error: err => console.error('Error:', err),
    complete: () => console.log('Completed')
});
```

## Configuration Objects

### LRUReplaySubjectConfig

The configuration object for `LRUReplaySubject`.

**Properties:**

- `maxSize` (number): Maximum size of the cache.
- `maxAge` (number): Maximum age of the cache items in milliseconds.
- `onEviction` (Subject): Subject to emit evicted items.