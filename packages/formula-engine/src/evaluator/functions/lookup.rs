use crate::evaluator::{CellVal, EvalContext, Evaluator, RangeVal};
use crate::parser::ast::Expr;
use super::matches_criteria;

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "VLOOKUP"   => vlookup(args, ctx, current_row),
        "HLOOKUP"   => hlookup(args, ctx, current_row),
        "INDEX"     => index(args, ctx, current_row),
        "MATCH"     => match_fn(args, ctx, current_row),
        "OFFSET"    => offset(args, ctx, current_row),
        "INDIRECT"  => indirect(args, ctx, current_row),
        "ADDRESS"   => address(args, ctx, current_row),
        "ROW"       => row_fn(args, ctx, current_row),
        "COL"       => col_fn(args, ctx, current_row),
        "ROWS"      => rows_fn(args, ctx, current_row),
        "COLUMNS"   => columns_fn(args, ctx, current_row),
        "TRANSPOSE" => transpose(args, ctx, current_row),
        _           => CellVal::Error("#NAME?".to_string()),
    }
}

fn vlookup(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let lookup_val  = Evaluator::eval(&args[0], ctx, cr);
    let table       = Evaluator::eval_as_range(&args[1], ctx, cr);
    let col_idx     = match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as usize, Err(e) => return e };
    let range_lookup = if args.len() >= 4 { Evaluator::eval(&args[3], ctx, cr).to_bool() } else { true };

    if col_idx == 0 || col_idx > table.cols { return CellVal::Error("#REF!".to_string()); }

    if range_lookup {
        // 근사 매칭 (오름차순 정렬 가정): 찾는 값보다 크지 않은 마지막 행
        let mut best: Option<usize> = None;
        for (i, row) in table.data.iter().enumerate() {
            if let Some(v) = row.first() {
                if compare_for_lookup(v, &lookup_val) != std::cmp::Ordering::Greater {
                    best = Some(i);
                } else {
                    break;
                }
            }
        }
        match best {
            Some(i) => table.data[i].get(col_idx - 1).cloned().unwrap_or(CellVal::Null),
            None => CellVal::Error("#N/A".to_string()),
        }
    } else {
        // 정확한 매칭
        for row in &table.data {
            if let Some(v) = row.first() {
                if vals_equal(v, &lookup_val) {
                    return row.get(col_idx - 1).cloned().unwrap_or(CellVal::Null);
                }
            }
        }
        CellVal::Error("#N/A".to_string())
    }
}

fn hlookup(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let lookup_val   = Evaluator::eval(&args[0], ctx, cr);
    let table        = Evaluator::eval_as_range(&args[1], ctx, cr);
    let row_idx      = match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as usize, Err(e) => return e };
    let range_lookup = if args.len() >= 4 { Evaluator::eval(&args[3], ctx, cr).to_bool() } else { true };

    if row_idx == 0 || row_idx > table.rows { return CellVal::Error("#REF!".to_string()); }
    let first_row = match table.data.first() { Some(r) => r, None => return CellVal::Error("#N/A".to_string()) };

    if range_lookup {
        let mut best: Option<usize> = None;
        for (j, v) in first_row.iter().enumerate() {
            if compare_for_lookup(v, &lookup_val) != std::cmp::Ordering::Greater { best = Some(j); } else { break; }
        }
        match best {
            Some(j) => table.data.get(row_idx - 1).and_then(|r| r.get(j)).cloned().unwrap_or(CellVal::Null),
            None => CellVal::Error("#N/A".to_string()),
        }
    } else {
        for (j, v) in first_row.iter().enumerate() {
            if vals_equal(v, &lookup_val) {
                return table.data.get(row_idx - 1).and_then(|r| r.get(j)).cloned().unwrap_or(CellVal::Null);
            }
        }
        CellVal::Error("#N/A".to_string())
    }
}

fn index(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let array   = Evaluator::eval_as_range(&args[0], ctx, cr);
    let row_num = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v as usize, Err(e) => return e };
    let col_num = if args.len() >= 3 { match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as usize, Err(e) => return e } } else { 1 };

    if row_num == 0 || col_num == 0 { return CellVal::Error("#VALUE!".to_string()); }
    array.data.get(row_num - 1)
        .and_then(|r| r.get(col_num - 1))
        .cloned()
        .unwrap_or(CellVal::Error("#REF!".to_string()))
}

fn match_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let lookup_val  = Evaluator::eval(&args[0], ctx, cr);
    let lookup_arr  = Evaluator::eval_as_range(&args[1], ctx, cr).flat();
    let match_type  = if args.len() >= 3 { match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as i32, Err(_) => 1 } } else { 1 };

    match match_type {
        0 => {
            // 정확한 매칭 (대소문자 무시)
            for (i, v) in lookup_arr.iter().enumerate() {
                if vals_equal(v, &lookup_val) { return CellVal::Number((i + 1) as f64); }
            }
            CellVal::Error("#N/A".to_string())
        }
        1 => {
            // 근사 매칭 오름차순: 찾는 값보다 크지 않은 마지막 위치
            let mut best: Option<usize> = None;
            for (i, v) in lookup_arr.iter().enumerate() {
                if compare_for_lookup(v, &lookup_val) != std::cmp::Ordering::Greater { best = Some(i); } else { break; }
            }
            best.map(|i| CellVal::Number((i + 1) as f64)).unwrap_or(CellVal::Error("#N/A".to_string()))
        }
        -1 => {
            // 근사 매칭 내림차순: 찾는 값보다 작지 않은 마지막 위치
            let mut best: Option<usize> = None;
            for (i, v) in lookup_arr.iter().enumerate() {
                if compare_for_lookup(v, &lookup_val) != std::cmp::Ordering::Less { best = Some(i); } else { break; }
            }
            best.map(|i| CellVal::Number((i + 1) as f64)).unwrap_or(CellVal::Error("#N/A".to_string()))
        }
        _ => CellVal::Error("#VALUE!".to_string()),
    }
}

fn offset(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    // 기준 셀의 행/열 추출
    let (base_row, base_col) = match &args[0] {
        Expr::CellRef { row, col, .. } => (*row, *col),
        Expr::RangeRef { start_row, start_col, .. } => (*start_row, *start_col),
        _ => return CellVal::Error("#VALUE!".to_string()),
    };
    let rows_off = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v as i64, Err(e) => return e };
    let cols_off = match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as i64, Err(e) => return e };
    let height = if args.len() >= 4 { match Evaluator::eval(&args[3], ctx, cr).to_number() { Ok(v) => v as u32, Err(_) => 1 } } else { 1 };
    let width  = if args.len() >= 5 { match Evaluator::eval(&args[4], ctx, cr).to_number() { Ok(v) => v as u32, Err(_) => 1 } } else { 1 };

    let new_row = (base_row as i64 + rows_off) as u32;
    let new_col = (base_col as i64 + cols_off) as u32;

    if height == 1 && width == 1 {
        ctx.get_cell(None, new_row, new_col)
    } else {
        ctx.get_range(None, new_row, new_col, new_row + height - 1, new_col + width - 1)
            .data.first().and_then(|r| r.first()).cloned().unwrap_or(CellVal::Null)
    }
}

fn indirect(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let ref_text = match Evaluator::eval(&args[0], ctx, cr) {
        CellVal::Text(s) => s,
        other => return if other.is_error() { other } else { CellVal::Error("#REF!".to_string()) },
    };
    // "Sheet1!A1" 또는 "A1" 파싱
    let (sheet, cell_ref) = if let Some(pos) = ref_text.find('!') {
        (Some(ref_text[..pos].trim_matches('\'').to_string()), &ref_text[pos + 1..])
    } else {
        (None, ref_text.as_str())
    };
    if let Some((col, row)) = parse_a1(cell_ref) {
        ctx.get_cell(sheet.as_deref(), row, col)
    } else {
        CellVal::Error("#REF!".to_string())
    }
}

fn address(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let row     = match Evaluator::eval(&args[0], ctx, cr).to_number() { Ok(v) => v as u32, Err(e) => return e };
    let col     = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v as u32, Err(e) => return e };
    let abs_num = if args.len() >= 3 { match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v as u32, Err(_) => 1 } } else { 1 };
    let col_str = col_to_letter(col - 1);
    let result = match abs_num {
        1 => format!("${}${}", col_str, row),
        2 => format!("{}${}", col_str, row),
        3 => format!("${}{}", col_str, row),
        4 => format!("{}{}", col_str, row),
        _ => format!("${}${}", col_str, row),
    };
    CellVal::Text(result)
}

fn row_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() {
        return CellVal::Number(cr.map(|r| r + 1).unwrap_or(1) as f64);
    }
    let row = match &args[0] {
        Expr::CellRef { row, .. } => *row,
        Expr::RangeRef { start_row, .. } => *start_row,
        _ => match Evaluator::eval_as_range(&args[0], ctx, cr).data.first() { Some(_) => 0, None => return CellVal::Error("#REF!".to_string()) },
    };
    CellVal::Number((row + 1) as f64)
}

fn col_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Number(1.0); }
    let col = match &args[0] {
        Expr::CellRef { col, .. } => *col,
        Expr::RangeRef { start_col, .. } => *start_col,
        _ => 0,
    };
    CellVal::Number((col + 1) as f64)
}

fn rows_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let range = Evaluator::eval_as_range(&args[0], ctx, cr);
    CellVal::Number(range.rows as f64)
}

fn columns_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let range = Evaluator::eval_as_range(&args[0], ctx, cr);
    CellVal::Number(range.cols as f64)
}

fn transpose(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let range = Evaluator::eval_as_range(&args[0], ctx, cr);
    // 스칼라 컨텍스트: 첫 번째 열의 첫 번째 값 반환 (전치 후 [0][0])
    range.data.first().and_then(|r| r.first()).cloned().unwrap_or(CellVal::Null)
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

fn vals_equal(a: &CellVal, b: &CellVal) -> bool {
    match (a, b) {
        (CellVal::Number(x), CellVal::Number(y)) => (x - y).abs() < 1e-10,
        (CellVal::Text(x), CellVal::Text(y)) => x.to_lowercase() == y.to_lowercase(),
        (CellVal::Bool(x), CellVal::Bool(y)) => x == y,
        (CellVal::Null, CellVal::Null) => true,
        _ => false,
    }
}

fn compare_for_lookup(a: &CellVal, b: &CellVal) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match (a, b) {
        (CellVal::Number(x), CellVal::Number(y)) => x.partial_cmp(y).unwrap_or(Ordering::Equal),
        (CellVal::Text(x), CellVal::Text(y)) => x.to_lowercase().cmp(&y.to_lowercase()),
        _ => Ordering::Equal,
    }
}

/// "A1", "$B$3" 형식을 (col, row) 0-based로 파싱
pub fn parse_a1(s: &str) -> Option<(u32, u32)> {
    let s = s.trim().trim_start_matches('$');
    let col_end = s.find(|c: char| c.is_ascii_digit()).unwrap_or(s.len());
    let col_str = s[..col_end].trim_start_matches('$');
    let row_str = s[col_end..].trim_start_matches('$');
    let col = col_from_str(col_str)?;
    let row: u32 = row_str.parse().ok()?;
    if row == 0 { return None; }
    Some((col, row - 1))
}

fn col_from_str(s: &str) -> Option<u32> {
    let mut col = 0u32;
    for c in s.to_uppercase().chars() {
        if !c.is_ascii_alphabetic() { return None; }
        col = col * 26 + (c as u32 - 'A' as u32 + 1);
    }
    if col == 0 { None } else { Some(col - 1) }
}

pub fn col_to_letter(col: u32) -> String {
    let mut n = col;
    let mut result = String::new();
    loop {
        result.insert(0, (b'A' + (n % 26) as u8) as char);
        if n < 26 { break; }
        n = n / 26 - 1;
    }
    result
}

// ── 단위 테스트 ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evaluator::{EvalContext, RangeVal};
    use crate::parser::Parser;

    struct Ctx(Vec<Vec<CellVal>>);
    impl EvalContext for Ctx {
        fn get_cell(&self, _: Option<&str>, r: u32, c: u32) -> CellVal {
            self.0.get(r as usize).and_then(|row| row.get(c as usize)).cloned().unwrap_or(CellVal::Null)
        }
        fn get_range(&self, _: Option<&str>, sr: u32, sc: u32, er: u32, ec: u32) -> RangeVal {
            let data: Vec<Vec<CellVal>> = (sr..=er).map(|r| (sc..=ec).map(|c| self.get_cell(None, r, c)).collect()).collect();
            RangeVal { rows: (er - sr + 1) as usize, cols: (ec - sc + 1) as usize, data }
        }
        fn get_table_range(&self, _: &str, _: Option<&str>, _: Option<&str>, _: Option<u32>) -> RangeVal { RangeVal { rows: 0, cols: 0, data: vec![] } }
        fn current_sheet(&self) -> &str { "Sheet1" }
    }

    fn n(v: f64) -> CellVal { CellVal::Number(v) }
    fn s(v: &str) -> CellVal { CellVal::Text(v.to_string()) }

    fn ec(ctx: &Ctx, f: &str) -> CellVal { Evaluator::eval(&Parser::parse(f).unwrap(), ctx, None) }

    #[test]
    fn test_vlookup_exact() {
        // A열: 1,2,3 / B열: "one","two","three"
        let ctx = Ctx(vec![
            vec![n(1.0), s("one")],
            vec![n(2.0), s("two")],
            vec![n(3.0), s("three")],
        ]);
        assert_eq!(ec(&ctx, "=VLOOKUP(2,A1:B3,2,FALSE)"), s("two"));
        assert_eq!(ec(&ctx, "=VLOOKUP(4,A1:B3,2,FALSE)"), CellVal::Error("#N/A".to_string()));
    }

    #[test]
    fn test_index() {
        let ctx = Ctx(vec![
            vec![n(10.0), n(20.0)],
            vec![n(30.0), n(40.0)],
        ]);
        assert_eq!(ec(&ctx, "=INDEX(A1:B2,2,1)"), n(30.0));
    }

    #[test]
    fn test_match_exact() {
        let ctx = Ctx(vec![vec![n(1.0)], vec![n(2.0)], vec![n(3.0)]]);
        assert_eq!(ec(&ctx, "=MATCH(2,A1:A3,0)"), n(2.0));
        assert_eq!(ec(&ctx, "=MATCH(5,A1:A3,0)"), CellVal::Error("#N/A".to_string()));
    }

    #[test]
    fn test_row_col() {
        let ctx = Ctx(vec![]);
        assert_eq!(ec(&ctx, "=ROW(B5)"), n(5.0));
        assert_eq!(ec(&ctx, "=COL(C1)"), n(3.0));
    }

    #[test]
    fn test_address() {
        let ctx = Ctx(vec![]);
        assert_eq!(ec(&ctx, "=ADDRESS(1,1,1)"), s("$A$1"));
        assert_eq!(ec(&ctx, "=ADDRESS(3,4,4)"), s("D3"));
    }
}
