export interface ViewportRange {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    /** Canvas Y offset of the first visible row (negative = row starts above viewport) */
    offsetY: number;
    /** Canvas X offset of the first visible column */
    offsetX: number;
}

export interface ViewportState {
    scrollX: number;
    scrollY: number;
    viewWidth: number;
    viewHeight: number;
    range: ViewportRange;
}

export type ViewportListener = (state: ViewportState) => void;

export interface PixelPoint {
    x: number;
    y: number;
}

export interface CellCoord {
    row: number;
    col: number;
}
