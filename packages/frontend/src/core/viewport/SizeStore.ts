/**
 * Memory-efficient size store backed by Uint16Array.
 *
 * Layout:
 *   data[i]          – size of cell i (px), max 65535
 *   chunkSums[c]     – cumulative pixel total up to and including chunk c
 *                      (i.e. prefix sum of all chunks 0..c)
 *
 * Complexity:
 *   getOffset(i)     – O(CHUNK_SIZE)  ≈ O(512)
 *   findIndex(p)     – O(log C + CHUNK_SIZE)  where C = number of chunks
 *   setSize(i, v)    – O((C - floor(i/CHUNK_SIZE)) * CHUNK_SIZE)  (rebuilds tail)
 *
 * Memory (1 048 576 rows, CHUNK=512):
 *   data             – 2 097 152 B  ≈ 2 MB
 *   chunkSums        – 2 048 × 8 B  = 16 KB
 */
export class SizeStore {
    readonly data: Uint16Array;
    private readonly chunkSums: Float64Array;
    readonly defaultSize: number;
    readonly count: number;
    private readonly chunkSize: number;

    constructor(count: number, defaultSize: number, chunkSize: number) {
        this.count = count;
        this.defaultSize = defaultSize;
        this.chunkSize = chunkSize;

        this.data = new Uint16Array(count).fill(defaultSize);

        const numChunks = Math.ceil(count / chunkSize);
        this.chunkSums = new Float64Array(numChunks);

        // Fast O(C) init — each chunk has uniform size
        for (let c = 0; c < numChunks - 1; c++) {
            this.chunkSums[c] = (c + 1) * chunkSize * defaultSize;
        }
        // Last chunk may be shorter
        const lastChunk = numChunks - 1;
        const lastLen = count - lastChunk * chunkSize;
        this.chunkSums[lastChunk] =
            lastChunk * chunkSize * defaultSize + lastLen * defaultSize;
    }

    getSize(i: number): number {
        return this.data[i];
    }

    getTotalSize(): number {
        return this.chunkSums[this.chunkSums.length - 1];
    }

    /** Absolute pixel offset of index i (left/top edge of cell i). */
    getOffset(i: number): number {
        if (i <= 0) return 0;
        const chunk = Math.floor(i / this.chunkSize);
        const rem = i % this.chunkSize;
        let offset = chunk > 0 ? this.chunkSums[chunk - 1] : 0;
        const base = chunk * this.chunkSize;
        for (let j = base; j < base + rem; j++) {
            offset += this.data[j];
        }
        return offset;
    }

    /**
     * Populate `out[k] = getOffset(start + k)` for k in [0, count).
     * O(count + CHUNK_SIZE) — much faster than calling getOffset repeatedly.
     */
    getOffsetRange(start: number, count: number, out: Float64Array): void {
        out[0] = this.getOffset(start);
        for (let k = 0; k < count - 1; k++) {
            out[k + 1] = out[k] + this.data[start + k];
        }
    }

    /**
     * Returns the index whose cell contains pixel position p,
     * along with its left/top edge offset.
     */
    findIndex(p: number): { index: number; offset: number } {
        if (p <= 0) return { index: 0, offset: 0 };
        const total = this.getTotalSize();
        if (p >= total) {
            const last = this.count - 1;
            return { index: last, offset: total - this.data[last] };
        }

        // Binary search over chunk sums
        let lo = 0;
        let hi = this.chunkSums.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.chunkSums[mid] <= p) lo = mid + 1;
            else hi = mid;
        }

        // Linear scan within the found chunk
        const base = lo * this.chunkSize;
        let offset = lo > 0 ? this.chunkSums[lo - 1] : 0;
        const end = Math.min(base + this.chunkSize, this.count);
        for (let i = base; i < end; i++) {
            const next = offset + this.data[i];
            if (next > p) return { index: i, offset };
            offset = next;
        }

        return { index: this.count - 1, offset };
    }

    setSize(i: number, size: number): void {
        if (i < 0 || i >= this.count) return;
        this.data[i] = Math.max(0, Math.min(65535, size));
        this._rebuildFrom(Math.floor(i / this.chunkSize));
    }

    private _rebuildFrom(fromChunk: number): void {
        let running = fromChunk > 0 ? this.chunkSums[fromChunk - 1] : 0;
        for (let c = fromChunk; c < this.chunkSums.length; c++) {
            const start = c * this.chunkSize;
            const end = Math.min(start + this.chunkSize, this.count);
            let chunkTotal = 0;
            for (let i = start; i < end; i++) chunkTotal += this.data[i];
            running += chunkTotal;
            this.chunkSums[c] = running;
        }
    }
}
