pub mod workbook;
pub mod dependency;
pub mod table;

use workbook::{Workbook, JsCellData, TableMeta};
use dependency::{DependencyGraph, CellKey};
use crate::parser::{Parser, ast::Expr};
use crate::evaluator::{Evaluator, CellVal, RangeVal, EvalContext};
use std::collections::HashSet;
use serde::{Deserialize, Serialize};

// ── EvalContext impl ───────────────────────────────────────────────────────────

struct WorkbookContext<'a> {
    workbook: &'a Workbook,
    current_sheet_id: &'a str,
}

impl<'a> EvalContext for WorkbookContext<'a> {
    fn get_cell(&self, sheet: Option<&str>, row: u32, col: u32) -> CellVal {
        let sid = sheet.unwrap_or(self.current_sheet_id);
        let s = match self.workbook.sheets.iter().find(|s| s.name == sid || s.id == sid) {
            Some(s) => s,
            None => return CellVal::Error("#REF!".to_string()),
        };
        match s.cells.get(&(row, col)) {
            None => CellVal::Null,
            Some(entry) => {
                if entry.raw.formula.is_some() {
                    entry.cached.clone().unwrap_or(CellVal::Null)
                } else {
                    js_val_to_cell_val(&entry.raw.value)
                }
            }
        }
    }

    fn get_range(
        &self,
        sheet: Option<&str>,
        start_row: u32,
        start_col: u32,
        end_row: u32,
        end_col: u32,
    ) -> RangeVal {
        let rows = (end_row.saturating_sub(start_row) + 1) as usize;
        let cols = (end_col.saturating_sub(start_col) + 1) as usize;
        let mut data = Vec::with_capacity(rows);
        for r in start_row..=end_row {
            let mut row_data = Vec::with_capacity(cols);
            for c in start_col..=end_col {
                row_data.push(self.get_cell(sheet, r, c));
            }
            data.push(row_data);
        }
        RangeVal { rows, cols, data }
    }

    fn get_table_range(
        &self,
        table_name: &str,
        column: Option<&str>,
        specifier: Option<&str>,
        this_row: Option<u32>,
    ) -> RangeVal {
        let is_this_row = this_row.is_some();
        let current_row = this_row.unwrap_or(0);
        match table::resolve_structured_ref(
            table_name, column, specifier, is_this_row, current_row, &self.workbook.tables,
        ) {
            None => RangeVal { rows: 0, cols: 0, data: vec![] },
            Some((r1, c1, r2, c2)) => {
                let sheet_id = self.workbook.tables.iter()
                    .find(|t| t.name.eq_ignore_ascii_case(table_name))
                    .map(|t| t.sheet_id.as_str())
                    .unwrap_or(self.current_sheet_id);
                self.get_range(Some(sheet_id), r1, c1, r2, c2)
            }
        }
    }

    fn current_sheet(&self) -> &str {
        self.current_sheet_id
    }
}

fn js_val_to_cell_val(value: &Option<serde_json::Value>) -> CellVal {
    match value {
        None | Some(serde_json::Value::Null) => CellVal::Null,
        Some(serde_json::Value::Number(n)) => CellVal::Number(n.as_f64().unwrap_or(0.0)),
        Some(serde_json::Value::String(s)) => CellVal::Text(s.clone()),
        Some(serde_json::Value::Bool(b)) => CellVal::Bool(*b),
        _ => CellVal::Null,
    }
}

// ── Public types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CellUpdate {
    pub sheet_id: String,
    pub row: u32,
    pub col: u32,
    pub data: JsCellData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangedCell {
    pub sheet_id: String,
    pub row: u32,
    pub col: u32,
    pub value: CellVal,
}

// ── Engine ────────────────────────────────────────────────────────────────────

pub struct Engine {
    pub workbook: Workbook,
    dep_graph: DependencyGraph,
}

impl Engine {
    pub fn new() -> Self {
        Engine { workbook: Workbook::new(), dep_graph: DependencyGraph::new() }
    }

    pub fn add_sheet(&mut self, id: String, name: String) {
        self.workbook.add_sheet(id, name);
    }

    pub fn remove_sheet(&mut self, id: &str) {
        self.workbook.remove_sheet(id);
    }

    pub fn set_active_sheet(&mut self, id: &str) {
        self.workbook.set_active_sheet(id);
    }

    pub fn set_cell(
        &mut self,
        sheet_id: &str,
        row: u32,
        col: u32,
        data: JsCellData,
    ) -> Vec<ChangedCell> {
        let cell_key: CellKey = (sheet_id.to_string(), row, col);
        let new_deps = formula_deps(data.formula.as_deref(), sheet_id);
        self.dep_graph.update_deps(cell_key, new_deps);

        if let Some(sheet) = self.workbook.get_sheet_mut(sheet_id) {
            sheet.set_cell(row, col, data);
        } else {
            return vec![];
        }
        self.recalc_dependents(vec![(sheet_id.to_string(), row, col)])
    }

    pub fn get_cell_value(&self, sheet_id: &str, row: u32, col: u32) -> CellVal {
        let ctx = WorkbookContext { workbook: &self.workbook, current_sheet_id: sheet_id };
        ctx.get_cell(Some(sheet_id), row, col)
    }

    pub fn get_cell_formula(&self, sheet_id: &str, row: u32, col: u32) -> Option<String> {
        self.workbook
            .get_sheet(sheet_id)
            .and_then(|s| s.cells.get(&(row, col)))
            .and_then(|e| e.raw.formula.clone())
    }

    pub fn batch_set(&mut self, updates: Vec<CellUpdate>) -> Vec<ChangedCell> {
        let mut changed_keys: Vec<(String, u32, u32)> = Vec::new();
        for update in updates {
            let cell_key: CellKey = (update.sheet_id.clone(), update.row, update.col);
            let new_deps = formula_deps(update.data.formula.as_deref(), &update.sheet_id);
            self.dep_graph.update_deps(cell_key, new_deps);
            if let Some(sheet) = self.workbook.get_sheet_mut(&update.sheet_id) {
                sheet.set_cell(update.row, update.col, update.data);
            }
            changed_keys.push((update.sheet_id, update.row, update.col));
        }
        self.recalc_dependents(changed_keys)
    }

    pub fn load_sheet(&mut self, _sheet_id: &str, cells: Vec<CellUpdate>) {
        let mut changed_keys: Vec<(String, u32, u32)> = Vec::new();
        for update in cells {
            let cell_key: CellKey = (update.sheet_id.clone(), update.row, update.col);
            let new_deps = formula_deps(update.data.formula.as_deref(), &update.sheet_id);
            self.dep_graph.update_deps(cell_key, new_deps);
            let sid = update.sheet_id.clone();
            let r = update.row;
            let c = update.col;
            if let Some(sheet) = self.workbook.get_sheet_mut(&sid) {
                sheet.set_cell(r, c, update.data);
            }
            changed_keys.push((sid, r, c));
        }
        self.recalc_dependents(changed_keys);
    }

    pub fn register_table(&mut self, table: TableMeta) {
        self.workbook.tables.retain(|t| t.id != table.id);
        self.workbook.tables.push(table);
    }

    pub fn unregister_table(&mut self, table_id: &str) {
        self.workbook.tables.retain(|t| t.id != table_id);
    }

    // ── internals ─────────────────────────────────────────────────────────────

    fn recalc_dependents(&mut self, changed: Vec<(String, u32, u32)>) -> Vec<ChangedCell> {
        let dirty: HashSet<CellKey> = changed.into_iter().collect();
        let order = self.dep_graph.topological_sort(dirty);
        let mut result = Vec::new();
        for (sheet_id, row, col) in &order {
            self.recalc_cell(sheet_id, *row, *col);
            let value = self.get_cell_value(sheet_id, *row, *col);
            result.push(ChangedCell { sheet_id: sheet_id.clone(), row: *row, col: *col, value });
        }
        result
    }

    fn recalc_cell(&mut self, sheet_id: &str, row: u32, col: u32) {
        let formula = match self.workbook.get_sheet(sheet_id)
            .and_then(|s| s.cells.get(&(row, col)))
            .and_then(|e| e.raw.formula.clone())
        {
            Some(f) => f,
            None => return,
        };

        let result = match Parser::parse(&formula) {
            Ok(expr) => {
                let ctx = WorkbookContext {
                    workbook: &self.workbook,
                    current_sheet_id: sheet_id,
                };
                Evaluator::eval(&expr, &ctx, Some(row))
            }
            Err(_) => CellVal::Error("#ERROR!".to_string()),
        };

        if let Some(sheet) = self.workbook.get_sheet_mut(sheet_id) {
            if let Some(entry) = sheet.cells.get_mut(&(row, col)) {
                entry.cached = Some(result);
            }
        }
    }

    pub fn extract_deps(expr: &Expr, default_sheet: &str) -> HashSet<CellKey> {
        let mut deps = HashSet::new();
        collect_deps(expr, default_sheet, &mut deps);
        deps
    }
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn formula_deps(formula: Option<&str>, sheet_id: &str) -> HashSet<CellKey> {
    match formula {
        None => HashSet::new(),
        Some(f) => match Parser::parse(f) {
            Ok(expr) => Engine::extract_deps(&expr, sheet_id),
            Err(_) => HashSet::new(),
        },
    }
}

fn collect_deps(expr: &Expr, default_sheet: &str, deps: &mut HashSet<CellKey>) {
    match expr {
        Expr::CellRef { sheet, row, col, .. } => {
            let sid = sheet.as_deref().unwrap_or(default_sheet).to_string();
            deps.insert((sid, *row, *col));
        }
        Expr::RangeRef { sheet, start_row, start_col, end_row, end_col, .. } => {
            let sid = sheet.as_deref().unwrap_or(default_sheet).to_string();
            for r in *start_row..=*end_row {
                for c in *start_col..=*end_col {
                    deps.insert((sid.clone(), r, c));
                }
            }
        }
        Expr::FunctionCall { args, .. } => {
            for arg in args { collect_deps(arg, default_sheet, deps); }
        }
        Expr::BinaryOp { left, right, .. } => {
            collect_deps(left, default_sheet, deps);
            collect_deps(right, default_sheet, deps);
        }
        Expr::UnaryNeg(e) | Expr::Percent(e) => collect_deps(e, default_sheet, deps),
        Expr::Concat { left, right } => {
            collect_deps(left, default_sheet, deps);
            collect_deps(right, default_sheet, deps);
        }
        _ => {}
    }
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn num_cell(v: f64) -> JsCellData {
        JsCellData { value: Some(serde_json::json!(v)), formula: None }
    }

    fn formula_cell(f: &str) -> JsCellData {
        JsCellData { value: None, formula: Some(f.to_string()) }
    }

    #[test]
    fn test_basic_formula() {
        let mut engine = Engine::new();
        engine.add_sheet("s1".to_string(), "Sheet1".to_string());
        engine.set_cell("s1", 0, 0, num_cell(10.0));
        engine.set_cell("s1", 1, 0, num_cell(20.0));
        engine.set_cell("s1", 2, 0, formula_cell("=A1+A2"));
        assert_eq!(engine.get_cell_value("s1", 2, 0), CellVal::Number(30.0));
    }

    #[test]
    fn test_cascade_recalc() {
        let mut engine = Engine::new();
        engine.add_sheet("s1".to_string(), "Sheet1".to_string());
        engine.set_cell("s1", 0, 0, num_cell(5.0));
        engine.set_cell("s1", 1, 0, formula_cell("=A1*2"));
        engine.set_cell("s1", 2, 0, formula_cell("=A2+1"));
        assert_eq!(engine.get_cell_value("s1", 1, 0), CellVal::Number(10.0));
        assert_eq!(engine.get_cell_value("s1", 2, 0), CellVal::Number(11.0));
        engine.set_cell("s1", 0, 0, num_cell(7.0));
        assert_eq!(engine.get_cell_value("s1", 1, 0), CellVal::Number(14.0));
        assert_eq!(engine.get_cell_value("s1", 2, 0), CellVal::Number(15.0));
    }

    #[test]
    fn test_batch_set() {
        let mut engine = Engine::new();
        engine.add_sheet("s1".to_string(), "Sheet1".to_string());
        engine.batch_set(vec![
            CellUpdate { sheet_id: "s1".to_string(), row: 0, col: 0, data: num_cell(3.0) },
            CellUpdate { sheet_id: "s1".to_string(), row: 1, col: 0, data: formula_cell("=A1*A1") },
        ]);
        assert_eq!(engine.get_cell_value("s1", 1, 0), CellVal::Number(9.0));
    }
}
