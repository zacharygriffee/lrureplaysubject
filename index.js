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

    next(value) {
        if (value === undefined || value === null) {
            console.error('Cannot add undefined or null value to LRU cache');
            return;
        }
        this._cache.set(this._mapper(value), value);
        super.next(value);
    }

    subscribe(subscriber) {
        if (typeof subscriber === 'function' || (subscriber && typeof subscriber.next === 'function')) {
            // Replay values from the cache in descending order
            for (const [,value] of this._cache.entriesDescending()) {
                (typeof subscriber === 'function' ? subscriber : subscriber.next).call(subscriber, value);
            }
        } else {
            throw new TypeError('Invalid subscriber: Expected a function or an object with a `next` method');
        }

        // Proceed with the standard subscription process
        return super.subscribe(subscriber);
    }
}

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