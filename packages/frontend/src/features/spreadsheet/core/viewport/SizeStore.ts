/**
 * Uint16Array 기반 메모리 효율적인 크기 저장소.
 *
 * 구조:
 *   data[i]          – 셀 i의 크기 (px), 최대 65535
 *   chunkSums[c]     – 청크 c까지의 누적 픽셀 합계
 *                      (즉, 청크 0..c의 누적 prefix sum)
 *
 * 시간 복잡도:
 *   getOffset(i)     – O(CHUNK_SIZE)  ≈ O(512)
 *   findIndex(p)     – O(log C + CHUNK_SIZE)  (C = 청크 수)
 *   setSize(i, v)    – O((C - floor(i/CHUNK_SIZE)) * CHUNK_SIZE)  (이후 청크 재계산)
 *
 * 메모리 사용량 (행 1,048,576개, CHUNK=512):
 *   data             – 2,097,152 B  ≈ 2 MB
 *   chunkSums        – 2,048 × 8 B  = 16 KB
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

        // 균일한 기본 크기로 O(C) 초기화
        for (let c = 0; c < numChunks - 1; c++) {
            this.chunkSums[c] = (c + 1) * chunkSize * defaultSize;
        }
        // 마지막 청크는 크기가 다를 수 있음
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

    /** 인덱스 i의 절대 픽셀 오프셋 (셀 i의 좌측/상단 모서리). */
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
     * `out[k] = getOffset(start + k)`을 k ∈ [0, count) 범위로 채움.
     * O(count + CHUNK_SIZE) — getOffset을 반복 호출하는 것보다 훨씬 빠름.
     */
    getOffsetRange(start: number, count: number, out: Float64Array): void {
        out[0] = this.getOffset(start);
        for (let k = 0; k < count - 1; k++) {
            out[k + 1] = out[k] + this.data[start + k];
        }
    }

    /**
     * 픽셀 위치 p를 포함하는 셀의 인덱스와
     * 해당 셀의 좌측/상단 모서리 오프셋을 반환.
     */
    findIndex(p: number): { index: number; offset: number } {
        if (p <= 0) return { index: 0, offset: 0 };
        const total = this.getTotalSize();
        if (p >= total) {
            const last = this.count - 1;
            return { index: last, offset: total - this.data[last] };
        }

        // 청크 합계에 대한 이진 탐색
        let lo = 0;
        let hi = this.chunkSums.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.chunkSums[mid] <= p) lo = mid + 1;
            else hi = mid;
        }

        // 찾은 청크 내 선형 탐색
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
