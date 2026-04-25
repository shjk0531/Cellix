use wasm_bindgen::prelude::*;

pub mod parser;
pub mod evaluator;
pub mod engine;

use engine::Engine as InnerEngine;
use engine::CellUpdate;
use engine::workbook::{JsCellData, TableMeta};
use parser::{Parser, ast::Expr};

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct FormulaEngine {
    inner: InnerEngine,
}

#[wasm_bindgen]
impl FormulaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FormulaEngine {
        FormulaEngine { inner: InnerEngine::new() }
    }

    pub fn add_sheet(&mut self, id: &str, name: &str) {
        self.inner.add_sheet(id.to_string(), name.to_string());
    }

    pub fn remove_sheet(&mut self, id: &str) {
        self.inner.remove_sheet(id);
    }

    pub fn set_active_sheet(&mut self, id: &str) {
        self.inner.set_active_sheet(id);
    }

    /// data_json: JsCellData JSON — returns ChangedCell[] JSON
    pub fn set_cell(&mut self, sheet_id: &str, row: u32, col: u32, data_json: &str) -> String {
        let data: JsCellData = serde_json::from_str(data_json).unwrap_or_default();
        let changed = self.inner.set_cell(sheet_id, row, col, data);
        serde_json::to_string(&changed).unwrap_or_default()
    }

    /// Returns CellVal JSON
    pub fn get_cell_value(&self, sheet_id: &str, row: u32, col: u32) -> String {
        let val = self.inner.get_cell_value(sheet_id, row, col);
        serde_json::to_string(&val).unwrap_or_default()
    }

    pub fn get_cell_formula(&self, sheet_id: &str, row: u32, col: u32) -> Option<String> {
        self.inner.get_cell_formula(sheet_id, row, col)
    }

    /// updates_json: CellUpdate[] JSON — returns ChangedCell[] JSON
    pub fn batch_set(&mut self, updates_json: &str) -> String {
        let updates: Vec<CellUpdate> = serde_json::from_str(updates_json).unwrap_or_default();
        let changed = self.inner.batch_set(updates);
        serde_json::to_string(&changed).unwrap_or_default()
    }

    /// cells_json: CellUpdate[] JSON
    pub fn load_sheet(&mut self, sheet_id: &str, cells_json: &str) {
        let cells: Vec<CellUpdate> = serde_json::from_str(cells_json).unwrap_or_default();
        self.inner.load_sheet(sheet_id, cells);
    }

    /// table_json: TableMeta JSON
    pub fn register_table(&mut self, table_json: &str) {
        if let Ok(table) = serde_json::from_str::<TableMeta>(table_json) {
            self.inner.register_table(table);
        }
    }

    pub fn unregister_table(&mut self, table_id: &str) {
        self.inner.unregister_table(table_id);
    }

    /// Returns cell reference strings (["A1","B2:C10",...]) JSON — for formula highlighting
    pub fn parse_refs(&self, formula: &str) -> String {
        let refs = match Parser::parse(formula) {
            Ok(expr) => collect_ref_strings(&expr),
            Err(_) => vec![],
        };
        serde_json::to_string(&refs).unwrap_or_default()
    }
}

fn collect_ref_strings(expr: &Expr) -> Vec<String> {
    let mut refs = Vec::new();
    collect_refs_inner(expr, &mut refs);
    refs
}

fn collect_refs_inner(expr: &Expr, refs: &mut Vec<String>) {
    match expr {
        Expr::CellRef { row, col, .. } => {
            refs.push(format!("{}{}", col_letter(*col), row + 1));
        }
        Expr::RangeRef { start_row, start_col, end_row, end_col, .. } => {
            refs.push(format!(
                "{}{}:{}{}",
                col_letter(*start_col), start_row + 1,
                col_letter(*end_col), end_row + 1,
            ));
        }
        Expr::FunctionCall { args, .. } => {
            for arg in args { collect_refs_inner(arg, refs); }
        }
        Expr::BinaryOp { left, right, .. } => {
            collect_refs_inner(left, refs);
            collect_refs_inner(right, refs);
        }
        Expr::UnaryNeg(e) | Expr::Percent(e) => collect_refs_inner(e, refs),
        Expr::Concat { left, right } => {
            collect_refs_inner(left, refs);
            collect_refs_inner(right, refs);
        }
        _ => {}
    }
}

fn col_letter(col: u32) -> String {
    let mut n = col + 1;
    let mut s = String::new();
    while n > 0 {
        n -= 1;
        s.insert(0, (b'A' + (n % 26) as u8) as char);
        n /= 26;
    }
    s
}
