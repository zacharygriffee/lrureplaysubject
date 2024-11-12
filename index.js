import {Subject, Observable, defer} from 'rxjs';
import QuickLRU from "quick-lru";
import delegates from "delegates";


function tryExtractKey(key) {
    return object => {
        if (!key) return object;
        if (typeof key === 'string') {
            key = key.split('.');
        }

        for (let i = 0; i < key.length; i++) {
            if (object && key[i] in object) {
                object = object[key[i]];
            } else {
                return undefined;
            }
        }

        return object;
    }
}

/**
 * An extension of the RxJS `Subject` that replays the last emitted values based on
 * a Least Recently Used (LRU) cache with optional size and age limits. This subject
 * caches values to allow subscribers to replay recent emissions, providing control
 * over cache size, expiration, and eviction behavior.
 *
 * @class
 * @extends {Subject}
 *
 * @param {Object} [config={}] - Configuration options for the LRU cache.
 * @param {number} [config.maxSize=Infinity] - Maximum number of items to store in the cache.
 * @param {number} [config.maxAge=Infinity] - Maximum age in milliseconds for each item before it expires.
 * @param {Subject} [config.onEviction=new Subject()] - A subject that emits evicted values when the cache reaches its limit.
 * @param {Function} [config.key] - Optional key extraction function for cache entries.
 * @param {Function} [config.map] - Optional mapping function to override default key extraction behavior.
 *
 * @example
 * // Basic usage with a max cache size of 5 items
 * const subject = new LRUReplaySubject({ maxSize: 5 });
 * subject.next('a');
 * subject.next('b');
 * subject.subscribe(value => console.log(value)); // Replays 'a', 'b'
 *
 * @example
 * // Using onEviction to monitor removed items
 * const evictionSubject = new Subject();
 * const subject = new LRUReplaySubject({ maxSize: 2, onEviction: evictionSubject });
 * evictionSubject.subscribe(value => console.log('Evicted:', value));
 * subject.next('a');
 * subject.next('b');
 * subject.next('c'); // 'a' is evicted
 *
 * @property {number} size - The current size of the cache.
 * @property {Subject} onEviction - Emits values that are removed from the cache when the LRU limit is reached.
 */
export class LRUReplaySubject extends Subject {
    constructor(config = {}) {
        super();

        const {
            maxSize = Number.POSITIVE_INFINITY,
            maxAge = Number.POSITIVE_INFINITY,
            onEviction = new Subject(),
            key,
            map
        } = config;

        this._mapper = map || tryExtractKey(key);
        this._cache = new QuickLRU({
            maxSize,
            maxAge,
            onEviction(key, value) {
                onEviction.next(value);
            }
        });

        delegates(this, "_cache")
            .getter("size")
            .method("resize")
            .method("delete")
            .method("clear")
            .method("entries")
            .method("values")
            .method("entriesAscending")
            .method("entriesDescending");

        this.onEviction = onEviction;
    }

    /**
     * Emits a value to all subscribers and stores it in the cache.
     *
     * @param {*} value - The value to emit. Must not be `null` or `undefined`.
     */
    next(value) {
        if (value === undefined || value === null) {
            console.error('Cannot add undefined or null value to LRU cache');
            return;
        }
        this._cache.set(this._mapper(value), value);
        super.next(value);
    }

    /**
     * Subscribes to the subject, replaying cached values in descending order of recency.
     *
     * @param {function|Object} subscriber - A function or observer object that receives emitted values.
     * @throws {TypeError} If the subscriber is neither a function nor an object with a `next` method.
     * @returns {Subscription} A subscription object that can be used to unsubscribe.
     */
    subscribe(subscriber) {
        // Allow for an empty object or an object with next, complete, or error methods
        if (typeof subscriber === 'function' || (subscriber && typeof subscriber === 'object')) {
            // Replay values from the cache only if there is a `next` handler
            if (typeof subscriber === 'function' || (subscriber && typeof subscriber.next === 'function')) {
                for (const [, value] of this._cache.entriesDescending()) {
                    (typeof subscriber === 'function' ? subscriber : subscriber.next).call(subscriber, value);
                }
            }
        } else {
            throw new TypeError('Invalid subscriber: Expected a function or an object');
        }

        // Proceed with the standard subscription process
        return super.subscribe(subscriber);
    }

}


/**
 * An RxJS operator that shares a source Observable among multiple subscribers using an `LRUReplaySubject`
 * to replay recently emitted values. The cache's behavior (size, expiration, etc.) is configurable.
 *
 * This operator is useful when you want to share a source Observable with multiple subscribers,
 * replaying recent values for each new subscriber while limiting the cache to a specific size
 * or time duration. The source subscription remains active as long as there is at least one subscriber.
 *
 * @function
 * @param {Object} [config={}] - Configuration for the underlying `LRUReplaySubject`.
 * @param {number} [config.maxSize=Infinity] - Maximum number of items to store in the cache.
 * @param {number} [config.maxAge=Infinity] - Maximum age in milliseconds for each item in the cache.
 * @param {Subject} [config.onEviction=new Subject()] - A subject that emits evicted values when the cache limit is reached.
 * @param {Function} [config.key] - Optional key extraction function for identifying items in the cache.
 * @param {Function} [config.map] - Optional mapping function to override default key extraction.
 *
 * @example
 * // Share source observable with a cache size limit of 5 items
 * const shared$ = source$.pipe(shareLRUReplay({ maxSize: 5 }));
 * shared$.subscribe(value => console.log('Subscriber 1:', value));
 * shared$.subscribe(value => console.log('Subscriber 2:', value));
 *
 * @example
 * // Share a source observable with a time-based cache limit of 10 seconds
 * const shared$ = source$.pipe(shareLRUReplay({ maxAge: 10000 }));
 * shared$.subscribe(value => console.log('Subscriber 1:', value));
 * setTimeout(() => {
 *     shared$.subscribe(value => console.log('Subscriber 2:', value)); // Receives cached values if within 10 seconds
 * }, 5000);
 *
 * @returns {Function} An operator function that takes a source Observable and returns a new Observable
 * that shares the source's emissions using an `LRUReplaySubject`.
 */
export function shareLRUReplay(config = {}) {
    return (source) => defer(() => {
        const subject = new LRUReplaySubject(config);
        let activeSubscribers = 0;

        const subscription = source.subscribe({
            next: (value) => subject.next(value),
            error: (err) => {
                subject.error(err);
                console.error('Error in source observable:', err);
            },
            complete: () => subject.complete(),
        });

        return new Observable(subscriber => {
            activeSubscribers++;
            const sub = subject.subscribe(subscriber);

            // Cleanup function for subscriber
            return () => {
                try {
                    sub.unsubscribe();
                    activeSubscribers--;
                    if (activeSubscribers === 0) {
                        subscription.unsubscribe();
                    }
                } catch (err) {
                    console.error('Error during cleanup:', err);
                }
            };
        });
    });
}
