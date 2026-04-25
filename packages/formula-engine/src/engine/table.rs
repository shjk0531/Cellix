use super::workbook::TableMeta;

/// Resolves a structured reference to a cell range (start_row, start_col, end_row, end_col).
/// All coordinates are 0-based. Returns None if the table or column is not found.
pub fn resolve_structured_ref(
    table: &str,
    column: Option<&str>,
    specifier: Option<&str>,
    this_row: bool,
    current_row: u32,
    tables: &[TableMeta],
) -> Option<(u32, u32, u32, u32)> {
    let meta = tables.iter().find(|t| t.name.eq_ignore_ascii_case(table))?;

    let data_start = if meta.has_header { meta.start_row + 1 } else { meta.start_row };
    let data_end = if meta.has_total {
        meta.end_row.saturating_sub(1)
    } else {
        meta.end_row
    };

    let (row_start, row_end) = match specifier {
        Some(s) if s.eq_ignore_ascii_case("#All") => (meta.start_row, meta.end_row),
        Some(s) if s.eq_ignore_ascii_case("#Headers") => {
            if meta.has_header { (meta.start_row, meta.start_row) } else { return None; }
        }
        Some(s) if s.eq_ignore_ascii_case("#Totals") => {
            if meta.has_total { (meta.end_row, meta.end_row) } else { return None; }
        }
        _ => {
            if this_row { (current_row, current_row) } else { (data_start, data_end) }
        }
    };

    let (col_start, col_end) = if let Some(col_name) = column {
        let idx = meta.columns.iter().position(|c| c.eq_ignore_ascii_case(col_name))?;
        let col = meta.start_col + idx as u32;
        (col, col)
    } else {
        (meta.start_col, meta.end_col)
    };

    Some((row_start, col_start, row_end, col_end))
}
