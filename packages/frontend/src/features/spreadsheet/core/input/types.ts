export type EditMode = "none" | "edit" | "formula";

export interface EditState {
    mode: EditMode;
    row: number;
    col: number;
    value: string;
}

export interface FillRange {
    direction: "up" | "down" | "left" | "right";
    endRow: number;
    endCol: number;
}

export type EditListener = (state: EditState) => void;
export type FillListener = (range: FillRange) => void;
