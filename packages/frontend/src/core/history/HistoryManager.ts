import type { Command, HistoryState, HistoryListener } from "./types";

const MAX_HISTORY = 100;

/**
 * 여러 Command를 하나의 undo 단위로 묶는 배치 커맨드.
 * undo 시 역순으로 실행하여 변경 전 상태를 올바르게 복원.
 */
class BatchCommand implements Command {
    constructor(
        private readonly _commands: readonly Command[],
        public readonly description?: string,
    ) {}

    execute(): void {
        for (const cmd of this._commands) cmd.execute();
    }

    undo(): void {
        for (let i = this._commands.length - 1; i >= 0; i--) {
            this._commands[i].undo();
        }
    }
}

/**
 * 실행취소 / 다시실행 이력 관리.
 *
 * 지원 기능:
 *  - Command 패턴 기반 execute() → undo() / redo() 스택 (최대 100개)
 *  - beginBatch() / endBatch()로 여러 커맨드를 하나의 undo 단위로 묶기
 *  - Ctrl+Z → undo, Ctrl+Y / Ctrl+Shift+Z → redo
 *
 * 사용법:
 *   const history = new HistoryManager()
 *   history.execute(myCommand)           // 실행 + 스택에 기록
 *
 *   history.beginBatch('paste')          // 배치 시작
 *   history.execute(cmd1)                // 즉시 실행, 배치에 누적
 *   history.execute(cmd2)
 *   history.endBatch()                   // 배치를 하나의 undo 단위로 커밋
 */
export class HistoryManager {
    private readonly _undoStack: Command[] = [];
    private readonly _redoStack: Command[] = [];

    private _batchCommands: Command[] | null = null;
    private _batchDescription: string | undefined;

    private readonly _listeners = new Set<HistoryListener>();

    // ── 구독 ──────────────────────────────────────────────────────────────────

    subscribe(listener: HistoryListener): () => void {
        this._listeners.add(listener);
        listener(this._buildState());
        return () => this._listeners.delete(listener);
    }

    getState(): HistoryState {
        return this._buildState();
    }

    // ── 커맨드 실행 ───────────────────────────────────────────────────────────

    /**
     * 커맨드를 즉시 실행하고 undo 스택에 기록.
     * beginBatch() 호출 후에는 배치에 누적되며, endBatch() 시 하나의 단위로 커밋.
     */
    execute(command: Command): void {
        command.execute();

        if (this._batchCommands !== null) {
            this._batchCommands.push(command);
            return;
        }

        this._undoStack.push(command);
        if (this._undoStack.length > MAX_HISTORY) {
            this._undoStack.shift();
        }
        this._redoStack.length = 0;
        this._notify();
    }

    // ── 배치 ─────────────────────────────────────────────────────────────────

    /** 배치 시작. 이후 execute()는 즉시 실행되지만 undo 단위는 하나로 묶임. */
    beginBatch(description?: string): void {
        this._batchCommands = [];
        this._batchDescription = description;
    }

    /** 배치 종료. 누적된 커맨드를 BatchCommand로 묶어 undo 스택에 추가. */
    endBatch(): void {
        if (this._batchCommands === null) return;

        const commands = this._batchCommands;
        const description = this._batchDescription;
        this._batchCommands = null;
        this._batchDescription = undefined;

        if (commands.length === 0) return;

        const batch = new BatchCommand(commands, description);
        this._undoStack.push(batch);
        if (this._undoStack.length > MAX_HISTORY) {
            this._undoStack.shift();
        }
        this._redoStack.length = 0;
        this._notify();
    }

    // ── Undo / Redo ───────────────────────────────────────────────────────────

    undo(): void {
        const command = this._undoStack.pop();
        if (!command) return;

        command.undo();
        this._redoStack.push(command);
        this._notify();
    }

    redo(): void {
        const command = this._redoStack.pop();
        if (!command) return;

        command.execute();
        this._undoStack.push(command);
        this._notify();
    }

    // ── 키보드 이벤트 ─────────────────────────────────────────────────────────

    /**
     * 키 이벤트 처리. 이벤트를 소비한 경우 true 반환.
     *   Ctrl+Z          → undo
     *   Ctrl+Y          → redo
     *   Ctrl+Shift+Z    → redo
     */
    handleKeyDown(
        key: string,
        modifiers: { shift: boolean; ctrl: boolean },
    ): boolean {
        const k = key.toLowerCase();

        if (modifiers.ctrl && !modifiers.shift && k === "z") {
            this.undo();
            return true;
        }

        if (modifiers.ctrl && (k === "y" || (modifiers.shift && k === "z"))) {
            this.redo();
            return true;
        }

        return false;
    }

    destroy(): void {
        this._listeners.clear();
        this._undoStack.length = 0;
        this._redoStack.length = 0;
    }

    // ── 내부 ─────────────────────────────────────────────────────────────────

    private _buildState(): HistoryState {
        return {
            canUndo: this._undoStack.length > 0,
            canRedo: this._redoStack.length > 0,
            undoCount: this._undoStack.length,
            redoCount: this._redoStack.length,
        };
    }

    private _notify(): void {
        const state = this._buildState();
        for (const fn of this._listeners) fn(state);
    }
}
