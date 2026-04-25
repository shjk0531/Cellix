use crate::evaluator::{CellVal, EvalContext, Evaluator};
use crate::parser::ast::Expr;

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "IF"      => if_fn(args, ctx, current_row),
        "IFS"     => ifs(args, ctx, current_row),
        "AND"     => and(args, ctx, current_row),
        "OR"      => or(args, ctx, current_row),
        "NOT"     => not(args, ctx, current_row),
        "XOR"     => xor(args, ctx, current_row),
        "IFERROR" => iferror(args, ctx, current_row),
        "IFNA"    => ifna(args, ctx, current_row),
        "CHOOSE"  => choose(args, ctx, current_row),
        "SWITCH"  => switch(args, ctx, current_row),
        "TRUE"    => CellVal::Bool(true),
        "FALSE"   => CellVal::Bool(false),
        _         => CellVal::Error("#NAME?".to_string()),
    }
}

fn if_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let cond = Evaluator::eval(&args[0], ctx, cr);
    if cond.is_error() { return cond; }
    if cond.to_bool() {
        if args.len() >= 2 { Evaluator::eval(&args[1], ctx, cr) } else { CellVal::Bool(true) }
    } else {
        if args.len() >= 3 { Evaluator::eval(&args[2], ctx, cr) } else { CellVal::Bool(false) }
    }
}

fn ifs(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 || args.len() % 2 != 0 { return CellVal::Error("#VALUE!".to_string()); }
    let mut i = 0;
    while i + 1 < args.len() {
        let cond = Evaluator::eval(&args[i], ctx, cr);
        if cond.is_error() { return cond; }
        if cond.to_bool() { return Evaluator::eval(&args[i + 1], ctx, cr); }
        i += 2;
    }
    CellVal::Error("#N/A".to_string())
}

fn and(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    for arg in args {
        let v = Evaluator::eval(arg, ctx, cr);
        if v.is_error() { return v; }
        if !v.to_bool() { return CellVal::Bool(false); }
    }
    CellVal::Bool(true)
}

fn or(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    for arg in args {
        let v = Evaluator::eval(arg, ctx, cr);
        if v.is_error() { return v; }
        if v.to_bool() { return CellVal::Bool(true); }
    }
    CellVal::Bool(false)
}

fn not(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    if v.is_error() { return v; }
    CellVal::Bool(!v.to_bool())
}

fn xor(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let mut count = 0usize;
    for arg in args {
        let v = Evaluator::eval(arg, ctx, cr);
        if v.is_error() { return v; }
        if v.to_bool() { count += 1; }
    }
    CellVal::Bool(count % 2 == 1)
}

fn iferror(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    if v.is_error() { Evaluator::eval(&args[1], ctx, cr) } else { v }
}

fn ifna(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let v = Evaluator::eval(&args[0], ctx, cr);
    if v.is_na() { Evaluator::eval(&args[1], ctx, cr) } else { v }
}

fn choose(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let idx = match Evaluator::eval(&args[0], ctx, cr).to_number() {
        Ok(n) => n as usize,
        Err(e) => return e,
    };
    if idx == 0 || idx >= args.len() { return CellVal::Error("#VALUE!".to_string()); }
    Evaluator::eval(&args[idx], ctx, cr)
}

fn switch(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 { return CellVal::Error("#VALUE!".to_string()); }
    let expr_val = Evaluator::eval(&args[0], ctx, cr);
    let mut i = 1;
    while i + 1 < args.len() {
        let cmp = Evaluator::eval(&args[i], ctx, cr);
        if vals_equal(&expr_val, &cmp) { return Evaluator::eval(&args[i + 1], ctx, cr); }
        i += 2;
    }
    // default value (odd number of remaining args)
    if i < args.len() { Evaluator::eval(&args[i], ctx, cr) } else { CellVal::Error("#N/A".to_string()) }
}

fn vals_equal(a: &CellVal, b: &CellVal) -> bool {
    match (a, b) {
        (CellVal::Number(x), CellVal::Number(y)) => (x - y).abs() < 1e-10,
        (CellVal::Text(x), CellVal::Text(y)) => x.to_lowercase() == y.to_lowercase(),
        (CellVal::Bool(x), CellVal::Bool(y)) => x == y,
        (CellVal::Null, CellVal::Null) => true,
        _ => false,
    }
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
    fn test_if_true()  { assert_eq!(ev("=IF(TRUE,1,0)"), CellVal::Number(1.0)); }
    #[test]
    fn test_if_false() { assert_eq!(ev("=IF(FALSE,1,0)"), CellVal::Number(0.0)); }
    #[test]
    fn test_if_no_else() { assert_eq!(ev("=IF(FALSE,1)"), CellVal::Bool(false)); }

    #[test]
    fn test_and_or() {
        assert_eq!(ev("=AND(TRUE,TRUE)"), CellVal::Bool(true));
        assert_eq!(ev("=AND(TRUE,FALSE)"), CellVal::Bool(false));
        assert_eq!(ev("=OR(FALSE,TRUE)"), CellVal::Bool(true));
        assert_eq!(ev("=OR(FALSE,FALSE)"), CellVal::Bool(false));
    }

    #[test]
    fn test_not() { assert_eq!(ev("=NOT(FALSE)"), CellVal::Bool(true)); }

    #[test]
    fn test_xor() {
        assert_eq!(ev("=XOR(TRUE,FALSE)"), CellVal::Bool(true));
        assert_eq!(ev("=XOR(TRUE,TRUE)"), CellVal::Bool(false));
    }

    #[test]
    fn test_iferror() {
        assert_eq!(ev("=IFERROR(1/0,99)"), CellVal::Number(99.0));
        assert_eq!(ev("=IFERROR(5,99)"), CellVal::Number(5.0));
    }

    #[test]
    fn test_choose() {
        assert_eq!(ev("=CHOOSE(2,10,20,30)"), CellVal::Number(20.0));
    }
}
