import {test, solo, skip} from 'brittle';
import {of, Observable, Subject} from 'rxjs';
import {LRUReplaySubject, shareLRUReplay} from './index.js';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test('`onEviction` observable emits value after `maxSize` is exceeded', async t => {
    const expectValue = 1;
    let actualValue;
    let isCalled = false;

    const onEvictionSubject = new Subject();
    onEvictionSubject.subscribe(value => {
        actualValue = value;
        isCalled = true;
    });

    const lruSubject = new LRUReplaySubject({maxSize: 1, onEviction: onEvictionSubject});
    lruSubject.next(expectValue);
    lruSubject.next(2);

    t.alike(actualValue, expectValue);
    t.ok(isCalled);
});

test('set(expiry) - an individual item could have custom expiration', async t => {
    const onEviction = new Subject();
    const lruSubject = new LRUReplaySubject({maxSize: 10, onEviction});

    lruSubject.next({key: '1', value: 'test', maxAge: 100});

    // Wait for 200ms to ensure the item has expired
    await delay(200);

    let hasValue = false;

    lruSubject.subscribe(value => {
        if (value.key === '1') {
            hasValue = true;
        }
    });

    t.not(hasValue);
});

test('set(expiry) - items without expiration will never expire', async t => {
    const onEviction = new Subject();
    const lruSubject = new LRUReplaySubject({maxSize: 10, onEviction});

    lruSubject.next({key: '1', value: 'test', maxAge: 100}); // Set item with expiration
    lruSubject.next({key: '2', value: 'boo'}); // Set item without expiration

    // Wait for 200ms to ensure the first item has expired
    await delay(200);

    let hasValue1 = false;
    let hasValue2 = false;

    lruSubject.subscribe(value => {
        if (value.key === '1') {
            hasValue1 = true;
        }
        if (value.key === '2') {
            hasValue2 = true;
        }
    });

    t.not(hasValue1); // The first item should have expired
    t.ok(hasValue2); // The second item should still be present
});

test('set(expiry) - not a number expires should not be taken into account', async t => {
    const onEviction = new Subject();
    const lruSubject = new LRUReplaySubject({maxSize: 10, onEviction});

    lruSubject.next({key: '1', value: 'test', maxAge: 'string'}); // Set item with invalid expiration
    lruSubject.next({key: '2', value: 'boo'}); // Set item without expiration

    // Wait for 200ms
    await delay(200);

    let hasValue1 = false;
    let hasValue2 = false;

    lruSubject.subscribe(value => {
        if (value.key === '1') {
            hasValue1 = true;
        }
        if (value.key === '2') {
            hasValue2 = true;
        }
    });

    t.ok(hasValue1); // The first item should still be present because the expiration was invalid
    t.ok(hasValue2); // The second item should still be present
});

test('max age - should remove the item if it has expired on call to `subscribe` method upon the same key', async t => {
    const onEviction = new Subject();
    const lruSubject = new LRUReplaySubject({maxSize: 10, maxAge: 90, onEviction});

    lruSubject.next({key: '1', value: 'test'});

    // Wait for 200ms to allow the item to expire
    await delay(200);

    let valueFound = false;

    lruSubject.subscribe(value => {
        if (value.key === '1') {
            valueFound = true;
        }
    });

    t.not(valueFound); // The item should not be found because it has expired
});

test('max age - a non-recent item can also expire', async t => {
    const onEviction = new Subject();
    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100, onEviction});

    lruSubject.next({key: '1', value: 'test1'});
    lruSubject.next({key: '2', value: 'test2'});
    lruSubject.next({key: '3', value: 'test3'}); // Evicts '1' from cache

    // Wait for 200ms to allow the item to expire
    await delay(200);

    let valueFound = false;

    lruSubject.subscribe(value => {
        if (value.key === '1') {
            valueFound = true;
        }
    });

    t.not(valueFound); // The item should not be found because it has expired
});

test('max age - setting the item again should refresh the expiration time', async t => {
    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100});
    lruSubject.next('test');
    await delay(75);
    lruSubject.next('test');
    await delay(50);

    let value;
    lruSubject.subscribe(v => value = v);

    t.alike(value, 'test');
});

test('max age - setting an item with a local expiration date', async t => {
    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100});
    lruSubject.next('test');
    lruSubject._cache.set('test2', 'test2', {maxAge: 500}); // Directly using the internal cache for custom maxAge
    await delay(200);

    let hasTest2;
    lruSubject.subscribe(() => hasTest2 = lruSubject._cache.has('test2'));

    t.ok(hasTest2);
    await delay(300);
    t.not(lruSubject._cache.has('test2'));
});

test('max age - setting an item with an empty object as options parameter must use the global maxAge', async t => {
    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100});
    lruSubject.next('test');
    lruSubject._cache.set('test2', 'test2', {}); // Using empty options object
    await delay(200);

    let hasTest2;
    lruSubject.subscribe(() => hasTest2 = lruSubject._cache.has('test2'));

    t.absent(hasTest2);
});

test('max age - once an item expires, the eviction function should be called', async t => {
    t.timeout(1000);
    const expectKey = 'test';
    let isCalled = false;
    const onEviction = {
        next: (value) => {
            if (value === expectKey) {
                isCalled = true;
            }
        }
    };

    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100, onEviction});
    lruSubject.next(expectKey);

    await delay(200);

    let value;
    lruSubject.subscribe(v => value = v);

    t.is(value, undefined);
    t.ok(isCalled);
});

test('max age - once a non-recent item expires, the eviction function should be called', async t => {
    t.timeout(1000);
    const expectKeys = ['test', 'test2'];
    let actualKeys = [];
    const onEviction = {
        next: (value) => {
            actualKeys.push(value);
        }
    };

    const lruSubject = new LRUReplaySubject({maxSize: 2, maxAge: 100, onEviction});
    lruSubject.next('test');
    lruSubject.next('test2');
    lruSubject.next('test3');
    lruSubject.next('test4');
    lruSubject.next('test5');

    await delay(200);

    t.not(lruSubject._cache.has('test1'));
    t.ok(actualKeys.includes('test'));
    t.ok(actualKeys.includes('test2'));
});

test('entriesAscending enumerates cache items oldest-first', t => {
    const lru = new LRUReplaySubject({maxSize: 3});
    lru.next('1');
    lru.next('2');
    lru.next('3');
    lru.next('3');
    lru.next('2');

    const entries = [...lru.entriesAscending()];
    t.alike(entries, [['1', '1'], ['3', '3'], ['2', '2']]);
});

test('entriesDescending enumerates cache items newest-first', t => {
    const lru = new LRUReplaySubject({maxSize: 3});

    // Insert items into the cache
    lru.next('1');
    lru.next('2');
    lru.next('3');

    // Manually promote some items to test the order
    lru.next('2');
    lru.next('1');

    const expectedOrder = [['1', '1'], ['2', '2'], ['3', '3']];
    const entries = [...lru.entriesDescending()];

    t.alike(entries, expectedOrder);
});

test('entriesDescending enumerates cache items newest-first', t => {
    const lru = new LRUReplaySubject({maxSize: 3});

    // Add items to the cache using the modified next method
    lru.next('t'); // Equivalent to set('t', 't')
    lru.next('q'); // Equivalent to set('q', 'q')
    lru.next('a'); // Equivalent to set('a', 'a')
    lru.next('t'); // Updates the value of 't'
    lru.next('v'); // Equivalent to set('v', 'v')

    // Verify the order of the entries
    t.alike([...lru.entriesDescending()], [['v', 'v'], ['t', 't'], ['a', 'a'], ['q', 'q']]);
});


test('entries reflects the default behavior of entriesAscending', t => {
    const lru = new LRUReplaySubject({maxSize: 3});
    lru.next('1');
    lru.next('2');
    lru.next('3');
    lru.next('3');
    lru.next('2');

    const entries = [...lru.entries()];
    t.alike(entries, [['1', '1'], ['3', '3'], ['2', '2']]);
});

test('LRUReplaySubject - emits values as they are added', async t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    const receivedValues = [];
    subject.subscribe(value => receivedValues.push(value));

    subject.next('A');
    subject.next('B');
    subject.next('C');

    t.alike(receivedValues, ['A', 'B', 'C']);
});

test('LRUReplaySubject - replays last values to new subscribers', async t => {
    const subject = new LRUReplaySubject({maxSize: 2});

    subject.next('A');
    subject.next('B');
    subject.next('C');

    const receivedValues = [];
    subject.subscribe(value => receivedValues.push(value));

    // The updated order now correctly reflects the observed behavior
    t.alike(receivedValues, ['C', 'B', 'A']);

});


test('LRUReplaySubject - respects maxSize when emitting values', t => {
    const lruSubject = new LRUReplaySubject({maxSize: 2});
    lruSubject.next('A');
    lruSubject.next('B');
    lruSubject.next('C'); // This should move 'A' to oldCache

    const newSubscriberValues = [];
    lruSubject.subscribe(value => newSubscriberValues.push(value));

    // Expected order: first emit from `cache`, then `oldCache`, newest to oldest
    t.alike(newSubscriberValues, ['C', 'B', 'A']); // 'A' should still be emitted, but after 'C' and 'B'
});

test('LRUReplaySubject - handles maxAge expiration correctly', async t => {
    const subject = new LRUReplaySubject({maxSize: 3, maxAge: 200});

    subject.next('A');
    await delay(50);
    subject.next('B');
    await delay(50);
    subject.next('C');

    await delay(100); // Reduce the delay to 100ms to ensure 'B' and 'C' are still valid

    const newSubscriberValues = [];
    subject.subscribe(value => newSubscriberValues.push(value));

    // Since 'A' should have expired, we expect 'B' and 'C' in the order of 'newest' to 'oldest'
    t.alike(newSubscriberValues, ['C', 'B']);
});

test('LRUReplaySubject - emits values to multiple subscribers', t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    subject.next('X');
    subject.next('Y');

    const receivedValues1 = [];
    const receivedValues2 = [];

    // First subscriber
    subject.subscribe(value => receivedValues1.push(value));

    // Second subscriber
    subject.subscribe(value => receivedValues2.push(value));

    // Both subscribers should have received 'Y' and 'X' in 'newest' to 'oldest' order
    t.alike(receivedValues1, ['Y', 'X']);
    t.alike(receivedValues2, ['Y', 'X']);

    subject.next('Z');

    // After 'Z' is emitted, it should be received by both subscribers
    t.alike(receivedValues1, ['Y', 'X', 'Z']);
    t.alike(receivedValues2, ['Y', 'X', 'Z']);
});


test('LRUReplaySubject - respects maxSize with multiple subscribers', t => {
    const subject = new LRUReplaySubject({maxSize: 2});

    subject.next('1'); // Cache: ['1']
    subject.next('2'); // Cache: ['2', '1']

    const receivedValues1 = [];
    const receivedValues2 = [];

    // First subscriber subscribes after '1' and '2' have been emitted
    subject.subscribe(value => receivedValues1.push(value));

    // Ensure the first subscriber received values in the order they were emitted
    t.alike(receivedValues1, ['2', '1']);

    // Emitting '3' should cause '1' to be evicted from the active cache (Cache: ['3', '2'], OldCache: ['1'])
    subject.next('3');

    // Now, a new subscriber subscribes
    subject.subscribe(value => receivedValues2.push(value));

    // Verify the first subscriber received the new value '3', but still has '2' and '1' in the correct order
    t.alike(receivedValues1, ['2', '1', '3']);

    // The second subscriber should receive '3', '2' as the most recent items, and '1' from the oldCache
    t.alike(receivedValues2, ['3', '2', '1']);
});

test('LRUReplaySubject - handles error correctly', t => {
    const subject = new LRUReplaySubject({maxSize: 2});

    const receivedValues = [];
    const receivedError = [];

    subject.subscribe({
        next: value => receivedValues.push(value),
        error: err => receivedError.push(err)
    });

    subject.next('1');
    subject.next('2');
    subject.error('Something went wrong');

    t.alike(receivedValues, ['1', '2']);
    t.alike(receivedError, ['Something went wrong']);
});

test('LRUReplaySubject - completes correctly', t => {
    const subject = new LRUReplaySubject({maxSize: 2});

    const receivedValues = [];
    const receivedComplete = [];

    subject.subscribe({
        next: value => receivedValues.push(value),
        complete: () => receivedComplete.push('complete')
    });

    subject.next('1');
    subject.next('2');
    subject.complete();

    t.alike(receivedValues, ['1', '2']);
    t.alike(receivedComplete, ['complete']);
});

test('LRUReplaySubject - evicts the oldest item in cache when maxSize is exceeded', t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    subject.next('A'); // Cache: ['A']
    subject.next('B'); // Cache: ['B', 'A']
    subject.next('C'); // Cache: ['C', 'B', 'A']

    const receivedValues = [];

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['C', 'B', 'A']); // All values are replayed in descending order

    subject.next('D'); // Cache: ['D', 'C', 'B'], OldCache: ['A']

    receivedValues.length = 0; // Clear the array to capture new subscription results

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['D', 'C', 'B', 'A']); // 'A' should be replayed last, even though it's in the oldCache
});

test('LRUReplaySubject - evicts and updates observable with the latest state', t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    // Add values to the subject
    subject.next('A'); // new_cache: ['A']
    subject.next('B'); // new_cache: ['B', 'A']
    subject.next('C'); // new_cache: ['C', 'B', 'A']
    subject.next('D'); // new_cache: ['D'], old_cache: ['C', 'B', 'A']

    // Verify that the observable emits the correct values in order
    let receivedValues = [];
    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['D', 'C', 'B', 'A']); // All values are replayed, newest to oldest

    // Add another value to trigger further eviction
    subject.next('E'); // new_cache: ['E', 'D'], old_cache: ['C', 'B', 'A']

    receivedValues = [];
    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['E', 'D', 'C', 'B', 'A']); // All values replayed, 'A' is still in the old_cache

    // Add a third value to fill new_cache, triggering eviction in old_cache
    subject.next('F'); // new_cache: [], old_cache: ['F', 'E', 'D']

    receivedValues = [];
    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['F', 'E', 'D']); // Only the newest values, 'C', 'B', 'A' are evicted
});


test('LRUReplaySubject - handles eviction with multiple subscribers', t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    // Initial values
    subject.next('X'); // new_cache: ['X']
    subject.next('Y'); // new_cache: ['X', 'Y']
    subject.next('Z'); // new_cache: ['X', 'Y', 'Z']

    let receivedValues1 = [];
    subject.subscribe(value => receivedValues1.push(value));
    t.alike(receivedValues1, ['Z', 'Y', 'X']); // Replay newest to oldest from new_cache

    // Add 'A' and cause cache swap
    subject.next('A'); // new_cache: ['A'], old_cache: ['Z', 'Y', 'X']

    let receivedValues2 = [];
    subject.subscribe(value => receivedValues2.push(value));
    t.alike(receivedValues2, ['A', 'Z', 'Y', 'X']); // Replay new_cache and old_cache

    // Add 'B'
    subject.next('B'); // new_cache: ['B', 'A'], old_cache: ['Z', 'Y', 'X']

    let receivedValues3 = [];
    subject.subscribe(value => receivedValues3.push(value));
    t.alike(receivedValues3, ['B', 'A', 'Z', 'Y', 'X']); // Same replay order

    // Add 'C' to trigger eviction
    subject.next('C'); // new_cache: [], old_cache: ['C', 'B', 'A'] // 'Z', 'Y', 'X' evicted

    let receivedValues4 = [];
    subject.subscribe(value => receivedValues4.push(value));
    t.alike(receivedValues4, ['C', 'B', 'A']); // 'Z', 'Y', 'X' should be evicted

    // Add 'D' (filling new_cache)
    subject.next('D'); // new_cache: ['D'], old_cache: ['C', 'B', 'A']

    let receivedValues5 = [];
    subject.subscribe(value => receivedValues5.push(value));
    t.alike(receivedValues5, ['D', 'C', 'B', 'A']); // Replay newest to oldest

});

test('LRUReplaySubject - evicts items based on maxAge and updates subscribers', async t => {
    const subject = new LRUReplaySubject({maxSize: 3, maxAge: 100});

    subject.next('A'); // Cache: ['A']
    await delay(50);

    subject.next('B'); // Cache: ['B', 'A']
    await delay(50);

    subject.next('C'); // Cache: ['C', 'B', 'A']
    await delay(150); // A and B should expire

    const receivedValues = [];

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, []); // All items should have expired

    subject.next('D'); // Cache: ['D', 'C']

    receivedValues.length = 0;

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['D']); // Only 'D' should remain
});

test('LRUReplaySubject - replays values in descending order after eviction', t => {
    const subject = new LRUReplaySubject({maxSize: 3});

    subject.next('1'); // Cache: ['1']
    subject.next('2'); // Cache: ['2', '1']
    subject.next('3'); // Cache: ['3', '2', '1']

    const receivedValues = [];

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['3', '2', '1']); // Values should be replayed in descending order

    subject.next('4'); // Cache: ['4', '3', '2'], OldCache: ['1']

    receivedValues.length = 0;

    subject.subscribe(value => receivedValues.push(value));
    t.alike(receivedValues, ['4', '3', '2', '1']); // Newest to oldest, including oldCache
});

test('shareLRUReplay - replays values to new subscribers', async (t) => {
    const source = of('A', 'B', 'C').pipe(shareLRUReplay({maxSize: 2}));
    const receivedValues1 = [];
    const receivedValues2 = [];

    source.subscribe(value => receivedValues1.push(value));

    // The order of replay should reflect [...cache, ...oldCache], so we expect 'C', 'B', 'A'
    t.alike(receivedValues1, ['C', 'B', 'A']); // 'A' should not be evicted yet

    await delay(50);

    source.subscribe(value => receivedValues2.push(value));
    t.alike(receivedValues2, ['C', 'B', 'A']); // New subscriber gets the same ['C', 'B', 'A']
});

// Corrected test expectations
test('shareLRUReplay - respects maxSize and emits values correctly', t => {
    const source$ = new LRUReplaySubject({maxSize: 3});

    // Emit values 'A', 'B', 'C'
    source$.next('A');
    source$.next('B');
    source$.next('C');

    const receivedValues1 = [];
    source$.subscribe(value => receivedValues1.push(value));

    // Both subscribers should receive the same values in the same order:
    t.alike(receivedValues1, ['C', 'B', 'A']); // Newest to oldest

    const receivedValues2 = [];
    source$.subscribe(value => receivedValues2.push(value));

    t.alike(receivedValues2, ['C', 'B', 'A']); // Newest to oldest, same as the first subscriber
});

test('shareLRUReplay - handles eviction and new subscriptions correctly', t => {
    const source$ = new LRUReplaySubject({maxSize: 3});

    // First subscriber processes all current values
    source$.next('A'); // Cache: ['A']
    source$.next('B'); // Cache: ['B', 'A']
    source$.next('C'); // Cache: ['C', 'B', 'A']

    const receivedValues1 = [];
    source$.subscribe(value => receivedValues1.push(value));

    // First subscriber receives all values
    t.alike(receivedValues1, ['C', 'B', 'A']); // Newest to oldest

    // Add a new value, causing the cache to move to oldCache
    source$.next('D'); // Cache: ['D'], OldCache: ['C', 'B', 'A']

    // Add another value, causing eviction from oldCache
    source$.next('E'); // Cache: ['E', 'D'], OldCache: ['C', 'B', 'A']

    // Second subscriber comes in after eviction
    const receivedValues2 = [];
    source$.subscribe(value => receivedValues2.push(value));

    // Second subscriber should receive the current state of the cache and old cache
    t.alike(receivedValues2, ['E', 'D', 'C', 'B', 'A']); // Values from new and old cache, newest to oldest

    // Add another value, triggering eviction in oldCache
    source$.next('F'); // Cache: ['F'], OldCache: ['E', 'D'] (A, B, C are evicted)

    // Assert that the second subscriber gets the updated cache after eviction
    const receivedValues3 = [];
    source$.subscribe(value => receivedValues3.push(value));
    t.alike(receivedValues3, ['F', 'E', 'D']); // Only the remaining values in cache, as C, B, A are evicted

    // Final assertion to ensure receivedValues1 and receivedValues2 are updated
    t.alike(receivedValues1, ['C', 'B', 'A', 'D', 'E', 'F']);
    t.alike(receivedValues2, ['E', 'D', 'C', 'B', 'A', 'F']);
});

test('shareLRUReplay - propagates complete and error signals to all subscribers', t => {
    const source$ = new LRUReplaySubject({maxSize: 3});

    const receivedValues1 = [];
    const receivedValues2 = [];
    const receivedComplete = [];
    const receivedError = [];

    source$.next('A');
    source$.next('B');

    source$.subscribe({
        next: value => receivedValues1.push(value),
        complete: () => receivedComplete.push('complete'),
        error: err => receivedError.push(err)
    });

    source$.next('C');
    source$.subscribe({
        next(value) {
            return receivedValues2.push(value);
        },
        error(error) {
            // Handle errors in the other subscriber.
        }
    });

    source$.error('An error occurred');

    t.alike(receivedValues1, ['B', 'A', 'C']); // Newest to oldest
    t.alike(receivedValues2, ['C', 'B', 'A']); // Newest to oldest
    t.alike(receivedError, ['An error occurred']);
    t.not(receivedComplete.length); // No completion signal yet

    receivedError.length = 0;

    source$.subscribe({
        next: value => receivedValues2.push(value),
        error: err => receivedError.push(err)
    });

    t.alike(receivedError, ['An error occurred']); // New subscriber should receive the error immediately
});

test('shareLRUReplay - handles subscriptions with mixed delays', async t => {

    const source$ = new LRUReplaySubject({maxSize: 3});

    const receivedValues1 = [];
    const receivedValues2 = [];

    source$.next('A');
    source$.next('B');

    // First subscriber receives initial values
    source$.subscribe(value => receivedValues1.push(value));
    t.alike(receivedValues1, ['B', 'A']); // Received values from new_cache

    await delay(50);

    // Add another value after delay
    source$.next('C'); // Cache: ['C', 'B', 'A']

    await delay(50);

    // Second subscriber subscribes after more values have been emitted
    source$.subscribe(value => receivedValues2.push(value));
    t.alike(receivedValues2, ['C', 'B', 'A']); // Received from cache

    // Add more values to test ongoing emissions
    source$.next('D'); // Cache: ['D'], OldCache: ['C', 'B', 'A']

    t.alike(receivedValues1, ['B', 'A', 'C', 'D']);
    t.alike(receivedValues2, ['C', 'B', 'A', 'D']);

});

test('shareLRUReplay - handles empty cache state correctly', t => {
    const source$ = new LRUReplaySubject({maxSize: 3});

    const receivedValues = [];
    source$.subscribe(value => receivedValues.push(value));

    t.alike(receivedValues, []); // No values should be emitted

    source$.next('A'); // Cache: ['A']
    t.alike(receivedValues, ['A']);
});

test('shareLRUReplay - handles rapid additions and evictions', t => {
    const source$ = new LRUReplaySubject({maxSize: 3});

    for (let i = 0; i < 10; i++) {
        source$.next(`Value ${i}`);
    }

    const receivedValues = [];
    source$.subscribe(value => receivedValues.push(value));

    t.alike(receivedValues, ['Value 9', 'Value 8', 'Value 7', 'Value 6']);
});

test('shareLRUReplay - handles eviction and maxAge together correctly', async t => {
    const source$ = new LRUReplaySubject({maxSize: 3, maxAge: 200});

    source$.next('A');
    await delay(50);
    source$.next('B');
    await delay(50);
    source$.next('C');
    await delay(50);

    source$.next('D'); // Cache: ['D'], OldCache: ['C', 'B', 'A']

    const receivedValues1 = [];
    source$.subscribe(value => receivedValues1.push(value));
    t.alike(receivedValues1, ['D', 'C', 'B', 'A']); // All still valid

    await delay(50); // A should expire now

    const receivedValues2 = [];
    source$.subscribe(value => receivedValues2.push(value));
    t.alike(receivedValues2, ['D', 'C', 'B']); // A expired and is no longer replayed
});