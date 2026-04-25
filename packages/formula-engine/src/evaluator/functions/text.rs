use crate::evaluator::{CellVal, EvalContext, Evaluator};
use crate::parser::ast::Expr;
use super::wildcard_match;

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "LEFT"        => left(args, ctx, current_row),
        "RIGHT"       => right(args, ctx, current_row),
        "MID"         => mid(args, ctx, current_row),
        "LEN"         => len(args, ctx, current_row),
        "FIND"        => find(args, ctx, current_row, true),
        "SEARCH"      => find(args, ctx, current_row, false),
        "SUBSTITUTE"  => substitute(args, ctx, current_row),
        "REPLACE"     => replace(args, ctx, current_row),
        "UPPER"       => upper(args, ctx, current_row),
        "LOWER"       => lower(args, ctx, current_row),
        "PROPER"      => proper(args, ctx, current_row),
        "TRIM"        => trim(args, ctx, current_row),
        "CLEAN"       => clean(args, ctx, current_row),
        "CONCATENATE" | "CONCAT" => concat(args, ctx, current_row),
        "TEXTJOIN"    => textjoin(args, ctx, current_row),
        "TEXT"        => text_fn(args, ctx, current_row),
        "VALUE"       => value(args, ctx, current_row),
        "T"           => t_fn(args, ctx, current_row),
        "N"           => n_fn(args, ctx, current_row),
        "REPT"        => rept(args, ctx, current_row),
        "EXACT"       => exact(args, ctx, current_row),
        _             => CellVal::Error("#NAME?".to_string()),
    }
}

fn get_text(args: &[Expr], idx: usize, ctx: &dyn EvalContext, cr: Option<u32>) -> Result<String, CellVal> {
    let v = Evaluator::eval(&args[idx], ctx, cr);
    if v.is_error() { Err(v) } else { Ok(v.to_text()) }
}

fn get_num(args: &[Expr], idx: usize, ctx: &dyn EvalContext, cr: Option<u32>) -> Result<f64, CellVal> {
    match Evaluator::eval(&args[idx], ctx, cr).to_number() {
        Ok(n) => Ok(n),
        Err(e) => Err(e),
    }
}

fn left(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let text = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let n = if args.len() >= 2 { match get_num(args, 1, ctx, cr) { Ok(v) => v as usize, Err(e) => return e } } else { 1 };
    let chars: Vec<char> = text.chars().collect();
    CellVal::Text(chars[..n.min(chars.len())].iter().collect())
}

fn right(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let text = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let n = if args.len() >= 2 { match get_num(args, 1, ctx, cr) { Ok(v) => v as usize, Err(e) => return e } } else { 1 };
    let chars: Vec<char> = text.chars().collect();
    let start = chars.len().saturating_sub(n);
    CellVal::Text(chars[start..].iter().collect())
}

fn mid(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let text = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let start = match get_num(args, 1, ctx, cr) { Ok(v) => (v as usize).saturating_sub(1), Err(e) => return e };
    let num   = match get_num(args, 2, ctx, cr) { Ok(v) => v as usize, Err(e) => return e };
    let chars: Vec<char> = text.chars().collect();
    if start >= chars.len() { return CellVal::Text(String::new()); }
    CellVal::Text(chars[start..chars.len().min(start + num)].iter().collect())
}

fn len(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let text = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    CellVal::Number(text.chars().count() as f64)
}

fn find(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>, case_sensitive: bool) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let find_text   = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let within_text = match get_text(args, 1, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let start = if args.len() >= 3 { match get_num(args, 2, ctx, cr) { Ok(v) => (v as usize).saturating_sub(1), Err(e) => return e } } else { 0 };

    let (hay, needle) = if case_sensitive {
        (within_text.clone(), find_text.clone())
    } else {
        (within_text.to_lowercase(), find_text.to_lowercase())
    };
    let chars: Vec<char> = hay.chars().collect();
    let needle_chars: Vec<char> = needle.chars().collect();
    if needle_chars.is_empty() { return CellVal::Number((start + 1) as f64); }

    for i in start..=chars.len().saturating_sub(needle_chars.len()) {
        if chars[i..i + needle_chars.len()] == needle_chars[..] {
            return CellVal::Number((i + 1) as f64);
        }
    }
    CellVal::Error("#VALUE!".to_string())
}

fn substitute(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let text     = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let old_text = match get_text(args, 1, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let new_text = match get_text(args, 2, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let instance = if args.len() >= 4 { match get_num(args, 3, ctx, cr) { Ok(v) => Some(v as usize), Err(e) => return e } } else { None };

    if old_text.is_empty() { return CellVal::Text(text); }
    let mut result = String::new();
    let mut remaining = text.as_str();
    let mut occurrence = 0usize;
    while let Some(pos) = remaining.find(&old_text) {
        occurrence += 1;
        result.push_str(&remaining[..pos]);
        if instance.map_or(true, |n| n == occurrence) {
            result.push_str(&new_text);
        } else {
            result.push_str(&old_text);
        }
        remaining = &remaining[pos + old_text.len()..];
        if instance.map_or(false, |n| n == occurrence) { break; }
    }
    result.push_str(remaining);
    CellVal::Text(result)
}

fn replace(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 4 { return CellVal::Error("#VALUE!".to_string()); }
    let text      = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let start     = match get_num(args, 1, ctx, cr) { Ok(v) => (v as usize).saturating_sub(1), Err(e) => return e };
    let num_chars = match get_num(args, 2, ctx, cr) { Ok(v) => v as usize, Err(e) => return e };
    let new_text  = match get_text(args, 3, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let chars: Vec<char> = text.chars().collect();
    let end = (start + num_chars).min(chars.len());
    let mut result: String = chars[..start].iter().collect();
    result.push_str(&new_text);
    result.push_str(&chars[end..].iter().collect::<String>());
    CellVal::Text(result)
}

fn upper(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    match get_text(args, 0, ctx, cr) { Ok(s) => CellVal::Text(s.to_uppercase()), Err(e) => e }
}

fn lower(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    match get_text(args, 0, ctx, cr) { Ok(s) => CellVal::Text(s.to_lowercase()), Err(e) => e }
}

fn proper(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let s = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let mut result = String::with_capacity(s.len());
    let mut capitalize = true;
    for c in s.chars() {
        if c.is_alphabetic() {
            if capitalize { result.extend(c.to_uppercase()); } else { result.extend(c.to_lowercase()); }
            capitalize = false;
        } else {
            result.push(c);
            capitalize = !c.is_alphanumeric();
        }
    }
    CellVal::Text(result)
}

fn trim(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let s = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let result = s.split_whitespace().collect::<Vec<_>>().join(" ");
    CellVal::Text(result)
}

fn clean(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let s = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    CellVal::Text(s.chars().filter(|&c| c as u32 >= 32).collect())
}

fn concat(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let mut result = String::new();
    for arg in args {
        let v = Evaluator::eval_as_range(arg, ctx, cr);
        for cell in v.flat() {
            if cell.is_error() { return cell; }
            result.push_str(&cell.to_text());
        }
    }
    CellVal::Text(result)
}

fn textjoin(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let delim = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let ignore_empty = Evaluator::eval(&args[1], ctx, cr).to_bool();
    let mut parts: Vec<String> = Vec::new();
    for arg in &args[2..] {
        for cell in Evaluator::eval_as_range(arg, ctx, cr).flat() {
            if cell.is_error() { return cell; }
            let s = cell.to_text();
            if ignore_empty && s.is_empty() { continue; }
            parts.push(s);
        }
    }
    CellVal::Text(parts.join(&delim))
}

fn text_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let val = Evaluator::eval(&args[0], ctx, cr);
    if val.is_error() { return val; }
    let fmt = match get_text(args, 1, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let n = match val.to_number() {
        Ok(v) => v,
        Err(_) => return CellVal::Text(val.to_text()),
    };
    CellVal::Text(format_number(n, &fmt))
}

fn format_number(n: f64, fmt: &str) -> String {
    let fmt_up = fmt.to_uppercase();
    // 날짜/시간 포맷
    if fmt_up.contains("YYYY") || fmt_up.contains("MM") || fmt_up.contains("DD") {
        let serial = n as i64;
        let (y, mo, d) = super::date::serial_to_ymd(serial);
        let result = fmt.to_uppercase()
            .replace("YYYY", &format!("{:04}", y))
            .replace("MM",   &format!("{:02}", mo))
            .replace("DD",   &format!("{:02}", d));
        return result;
    }
    if fmt_up.contains("HH") || fmt_up.contains("SS") {
        let frac = n.fract();
        let total_secs = (frac * 86400.0).round() as i64;
        let h = total_secs / 3600;
        let m = (total_secs % 3600) / 60;
        let s = total_secs % 60;
        return fmt.to_uppercase()
            .replace("HH", &format!("{:02}", h))
            .replace("MM", &format!("{:02}", m))
            .replace("SS", &format!("{:02}", s));
    }
    // 숫자 포맷
    if fmt.contains('%') {
        let decimals = fmt.split('.').nth(1).map(|s| s.trim_end_matches('%').len()).unwrap_or(0);
        return format!("{:.prec$}%", n * 100.0, prec = decimals);
    }
    let use_thousands = fmt.contains(',');
    let decimals = fmt.split('.').nth(1).map(|s| s.len()).unwrap_or(0);
    let formatted = format!("{:.prec$}", n, prec = decimals);
    if use_thousands {
        insert_thousands_sep(&formatted)
    } else {
        formatted
    }
}

fn insert_thousands_sep(s: &str) -> String {
    let (int_part, dec_part) = if let Some(pos) = s.find('.') {
        (&s[..pos], Some(&s[pos..]))
    } else {
        (s, None)
    };
    let (sign, digits) = if int_part.starts_with('-') { ("-", &int_part[1..]) } else { ("", int_part) };
    let mut result = String::new();
    let chars: Vec<char> = digits.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if i > 0 && (chars.len() - i) % 3 == 0 { result.push(','); }
        result.push(c);
    }
    format!("{}{}{}", sign, result, dec_part.unwrap_or(""))
}

fn value(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    match v.to_number() { Ok(n) => CellVal::Number(n), Err(e) => e }
}

fn t_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    match v { CellVal::Text(_) => v, _ => CellVal::Text(String::new()) }
}

fn n_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    CellVal::Number(v.to_number().unwrap_or(0.0))
}

fn rept(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let text = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let n    = match get_num(args, 1, ctx, cr) { Ok(v) => v as usize, Err(e) => return e };
    CellVal::Text(text.repeat(n))
}

fn exact(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let a = match get_text(args, 0, ctx, cr) { Ok(s) => s, Err(e) => return e };
    let b = match get_text(args, 1, ctx, cr) { Ok(s) => s, Err(e) => return e };
    CellVal::Bool(a == b)
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
    fn test_left()  { assert_eq!(ev("=LEFT(\"hello\",3)"), CellVal::Text("hel".into())); }
    #[test]
    fn test_right() { assert_eq!(ev("=RIGHT(\"hello\",3)"), CellVal::Text("llo".into())); }
    #[test]
    fn test_mid()   { assert_eq!(ev("=MID(\"hello\",2,3)"), CellVal::Text("ell".into())); }
    #[test]
    fn test_len()   { assert_eq!(ev("=LEN(\"hello\")"), CellVal::Number(5.0)); }

    #[test]
    fn test_upper_lower() {
        assert_eq!(ev("=UPPER(\"hello\")"), CellVal::Text("HELLO".into()));
        assert_eq!(ev("=LOWER(\"WORLD\")"), CellVal::Text("world".into()));
    }

    #[test]
    fn test_trim() {
        assert_eq!(ev("=TRIM(\"  hello   world  \")"), CellVal::Text("hello world".into()));
    }

    #[test]
    fn test_concat() {
        assert_eq!(ev("=CONCAT(\"foo\",\"bar\")"), CellVal::Text("foobar".into()));
        assert_eq!(ev("=CONCATENATE(\"a\",\"b\",\"c\")"), CellVal::Text("abc".into()));
    }

    #[test]
    fn test_substitute() {
        assert_eq!(ev("=SUBSTITUTE(\"hello world\",\"world\",\"Rust\")"), CellVal::Text("hello Rust".into()));
    }

    #[test]
    fn test_rept() {
        assert_eq!(ev("=REPT(\"ab\",3)"), CellVal::Text("ababab".into()));
    }

    #[test]
    fn test_exact() {
        assert_eq!(ev("=EXACT(\"abc\",\"abc\")"), CellVal::Bool(true));
        assert_eq!(ev("=EXACT(\"abc\",\"ABC\")"), CellVal::Bool(false));
    }

    #[test]
    fn test_proper() {
        assert_eq!(ev("=PROPER(\"hello world\")"), CellVal::Text("Hello World".into()));
    }

    #[test]
    fn test_find() {
        assert_eq!(ev("=FIND(\"lo\",\"hello\")"), CellVal::Number(4.0));
    }
}
