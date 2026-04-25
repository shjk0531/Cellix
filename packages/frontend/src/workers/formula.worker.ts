import init, { FormulaEngine } from '../../../formula-engine/pkg/formula_engine.js'

type WorkerMsg =
  | { id: string; type: 'INIT' }
  | { id: string; type: 'ADD_SHEET'; sheetId: string; name: string }
  | { id: string; type: 'REMOVE_SHEET'; sheetId: string }
  | { id: string; type: 'SET_ACTIVE_SHEET'; sheetId: string }
  | { id: string; type: 'SET_CELL'; sheetId: string; row: number; col: number; dataJson: string }
  | { id: string; type: 'GET_VALUE'; sheetId: string; row: number; col: number }
  | { id: string; type: 'GET_FORMULA'; sheetId: string; row: number; col: number }
  | { id: string; type: 'BATCH_SET'; updatesJson: string }
  | { id: string; type: 'LOAD_SHEET'; sheetId: string; cellsJson: string }
  | { id: string; type: 'PARSE_REFS'; formula: string }
  | { id: string; type: 'REGISTER_TABLE'; tableJson: string }
  | { id: string; type: 'UNREGISTER_TABLE'; tableId: string }

let engine: FormulaEngine | null = null

self.onmessage = async (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data
  try {
    if (msg.type === 'INIT') {
      await init()
      engine = new FormulaEngine()
      self.postMessage({ id: msg.id, ok: true })
      return
    }
    if (!engine) throw new Error('Engine not initialized')

    switch (msg.type) {
      case 'ADD_SHEET':
        engine.add_sheet(msg.sheetId, msg.name)
        self.postMessage({ id: msg.id, ok: true })
        break
      case 'REMOVE_SHEET':
        engine.remove_sheet(msg.sheetId)
        self.postMessage({ id: msg.id, ok: true })
        break
      case 'SET_ACTIVE_SHEET':
        engine.set_active_sheet(msg.sheetId)
        self.postMessage({ id: msg.id, ok: true })
        break
      case 'SET_CELL': {
        const changedJson = engine.set_cell(msg.sheetId, msg.row, msg.col, msg.dataJson)
        self.postMessage({ id: msg.id, ok: true, data: changedJson })
        break
      }
      case 'GET_VALUE': {
        const valJson = engine.get_cell_value(msg.sheetId, msg.row, msg.col)
        self.postMessage({ id: msg.id, ok: true, data: valJson })
        break
      }
      case 'GET_FORMULA': {
        const formula = engine.get_cell_formula(msg.sheetId, msg.row, msg.col)
        self.postMessage({ id: msg.id, ok: true, data: formula ?? null })
        break
      }
      case 'BATCH_SET': {
        const changedJson = engine.batch_set(msg.updatesJson)
        self.postMessage({ id: msg.id, ok: true, data: changedJson })
        break
      }
      case 'LOAD_SHEET':
        engine.load_sheet(msg.sheetId, msg.cellsJson)
        self.postMessage({ id: msg.id, ok: true })
        break
      case 'PARSE_REFS': {
        const refsJson = engine.parse_refs(msg.formula)
        self.postMessage({ id: msg.id, ok: true, data: refsJson })
        break
      }
      case 'REGISTER_TABLE':
        engine.register_table(msg.tableJson)
        self.postMessage({ id: msg.id, ok: true })
        break
      case 'UNREGISTER_TABLE':
        engine.unregister_table(msg.tableId)
        self.postMessage({ id: msg.id, ok: true })
        break
    }
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: String(err) })
  }
}
