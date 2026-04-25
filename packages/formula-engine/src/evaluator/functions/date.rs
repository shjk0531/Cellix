use crate::evaluator::{CellVal, EvalContext, Evaluator};
use crate::parser::ast::Expr;

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "TODAY"       => today(),
        "NOW"         => now(),
        "DATE"        => date(args, ctx, current_row),
        "TIME"        => time_fn(args, ctx, current_row),
        "YEAR"        => year(args, ctx, current_row),
        "MONTH"       => month(args, ctx, current_row),
        "DAY"         => day(args, ctx, current_row),
        "HOUR"        => hour(args, ctx, current_row),
        "MINUTE"      => minute(args, ctx, current_row),
        "SECOND"      => second(args, ctx, current_row),
        "WEEKDAY"     => weekday(args, ctx, current_row),
        "DATEVALUE"   => datevalue(args, ctx, current_row),
        "TIMEVALUE"   => timevalue(args, ctx, current_row),
        "DAYS"        => days(args, ctx, current_row),
        "NETWORKDAYS" => networkdays(args, ctx, current_row),
        "EDATE"       => edate(args, ctx, current_row),
        "EOMONTH"     => eomonth(args, ctx, current_row),
        "DATEDIF"     => datedif(args, ctx, current_row),
        _             => CellVal::Error("#NAME?".to_string()),
    }
}

// ── 현재 시각 ─────────────────────────────────────────────────────────────────

fn now_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    { js_sys::Date::now() }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
    }
}

fn today() -> CellVal {
    // ms → 일(0-based from 1970-01-01) + Excel 1970-01-01 serial(25569)
    CellVal::Number((now_ms() / 86400000.0).floor() + 25569.0)
}

fn now() -> CellVal {
    CellVal::Number(now_ms() / 86400000.0 + 25569.0)
}

// ── 날짜 직렬 번호 변환 ────────────────────────────────────────────────────────

/// (year, month, day) → Excel 직렬 번호 (1900-01-01 = 1, 1900 윤년 버그 포함)
pub fn ymd_to_serial(year: i32, month: i32, day: i32) -> f64 {
    let days = jdn(year, month, day) - jdn(1900, 1, 1);
    let serial = days + 1;
    if serial >= 60 { (serial + 1) as f64 } else { serial as f64 }
}

/// Excel 직렬 번호 → (year, month, day)
pub fn serial_to_ymd(serial: i64) -> (i32, i32, i32) {
    let adjusted = if serial >= 61 { serial - 1 } else { serial };
    jdn_to_ymd(jdn(1900, 1, 1) + (adjusted - 1) as i32)
}

fn jdn(y: i32, m: i32, d: i32) -> i32 {
    let a = (14 - m) / 12;
    let yr = y + 4800 - a;
    let mo = m + 12 * a - 3;
    d + (153 * mo + 2) / 5 + 365 * yr + yr / 4 - yr / 100 + yr / 400 - 32045
}

fn jdn_to_ymd(j: i32) -> (i32, i32, i32) {
    let a = j + 32044;
    let b = (4 * a + 3) / 146097;
    let c = a - 146097 * b / 4;
    let d = (4 * c + 3) / 1461;
    let e = c - 1461 * d / 4;
    let m = (5 * e + 2) / 153;
    let day   = e - (153 * m + 2) / 5 + 1;
    let month = m + 3 - 12 * (m / 10);
    let year  = 100 * b + d - 4800 + m / 10;
    (year, month, day)
}

fn day_of_week(serial: i64) -> u32 {
    // (jdn + 1) % 7 → 0=Sun, 1=Mon, ..., 6=Sat
    let (y, m, d) = serial_to_ymd(serial);
    ((jdn(y, m, d) + 1).rem_euclid(7)) as u32
}

// ── 날짜 생성/추출 ─────────────────────────────────────────────────────────────

fn get_num(args: &[Expr], idx: usize, ctx: &dyn EvalContext, cr: Option<u32>) -> Result<f64, CellVal> {
    match Evaluator::eval(&args[idx], ctx, cr).to_number() { Ok(n) => Ok(n), Err(e) => Err(e) }
}

fn date(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let y = match get_num(args, 0, ctx, cr) { Ok(v) => v as i32, Err(e) => return e };
    let m = match get_num(args, 1, ctx, cr) { Ok(v) => v as i32, Err(e) => return e };
    let d = match get_num(args, 2, ctx, cr) { Ok(v) => v as i32, Err(e) => return e };
    CellVal::Number(ymd_to_serial(y, m, d))
}

fn time_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let h  = match get_num(args, 0, ctx, cr) { Ok(v) => v, Err(e) => return e };
    let mi = match get_num(args, 1, ctx, cr) { Ok(v) => v, Err(e) => return e };
    let s  = match get_num(args, 2, ctx, cr) { Ok(v) => v, Err(e) => return e };
    CellVal::Number((h * 3600.0 + mi * 60.0 + s) / 86400.0)
}

fn year(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let (y, _, _) = serial_to_ymd(serial);
    CellVal::Number(y as f64)
}

fn month(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let (_, m, _) = serial_to_ymd(serial);
    CellVal::Number(m as f64)
}

fn day(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let (_, _, d) = serial_to_ymd(serial);
    CellVal::Number(d as f64)
}

fn hour(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v, Err(e) => return e };
    let frac = serial.fract();
    let total_secs = (frac * 86400.0).round() as i64;
    CellVal::Number((total_secs / 3600) as f64)
}

fn minute(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v, Err(e) => return e };
    let frac = serial.fract();
    let total_secs = (frac * 86400.0).round() as i64;
    CellVal::Number(((total_secs % 3600) / 60) as f64)
}

fn second(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v, Err(e) => return e };
    let frac = serial.fract();
    let total_secs = (frac * 86400.0).round() as i64;
    CellVal::Number((total_secs % 60) as f64)
}

fn weekday(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let return_type = if args.len() >= 2 { match get_num(args, 1, ctx, cr) { Ok(v) => v as u32, Err(_) => 1 } } else { 1 };
    let dow = day_of_week(serial); // 0=Sun, 1=Mon, ..., 6=Sat
    let result = match return_type {
        1 => dow + 1,               // 1=Sun ... 7=Sat
        2 => (dow + 6) % 7 + 1,    // 1=Mon ... 7=Sun
        3 => (dow + 6) % 7,        // 0=Mon ... 6=Sun
        _ => dow + 1,
    };
    CellVal::Number(result as f64)
}

// ── 날짜 텍스트 파싱 ──────────────────────────────────────────────────────────

fn datevalue(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let s = match Evaluator::eval(&args[0], ctx, cr) {
        CellVal::Text(s) => s,
        other => return if other.is_error() { other } else { CellVal::Error("#VALUE!".to_string()) },
    };
    if let Some((y, m, d)) = parse_date_str(&s) {
        CellVal::Number(ymd_to_serial(y, m, d))
    } else {
        CellVal::Error("#VALUE!".to_string())
    }
}

fn timevalue(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let s = match Evaluator::eval(&args[0], ctx, cr) {
        CellVal::Text(s) => s,
        other => return if other.is_error() { other } else { CellVal::Error("#VALUE!".to_string()) },
    };
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let h: f64 = parts[0].parse().unwrap_or(0.0);
    let m: f64 = parts[1].parse().unwrap_or(0.0);
    let sv: f64 = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    CellVal::Number((h * 3600.0 + m * 60.0 + sv) / 86400.0)
}

// ── 날짜 계산 ─────────────────────────────────────────────────────────────────

fn days(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let end   = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let start = match get_num(args, 1, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    CellVal::Number((end - start) as f64)
}

fn networkdays(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let start = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let end   = match get_num(args, 1, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let (s, e) = if start <= end { (start, end) } else { (end, start) };
    let mut count = 0i64;
    let mut d = s;
    while d <= e {
        let dow = day_of_week(d);
        if dow != 0 && dow != 6 { count += 1; } // 0=Sun, 6=Sat
        d += 1;
    }
    CellVal::Number(if start <= end { count } else { -count } as f64)
}

fn edate(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let months = match get_num(args, 1, ctx, cr) { Ok(v) => v as i32, Err(e) => return e };
    let (y, m, d) = serial_to_ymd(serial);
    let (ny, nm) = add_months(y, m, months);
    let max_day = days_in_month(ny, nm);
    CellVal::Number(ymd_to_serial(ny, nm, d.min(max_day)))
}

fn eomonth(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let serial = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let months = match get_num(args, 1, ctx, cr) { Ok(v) => v as i32, Err(e) => return e };
    let (y, m, _) = serial_to_ymd(serial);
    let (ny, nm) = add_months(y, m, months);
    CellVal::Number(ymd_to_serial(ny, nm, days_in_month(ny, nm)))
}

fn datedif(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let start = match get_num(args, 0, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    let end   = match get_num(args, 1, ctx, cr) { Ok(v) => v as i64, Err(e) => return e };
    if start > end { return CellVal::Error("#NUM!".to_string()); }
    let unit = match Evaluator::eval(&args[2], ctx, cr) {
        CellVal::Text(s) => s.to_uppercase(),
        other => return if other.is_error() { other } else { CellVal::Error("#VALUE!".to_string()) },
    };
    let (sy, sm, sd) = serial_to_ymd(start);
    let (ey, em, ed) = serial_to_ymd(end);
    let result = match unit.as_str() {
        "Y"  => (ey - sy) as i64 - if (em, ed) < (sm, sd) { 1 } else { 0 },
        "M"  => {
            let total_months = (ey - sy) * 12 + (em - sm);
            (total_months - if ed < sd { 1 } else { 0 }) as i64
        }
        "D"  => end - start,
        "MD" => (ed - sd).abs() as i64,
        "YM" => ((em - sm).rem_euclid(12)) as i64,
        "YD" => {
            let start_this_year = ymd_to_serial(ey, sm, sd) as i64;
            let end_serial = end;
            (end_serial - start_this_year).abs()
        }
        _ => return CellVal::Error("#VALUE!".to_string()),
    };
    CellVal::Number(result as f64)
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

fn add_months(y: i32, m: i32, months: i32) -> (i32, i32) {
    let total = (m - 1) + months;
    let ny = y + total.div_euclid(12);
    let nm = total.rem_euclid(12) + 1;
    (ny, nm)
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i32, m: i32) -> i32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap(y) { 29 } else { 28 },
        _ => 30,
    }
}

/// "2025-01-15", "2025/01/15", "01/15/2025" 등 파싱
fn parse_date_str(s: &str) -> Option<(i32, i32, i32)> {
    let sep = if s.contains('-') { '-' } else if s.contains('/') { '/' } else { return None; };
    let parts: Vec<&str> = s.split(sep).collect();
    if parts.len() < 3 { return None; }
    let (y, m, d) = if parts[0].len() == 4 {
        (parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?)
    } else {
        (parts[2].parse().ok()?, parts[0].parse().ok()?, parts[1].parse().ok()?)
    };
    Some((y, m, d))
}

// ── 단위 테스트 ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evaluator::{EvalContext, RangeVal};
    use crate::parser::Parser;

    struct Ctx;
    impl EvalContext for Ctx {
        fn get_cell(&self, _: Option<&str>, _: u32, _: u32) -> CellVal { CellVal::Null }
        fn get_range(&self, _: Option<&str>, _: u32, _: u32, _: u32, _: u32) -> RangeVal { RangeVal { rows: 0, cols: 0, data: vec![] } }
        fn get_table_range(&self, _: &str, _: Option<&str>, _: Option<&str>, _: Option<u32>) -> RangeVal { RangeVal { rows: 0, cols: 0, data: vec![] } }
        fn current_sheet(&self) -> &str { "Sheet1" }
    }

    fn ev(f: &str) -> CellVal { Evaluator::eval(&Parser::parse(f).unwrap(), &Ctx, None) }

    #[test]
    fn test_date_serial() {
        // 1900-01-01 = 1
        assert_eq!(ev("=DATE(1900,1,1)"), CellVal::Number(1.0));
        // 1970-01-01 = 25569
        assert_eq!(ev("=DATE(1970,1,1)"), CellVal::Number(25569.0));
        // 2025-01-01 = 45658
        assert_eq!(ev("=DATE(2025,1,1)"), CellVal::Number(45658.0));
    }

    #[test]
    fn test_year_month_day() {
        // DATE(2025,4,25) → 직렬 번호, 그 값으로 YEAR/MONTH/DAY 추출
        let serial = ymd_to_serial(2025, 4, 25);
        assert_eq!(serial_to_ymd(serial as i64), (2025, 4, 25));
    }

    #[test]
    fn test_weekday() {
        // 2025-01-01 = 수요일 (return_type=1: 수=4)
        let serial = ymd_to_serial(2025, 1, 1) as i64;
        assert_eq!(day_of_week(serial), 3); // 0=Sun, 3=Wed
    }

    #[test]
    fn test_days() {
        assert_eq!(ev("=DAYS(DATE(2025,1,31),DATE(2025,1,1))"), CellVal::Number(30.0));
    }

    #[test]
    fn test_edate() {
        // 2025-01-31 + 1개월 = 2025-02-28
        let start = ymd_to_serial(2025, 1, 31);
        let expr = format!("=EDATE({},1)", start as i64);
        assert_eq!(ev(&expr), CellVal::Number(ymd_to_serial(2025, 2, 28)));
    }

    #[test]
    fn test_datedif_y() {
        let s = ymd_to_serial(2020, 1, 1);
        let e = ymd_to_serial(2025, 1, 1);
        let expr = format!("=DATEDIF({},{},\"Y\")", s as i64, e as i64);
        assert_eq!(ev(&expr), CellVal::Number(5.0));
    }
}
