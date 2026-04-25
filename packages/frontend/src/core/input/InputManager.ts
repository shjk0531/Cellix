import type { ViewportManager } from '../viewport'
import type { SelectionManager } from '../selection'
import type {
    EditMode,
    EditState,
    FillRange,
    EditListener,
    FillListener,
} from './types'

// 채우기 핸들: 셀 우하단 모서리에서 ±px 이내를 감지
const FILL_HANDLE_HALF = 4

/**
 * 키보드·마우스 입력 처리기.
 *
 * 구조:
 *   - Canvas 위에 투명한 절대위치 <input> 오버레이 하나를 유지 (IME 지원)
 *   - 편집 모드 진입/종료, 수식 모드 감지, 채우기 핸들 드래그를 담당
 *   - mousemove는 requestAnimationFrame 으로 쓰로틀링
 *
 * 사용법:
 *   container는 position:relative 이어야 하며 canvas를 포함해야 함.
 */
export class InputManager {
    private readonly _canvas: HTMLCanvasElement
    private readonly _viewport: ViewportManager
    private readonly _selection: SelectionManager
    private readonly _overlay: HTMLInputElement

    private _mode: EditMode = 'none'
    private _editRow = 0
    private _editCol = 0

    private _fillDragging = false
    private _fillEndRow = 0
    private _fillEndCol = 0

    // RAF 쓰로틀링
    private _rafId: number | null = null
    private _pendingX = 0
    private _pendingY = 0

    private readonly _editListeners = new Set<EditListener>()
    private readonly _fillListeners = new Set<FillListener>()
    private readonly _onCommit: (row: number, col: number, value: string) => void

    // 이벤트 핸들러 (removeEventListener 에서 동일 참조 필요)
    private readonly _onMouseDown: (e: MouseEvent) => void
    private readonly _onMouseMoveRaw: (e: MouseEvent) => void
    private readonly _onMouseUp: (e: MouseEvent) => void
    private readonly _onDblClick: (e: MouseEvent) => void
    private readonly _onOverlayKeyDown: (e: KeyboardEvent) => void
    private readonly _onOverlayInput: () => void

    constructor(
        canvas: HTMLCanvasElement,
        container: HTMLElement,
        viewport: ViewportManager,
        selection: SelectionManager,
        onCommit: (row: number, col: number, value: string) => void,
    ) {
        this._canvas = canvas
        this._viewport = viewport
        this._selection = selection
        this._onCommit = onCommit
        this._overlay = this._createOverlay(container)

        this._onMouseDown = this._handleMouseDown.bind(this)
        this._onMouseMoveRaw = this._handleMouseMoveRaw.bind(this)
        this._onMouseUp = this._handleMouseUp.bind(this)
        this._onDblClick = this._handleDblClick.bind(this)
        this._onOverlayKeyDown = this._handleOverlayKeyDown.bind(this)
        this._onOverlayInput = this._handleOverlayInput.bind(this)

        canvas.addEventListener('mousedown', this._onMouseDown)
        canvas.addEventListener('mousemove', this._onMouseMoveRaw)
        canvas.addEventListener('mouseup', this._onMouseUp)
        canvas.addEventListener('dblclick', this._onDblClick)
        this._overlay.addEventListener('keydown', this._onOverlayKeyDown)
        this._overlay.addEventListener('input', this._onOverlayInput)
    }

    // ── 퍼블릭 API ──────────────────────────────────────────────────────────────

    subscribeEdit(listener: EditListener): () => void {
        this._editListeners.add(listener)
        return () => this._editListeners.delete(listener)
    }

    onFill(listener: FillListener): () => void {
        this._fillListeners.add(listener)
        return () => this._fillListeners.delete(listener)
    }

    getEditState(): EditState {
        return {
            mode: this._mode,
            row: this._editRow,
            col: this._editCol,
            value: this._overlay.value,
        }
    }

    /** 외부에서 activeCell이 바뀐 뒤 오버레이 위치를 동기화 */
    syncOverlay(): void {
        const active = this._selection.getActiveCell()
        if (active) this._positionOverlay(active.row, active.col)
    }

    destroy(): void {
        this._canvas.removeEventListener('mousedown', this._onMouseDown)
        this._canvas.removeEventListener('mousemove', this._onMouseMoveRaw)
        this._canvas.removeEventListener('mouseup', this._onMouseUp)
        this._canvas.removeEventListener('dblclick', this._onDblClick)
        this._overlay.removeEventListener('keydown', this._onOverlayKeyDown)
        this._overlay.removeEventListener('input', this._onOverlayInput)

        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId)
            this._rafId = null
        }

        this._overlay.remove()
        this._editListeners.clear()
        this._fillListeners.clear()
    }

    // ── 오버레이 관리 ────────────────────────────────────────────────────────────

    private _createOverlay(container: HTMLElement): HTMLInputElement {
        const el = document.createElement('input')
        el.type = 'text'
        el.setAttribute('autocomplete', 'off')
        el.setAttribute('autocorrect', 'off')
        el.setAttribute('autocapitalize', 'off')
        el.setAttribute('spellcheck', 'false')

        Object.assign(el.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: '1px',
            height: '1px',
            opacity: '0',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'transparent',
            fontSize: '13px',
            padding: '0',
            margin: '0',
            zIndex: '10',
            pointerEvents: 'none',
            overflow: 'hidden',
        })

        container.appendChild(el)
        return el
    }

    private _positionOverlay(row: number, col: number): void {
        const { x, y } = this._viewport.cellToPixel(row, col)
        this._overlay.style.left = `${this._canvas.offsetLeft + x}px`
        this._overlay.style.top = `${this._canvas.offsetTop + y}px`
    }

    private _showOverlay(row: number, col: number, value: string): void {
        const w = this._viewport.getColWidth(col)
        const h = this._viewport.getRowHeight(row)

        this._overlay.value = value
        Object.assign(this._overlay.style, {
            opacity: '1',
            color: 'inherit',
            pointerEvents: 'auto',
            width: `${w}px`,
            height: `${h}px`,
        })
        this._positionOverlay(row, col)
        this._overlay.focus()

        const len = value.length
        this._overlay.setSelectionRange(len, len)
    }

    private _hideOverlay(): void {
        Object.assign(this._overlay.style, {
            opacity: '0',
            color: 'transparent',
            pointerEvents: 'none',
            width: '1px',
            height: '1px',
        })
        this._overlay.value = ''
    }

    // ── 편집 모드 ────────────────────────────────────────────────────────────────

    private _enterEditMode(row: number, col: number, initialValue = ''): void {
        this._mode = initialValue.startsWith('=') ? 'formula' : 'edit'
        this._editRow = row
        this._editCol = col

        if (this._mode === 'formula') {
            this._selection.setFormulaMode(true)
        }

        this._showOverlay(row, col, initialValue)
        this._notifyEdit()
    }

    private _commitEdit(): void {
        if (this._mode === 'none') return

        this._onCommit(this._editRow, this._editCol, this._overlay.value)

        if (this._mode === 'formula') this._selection.setFormulaMode(false)
        this._mode = 'none'
        this._hideOverlay()
        this._notifyEdit()
    }

    private _cancelEdit(): void {
        if (this._mode === 'none') return

        if (this._mode === 'formula') this._selection.setFormulaMode(false)
        this._mode = 'none'
        this._hideOverlay()
        this._notifyEdit()
    }

    // ── 채우기 핸들 ──────────────────────────────────────────────────────────────

    /** (x, y)가 마지막 선택 범위의 채우기 핸들 위에 있는지 판정 */
    private _detectFillHandle(x: number, y: number): boolean {
        const selections = this._selection.getSelections()
        if (selections.length === 0) return false

        const last = selections[selections.length - 1]
        const endRow = Math.max(last.start.row, last.end.row)
        const endCol = Math.max(last.start.col, last.end.col)

        const p = this._viewport.cellToPixel(endRow, endCol)
        const cx = p.x + this._viewport.getColWidth(endCol)
        const cy = p.y + this._viewport.getRowHeight(endRow)

        return (
            x >= cx - FILL_HANDLE_HALF &&
            x <= cx + FILL_HANDLE_HALF &&
            y >= cy - FILL_HANDLE_HALF &&
            y <= cy + FILL_HANDLE_HALF
        )
    }

    private _startFillDrag(): void {
        const selections = this._selection.getSelections()
        if (selections.length === 0) return

        const last = selections[selections.length - 1]
        this._fillDragging = true
        this._fillEndRow = Math.max(last.start.row, last.end.row)
        this._fillEndCol = Math.max(last.start.col, last.end.col)
    }

    /**
     * 드래그 끝점(endRow, endCol)으로부터 채우기 방향을 결정.
     * 끝점이 현재 선택 범위 내부이면 null 반환.
     */
    private _resolveFillDirection(
        endRow: number,
        endCol: number,
    ): 'up' | 'down' | 'left' | 'right' | null {
        const selections = this._selection.getSelections()
        if (selections.length === 0) return null

        const last = selections[selections.length - 1]
        const rMin = Math.min(last.start.row, last.end.row)
        const rMax = Math.max(last.start.row, last.end.row)
        const cMin = Math.min(last.start.col, last.end.col)
        const cMax = Math.max(last.start.col, last.end.col)

        const dr =
            endRow < rMin ? endRow - rMin : endRow > rMax ? endRow - rMax : 0
        const dc =
            endCol < cMin ? endCol - cMin : endCol > cMax ? endCol - cMax : 0

        if (dr === 0 && dc === 0) return null
        return Math.abs(dr) >= Math.abs(dc)
            ? dr > 0 ? 'down' : 'up'
            : dc > 0 ? 'right' : 'left'
    }

    // ── 이벤트 핸들러 ────────────────────────────────────────────────────────────

    private _handleMouseDown(e: MouseEvent): void {
        const x = e.offsetX
        const y = e.offsetY

        if (this._detectFillHandle(x, y)) {
            e.preventDefault()
            this._startFillDrag()
            return
        }

        const cell = this._viewport.pixelToCell(x, y)

        // 수식 모드에서 Ctrl+클릭 → 참조 추가 (편집 유지)
        if (this._mode === 'formula' && e.ctrlKey) {
            this._selection.handleMouseDown(cell.row, cell.col, {
                shift: false,
                ctrl: true,
            })
            e.preventDefault()
            return
        }

        // 편집 중 다른 셀 클릭 → 확정
        if (this._mode !== 'none') {
            this._commitEdit()
        }

        this._selection.handleMouseDown(cell.row, cell.col, {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
        })
        this._positionOverlay(cell.row, cell.col)
        this._overlay.focus()
    }

    private _handleMouseMoveRaw(e: MouseEvent): void {
        this._pendingX = e.offsetX
        this._pendingY = e.offsetY

        if (this._rafId !== null) return
        this._rafId = requestAnimationFrame(this._processMouseMove)
    }

    // 화살표 함수: RAF 콜백으로 전달할 때 this 바인딩 보장
    private readonly _processMouseMove = (): void => {
        this._rafId = null
        const x = this._pendingX
        const y = this._pendingY
        const cell = this._viewport.pixelToCell(x, y)

        if (this._fillDragging) {
            this._fillEndRow = cell.row
            this._fillEndCol = cell.col
            return
        }

        if (this._selection.getState().isDragging) {
            this._selection.handleMouseMove(cell.row, cell.col)
        }

        this._canvas.style.cursor = this._detectFillHandle(x, y)
            ? 'crosshair'
            : 'cell'
    }

    private _handleMouseUp(_e: MouseEvent): void {
        if (this._fillDragging) {
            this._fillDragging = false

            const direction = this._resolveFillDirection(
                this._fillEndRow,
                this._fillEndCol,
            )
            if (direction !== null) {
                const range: FillRange = {
                    direction,
                    endRow: this._fillEndRow,
                    endCol: this._fillEndCol,
                }
                for (const fn of this._fillListeners) fn(range)
            }
            return
        }

        this._selection.handleMouseUp()
    }

    private _handleDblClick(e: MouseEvent): void {
        const cell = this._viewport.pixelToCell(e.offsetX, e.offsetY)
        this._enterEditMode(cell.row, cell.col)
        e.preventDefault()
    }

    private _handleOverlayKeyDown(e: KeyboardEvent): void {
        if (this._mode === 'none') {
            this._handleNavKeyDown(e)
        } else {
            this._handleEditKeyDown(e)
        }
    }

    private _handleNavKeyDown(e: KeyboardEvent): void {
        if (e.key === 'F2') {
            const active = this._selection.getActiveCell()
            if (active) this._enterEditMode(active.row, active.col)
            e.preventDefault()
            return
        }

        const handled = this._selection.handleKeyDown(e.key, {
            shift: e.shiftKey,
            ctrl: e.ctrlKey || e.metaKey,
        })

        if (handled) {
            e.preventDefault()
            const active = this._selection.getActiveCell()
            if (active) this._positionOverlay(active.row, active.col)
            return
        }

        // 출력 가능한 문자 → 편집 모드 진입 (문자는 기본 동작으로 input에 삽입됨)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            const active = this._selection.getActiveCell()
            if (active) this._enterEditMode(active.row, active.col, '')
        }
    }

    private _handleEditKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this._cancelEdit()
            e.preventDefault()
            return
        }

        // Alt+Enter는 셀 내 줄바꿈 허용 (확정하지 않음)
        if (e.key === 'Enter' && !e.altKey) {
            this._commitEdit()
            this._selection.handleKeyDown('Enter', { shift: e.shiftKey, ctrl: false })
            const active = this._selection.getActiveCell()
            if (active) this._positionOverlay(active.row, active.col)
            e.preventDefault()
            return
        }

        if (e.key === 'Tab') {
            this._commitEdit()
            this._selection.handleKeyDown('Tab', { shift: e.shiftKey, ctrl: false })
            const active = this._selection.getActiveCell()
            if (active) this._positionOverlay(active.row, active.col)
            e.preventDefault()
        }
    }

    private _handleOverlayInput(): void {
        if (this._mode === 'none') return

        const isFormula = this._overlay.value.startsWith('=')

        if (isFormula && this._mode === 'edit') {
            this._mode = 'formula'
            this._selection.setFormulaMode(true)
        } else if (!isFormula && this._mode === 'formula') {
            this._mode = 'edit'
            this._selection.setFormulaMode(false)
        }

        this._notifyEdit()
    }

    // ── 내부 유틸 ────────────────────────────────────────────────────────────────

    private _notifyEdit(): void {
        const state = this.getEditState()
        for (const fn of this._editListeners) fn(state)
    }
}
