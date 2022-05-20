export class LruCache<K, V> extends Map<K, V> {
    private readonly capacity: number

    public constructor(capacity: number) {
        super()
        this.capacity = capacity
    }

    public get(key: K): V | undefined {
        if (!this.has(key)) {
            return undefined
        }
        const value = super.get(key)!

        this.set(key, value)

        return value
    }

    public set(key: K, value: V): this {
        this.delete(key)
        super.set(key, value)
        if (this.size > this.capacity) {
            this.deleteOldestEntry()
        }
        return this
    }

    private deleteOldestEntry() {
        for (const entry of this) {
            this.delete(entry[0])
            return
        }
    }
}
