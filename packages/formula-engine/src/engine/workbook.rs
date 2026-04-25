use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::evaluator::CellVal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsCellData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formula: Option<String>,
}

impl Default for JsCellData {
    fn default() -> Self {
        JsCellData { value: None, formula: None }
    }
}

#[derive(Debug, Clone)]
pub struct CellEntry {
    pub raw: JsCellData,
    pub cached: Option<CellVal>,
}

pub struct Sheet {
    pub id: String,
    pub name: String,
    pub cells: HashMap<(u32, u32), CellEntry>,
}

pub struct Workbook {
    pub sheets: Vec<Sheet>,
    pub active_sheet_idx: usize,
    pub tables: Vec<TableMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMeta {
    pub id: String,
    pub name: String,
    pub sheet_id: String,
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
    pub has_header: bool,
    pub has_total: bool,
    pub columns: Vec<String>,
}

impl Workbook {
    pub fn new() -> Self {
        Workbook { sheets: Vec::new(), active_sheet_idx: 0, tables: Vec::new() }
    }

    pub fn add_sheet(&mut self, id: String, name: String) {
        self.sheets.push(Sheet { id, name, cells: HashMap::new() });
    }

    pub fn remove_sheet(&mut self, id: &str) {
        if let Some(idx) = self.sheets.iter().position(|s| s.id == id) {
            self.sheets.remove(idx);
            if self.active_sheet_idx >= self.sheets.len() && !self.sheets.is_empty() {
                self.active_sheet_idx = self.sheets.len() - 1;
            }
        }
    }

    pub fn get_sheet_mut(&mut self, id: &str) -> Option<&mut Sheet> {
        self.sheets.iter_mut().find(|s| s.id == id)
    }

    pub fn get_sheet(&self, id: &str) -> Option<&Sheet> {
        self.sheets.iter().find(|s| s.id == id)
    }

    pub fn active_sheet_id(&self) -> &str {
        self.sheets.get(self.active_sheet_idx).map(|s| s.id.as_str()).unwrap_or("")
    }

    pub fn set_active_sheet(&mut self, id: &str) {
        if let Some(idx) = self.sheets.iter().position(|s| s.id == id) {
            self.active_sheet_idx = idx;
        }
    }
}

impl Sheet {
    pub fn set_cell(&mut self, row: u32, col: u32, data: JsCellData) {
        self.cells.insert((row, col), CellEntry { raw: data, cached: None });
    }

    pub fn get_cell_raw(&self, row: u32, col: u32) -> Option<&JsCellData> {
        self.cells.get(&(row, col)).map(|e| &e.raw)
    }

    pub fn clear_cell(&mut self, row: u32, col: u32) {
        self.cells.remove(&(row, col));
    }

    pub fn mark_dirty_all(&mut self) {
        for entry in self.cells.values_mut() {
            entry.cached = None;
        }
    }
}
