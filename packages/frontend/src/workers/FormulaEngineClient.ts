export interface CellValResult {
  t: 'n' | 's' | 'b' | 'e' | 'nil'
  v?: number | string | boolean
}

export interface ChangedCellResult {
  sheet_id: string
  row: number
  col: number
  value: CellValResult
}

type Listener = (changed: ChangedCellResult[]) => void

export class FormulaEngineClient {
  private worker: Worker
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private listeners = new Set<Listener>()
  private msgIdCounter = 0
  private initialized = false

  constructor() {
    this.worker = new Worker(
      new URL('./formula.worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = this._handleMessage.bind(this)
    this.worker.onerror = (e) => console.error('[FormulaWorker]', e)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this._send({ type: 'INIT' })
    this.initialized = true
  }

  async setCell(
    sheetId: string,
    row: number,
    col: number,
    value: string | number | boolean | null,
    formula?: string,
  ): Promise<ChangedCellResult[]> {
    const dataJson = JSON.stringify({ value, formula })
    const changedJson = await this._send({ type: 'SET_CELL', sheetId, row, col, dataJson }) as string
    const changed: ChangedCellResult[] = JSON.parse(changedJson)
    this._notifyListeners(changed)
    return changed
  }

  async getCellValue(sheetId: string, row: number, col: number): Promise<CellValResult> {
    const json = await this._send({ type: 'GET_VALUE', sheetId, row, col }) as string
    return JSON.parse(json) as CellValResult
  }

  async getCellFormula(sheetId: string, row: number, col: number): Promise<string | null> {
    return this._send({ type: 'GET_FORMULA', sheetId, row, col }) as Promise<string | null>
  }

  async batchSet(updates: Array<{
    sheetId: string
    row: number
    col: number
    value: string | number | boolean | null
    formula?: string
  }>): Promise<ChangedCellResult[]> {
    const updatesJson = JSON.stringify(updates.map(u => ({
      sheet_id: u.sheetId,
      row: u.row,
      col: u.col,
      data: { value: u.value, formula: u.formula },
    })))
    const changedJson = await this._send({ type: 'BATCH_SET', updatesJson }) as string
    const changed: ChangedCellResult[] = JSON.parse(changedJson)
    this._notifyListeners(changed)
    return changed
  }

  async loadSheet(
    sheetId: string,
    cells: Array<{
      row: number
      col: number
      value: string | number | boolean | null
      formula?: string
    }>,
  ): Promise<void> {
    const cellsJson = JSON.stringify(cells.map(c => ({
      sheet_id: sheetId,
      row: c.row,
      col: c.col,
      data: { value: c.value, formula: c.formula },
    })))
    await this._send({ type: 'LOAD_SHEET', sheetId, cellsJson })
  }

  async addSheet(sheetId: string, name: string): Promise<void> {
    await this._send({ type: 'ADD_SHEET', sheetId, name })
  }

  async removeSheet(sheetId: string): Promise<void> {
    await this._send({ type: 'REMOVE_SHEET', sheetId })
  }

  async setActiveSheet(sheetId: string): Promise<void> {
    await this._send({ type: 'SET_ACTIVE_SHEET', sheetId })
  }

  async parseRefs(formula: string): Promise<string[]> {
    const json = await this._send({ type: 'PARSE_REFS', formula }) as string
    return JSON.parse(json) as string[]
  }

  async registerTable(tableJson: string): Promise<void> {
    await this._send({ type: 'REGISTER_TABLE', tableJson })
  }

  async unregisterTable(tableId: string): Promise<void> {
    await this._send({ type: 'UNREGISTER_TABLE', tableId })
  }

  onChanged(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy(): void {
    this.worker.terminate()
    this.pending.clear()
    this.listeners.clear()
  }

  private _send(msg: Record<string, unknown>): Promise<unknown> {
    const id = String(this.msgIdCounter++)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Worker timeout: ${String(msg['type'])}`))
      }, 10_000)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this.worker.postMessage({ ...msg, id })
    })
  }

  private _handleMessage(e: MessageEvent): void {
    const { id, ok, data, error } = e.data as {
      id: string
      ok: boolean
      data?: unknown
      error?: string
    }
    const handler = this.pending.get(id)
    if (!handler) return
    this.pending.delete(id)
    if (ok) handler.resolve(data)
    else handler.reject(new Error(error))
  }

  private _notifyListeners(changed: ChangedCellResult[]): void {
    for (const fn of this.listeners) fn(changed)
  }
}

export const formulaEngine = new FormulaEngineClient()
