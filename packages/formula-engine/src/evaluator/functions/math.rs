use crate::evaluator::{CellVal, EvalContext, Evaluator, RangeVal};
use crate::parser::ast::Expr;
use super::{collect_nums, collect_vals, matches_criteria, nums_from_range};

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "SUM"        => sum(args, ctx, current_row),
        "SUMIF"      => sumif(args, ctx, current_row),
        "SUMIFS"     => sumifs(args, ctx, current_row),
        "AVERAGE"    => average(args, ctx, current_row),
        "AVERAGEIF"  => averageif(args, ctx, current_row),
        "AVERAGEIFS" => averageifs(args, ctx, current_row),
        "COUNT"      => count(args, ctx, current_row),
        "COUNTA"     => counta(args, ctx, current_row),
        "COUNTBLANK" => countblank(args, ctx, current_row),
        "COUNTIF"    => countif(args, ctx, current_row),
        "COUNTIFS"   => countifs(args, ctx, current_row),
        "MAX"        => max_fn(args, ctx, current_row),
        "MIN"        => min_fn(args, ctx, current_row),
        "LARGE"      => large(args, ctx, current_row),
        "SMALL"      => small(args, ctx, current_row),
        "ROUND"      => round(args, ctx, current_row),
        "ROUNDUP"    => roundup(args, ctx, current_row),
        "ROUNDDOWN"  => rounddown(args, ctx, current_row),
        "INT"        => int_fn(args, ctx, current_row),
        "ABS"        => abs_fn(args, ctx, current_row),
        "MOD"        => mod_fn(args, ctx, current_row),
        "POWER"      => power_fn(args, ctx, current_row),
        "SQRT"       => sqrt_fn(args, ctx, current_row),
        "CEILING"    => ceiling(args, ctx, current_row),
        "FLOOR"      => floor_fn(args, ctx, current_row),
        "TRUNC"      => trunc_fn(args, ctx, current_row),
        "RANK"       => rank_fn(args, ctx, current_row),
        "SUBTOTAL"   => subtotal(args, ctx, current_row),
        _            => CellVal::Error("#NAME?".to_string()),
    }
}

// ── 집계 ──────────────────────────────────────────────────────────────────────

fn sum(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    CellVal::Number(collect_nums(args, ctx, cr).iter().sum())
}

fn sumif(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let range_flat = Evaluator::eval_as_range(&args[0], ctx, cr).flat();
    let criteria  = Evaluator::eval(&args[1], ctx, cr);
    let sum_flat  = if args.len() >= 3 {
        Evaluator::eval_as_range(&args[2], ctx, cr).flat()
    } else {
        range_flat.clone()
    };
    let total: f64 = range_flat.iter().enumerate()
        .filter(|(_, v)| matches_criteria(v, &criteria))
        .filter_map(|(i, _)| if let Some(CellVal::Number(n)) = sum_flat.get(i) { Some(n) } else { None })
        .sum();
    CellVal::Number(total)
}

fn sumifs(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 || args.len() % 2 == 0 {
        return CellVal::Error("#VALUE!".to_string());
    }
    let sum_flat = Evaluator::eval_as_range(&args[0], ctx, cr).flat();
    let mut mask = vec![true; sum_flat.len()];
    let mut i = 1;
    while i + 1 < args.len() {
        let range = Evaluator::eval_as_range(&args[i], ctx, cr).flat();
        let crit  = Evaluator::eval(&args[i + 1], ctx, cr);
        for (j, v) in range.iter().enumerate() {
            if j < mask.len() && !matches_criteria(v, &crit) { mask[j] = false; }
        }
        i += 2;
    }
    let total: f64 = sum_flat.iter().enumerate()
        .filter(|(j, _)| mask[*j])
        .filter_map(|(_, v)| if let CellVal::Number(n) = v { Some(n) } else { None })
        .sum();
    CellVal::Number(total)
}

fn average(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let nums = collect_nums(args, ctx, cr);
    if nums.is_empty() { return CellVal::Error("#DIV/0!".to_string()); }
    CellVal::Number(nums.iter().sum::<f64>() / nums.len() as f64)
}

fn averageif(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let range_flat = Evaluator::eval_as_range(&args[0], ctx, cr).flat();
    let criteria   = Evaluator::eval(&args[1], ctx, cr);
    let avg_flat   = if args.len() >= 3 {
        Evaluator::eval_as_range(&args[2], ctx, cr).flat()
    } else {
        range_flat.clone()
    };
    let mut sum = 0.0f64; let mut cnt = 0usize;
    for (i, v) in range_flat.iter().enumerate() {
        if matches_criteria(v, &criteria) {
            if let Some(CellVal::Number(n)) = avg_flat.get(i) { sum += n; cnt += 1; }
        }
    }
    if cnt == 0 { CellVal::Error("#DIV/0!".to_string()) } else { CellVal::Number(sum / cnt as f64) }
}

fn averageifs(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 3 || args.len() % 2 == 0 { return CellVal::Error("#VALUE!".to_string()); }
    let avg_flat = Evaluator::eval_as_range(&args[0], ctx, cr).flat();
    let mut mask = vec![true; avg_flat.len()];
    let mut i = 1;
    while i + 1 < args.len() {
        let range = Evaluator::eval_as_range(&args[i], ctx, cr).flat();
        let crit  = Evaluator::eval(&args[i + 1], ctx, cr);
        for (j, v) in range.iter().enumerate() {
            if j < mask.len() && !matches_criteria(v, &crit) { mask[j] = false; }
        }
        i += 2;
    }
    let nums: Vec<f64> = avg_flat.iter().enumerate()
        .filter(|(j, _)| mask[*j])
        .filter_map(|(_, v)| if let CellVal::Number(n) = v { Some(*n) } else { None })
        .collect();
    if nums.is_empty() { CellVal::Error("#DIV/0!".to_string()) }
    else { CellVal::Number(nums.iter().sum::<f64>() / nums.len() as f64) }
}

fn count(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    CellVal::Number(collect_vals(args, ctx, cr).iter().filter(|v| matches!(v, CellVal::Number(_))).count() as f64)
}

fn counta(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    CellVal::Number(collect_vals(args, ctx, cr).iter().filter(|v| !matches!(v, CellVal::Null)).count() as f64)
}

fn countblank(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let n = Evaluator::eval_as_range(&args[0], ctx, cr).flat().iter()
        .filter(|v| matches!(v, CellVal::Null) || matches!(v, CellVal::Text(s) if s.is_empty()))
        .count();
    CellVal::Number(n as f64)
}

fn countif(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let flat = Evaluator::eval_as_range(&args[0], ctx, cr).flat();
    let crit = Evaluator::eval(&args[1], ctx, cr);
    CellVal::Number(flat.iter().filter(|v| matches_criteria(v, &crit)).count() as f64)
}

fn countifs(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 || args.len() % 2 != 0 { return CellVal::Error("#VALUE!".to_string()); }
    let size = Evaluator::eval_as_range(&args[0], ctx, cr).flat().len();
    let mut mask = vec![true; size];
    let mut i = 0;
    while i + 1 < args.len() {
        let range = Evaluator::eval_as_range(&args[i], ctx, cr).flat();
        let crit  = Evaluator::eval(&args[i + 1], ctx, cr);
        for (j, v) in range.iter().enumerate() {
            if j < mask.len() && !matches_criteria(v, &crit) { mask[j] = false; }
        }
        i += 2;
    }
    CellVal::Number(mask.iter().filter(|&&m| m).count() as f64)
}

fn max_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let nums = collect_nums(args, ctx, cr);
    if nums.is_empty() { return CellVal::Number(0.0); }
    CellVal::Number(nums.iter().cloned().fold(f64::NEG_INFINITY, f64::max))
}

fn min_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let nums = collect_nums(args, ctx, cr);
    if nums.is_empty() { return CellVal::Number(0.0); }
    CellVal::Number(nums.iter().cloned().fold(f64::INFINITY, f64::min))
}

fn large(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let k = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(n) => n as usize, Err(e) => return e };
    let mut nums = collect_nums(&args[..1], ctx, cr);
    if k == 0 || k > nums.len() { return CellVal::Error("#NUM!".to_string()); }
    nums.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    CellVal::Number(nums[k - 1])
}

fn small(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let k = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(n) => n as usize, Err(e) => return e };
    let mut nums = collect_nums(&args[..1], ctx, cr);
    if k == 0 || k > nums.len() { return CellVal::Error("#NUM!".to_string()); }
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    CellVal::Number(nums[k - 1])
}

// ── 반올림/수학 ───────────────────────────────────────────────────────────────

fn round(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, d| { let f = 10f64.powi(d as i32); (n * f).round() / f })
}
fn roundup(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, d| { let f = 10f64.powi(d as i32); let s = n * f; if s >= 0.0 { s.ceil() / f } else { s.floor() / f } })
}
fn rounddown(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, d| { let f = 10f64.powi(d as i32); let s = n * f; if s >= 0.0 { s.floor() / f } else { s.ceil() / f } })
}
fn int_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    one_num_arg(args, ctx, cr, |n| n.floor())
}
fn abs_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    one_num_arg(args, ctx, cr, |n| n.abs())
}
fn mod_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, d| { if d == 0.0 { return f64::NAN; } n - d * (n / d).floor() })
}
fn power_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |b, e| b.powf(e))
}
fn sqrt_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    one_num_arg(args, ctx, cr, |n| { if n < 0.0 { f64::NAN } else { n.sqrt() } })
}
fn ceiling(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, sig| { if sig == 0.0 { 0.0 } else { (n / sig).ceil() * sig } })
}
fn floor_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    two_num_args(args, ctx, cr, |n, sig| { if sig == 0.0 { 0.0 } else { (n / sig).floor() * sig } })
}
fn trunc_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    let n = match Evaluator::eval(&args[0], ctx, cr).to_number() { Ok(v) => v, Err(e) => return e };
    let d = if args.len() >= 2 { match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v as i32, Err(e) => return e } } else { 0 };
    let f = 10f64.powi(d);
    let s = n * f;
    CellVal::Number(if s >= 0.0 { s.floor() / f } else { s.ceil() / f })
}

fn rank_fn(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let num  = match Evaluator::eval(&args[0], ctx, cr).to_number() { Ok(v) => v, Err(e) => return e };
    let nums = nums_from_range(&Evaluator::eval_as_range(&args[1], ctx, cr));
    if !nums.iter().any(|&n| (n - num).abs() < 1e-10) { return CellVal::Error("#N/A".to_string()); }
    let desc = if args.len() >= 3 { match Evaluator::eval(&args[2], ctx, cr).to_number() { Ok(v) => v == 0.0, Err(_) => true } } else { true };
    let rank = if desc {
        nums.iter().filter(|&&n| n > num + 1e-10).count() + 1
    } else {
        nums.iter().filter(|&&n| n < num - 1e-10).count() + 1
    };
    CellVal::Number(rank as f64)
}

fn subtotal(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let func_num = match Evaluator::eval(&args[0], ctx, cr).to_number() { Ok(v) => v as u32 % 100, Err(e) => return e };
    let data = &args[1..];
    match func_num {
        1  => average(data, ctx, cr),
        2  => count(data, ctx, cr),
        3  => counta(data, ctx, cr),
        4  => max_fn(data, ctx, cr),
        5  => min_fn(data, ctx, cr),
        6  => CellVal::Number(collect_nums(data, ctx, cr).iter().product()),
        7  => super::stat::stdev_impl(data, ctx, cr, false),
        9  => sum(data, ctx, cr),
        10 => super::stat::var_impl(data, ctx, cr, false),
        _  => CellVal::Error("#VALUE!".to_string()),
    }
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

fn one_num_arg<F: Fn(f64) -> f64>(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>, f: F) -> CellVal {
    if args.is_empty() { return CellVal::Error("#VALUE!".to_string()); }
    match Evaluator::eval(&args[0], ctx, cr).to_number() {
        Ok(n) => { let r = f(n); if r.is_nan() { CellVal::Error("#NUM!".to_string()) } else if r.is_infinite() { CellVal::Error("#DIV/0!".to_string()) } else { CellVal::Number(r) } }
        Err(e) => e,
    }
}

fn two_num_args<F: Fn(f64, f64) -> f64>(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>, f: F) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let a = match Evaluator::eval(&args[0], ctx, cr).to_number() { Ok(v) => v, Err(e) => return e };
    let b = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v, Err(e) => return e };
    let r = f(a, b);
    if r.is_nan() { CellVal::Error("#NUM!".to_string()) } else if r.is_infinite() { CellVal::Error("#DIV/0!".to_string()) } else { CellVal::Number(r) }
}

// ── 단위 테스트 ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evaluator::{EvalContext, RangeVal};
    use crate::parser::Parser;

    struct Ctx(Vec<Vec<f64>>);
    impl EvalContext for Ctx {
        fn get_cell(&self, _: Option<&str>, r: u32, c: u32) -> CellVal {
            self.0.get(r as usize).and_then(|row| row.get(c as usize)).map(|&n| CellVal::Number(n)).unwrap_or(CellVal::Null)
        }
        fn get_range(&self, _: Option<&str>, sr: u32, sc: u32, er: u32, ec: u32) -> RangeVal {
            let data: Vec<Vec<CellVal>> = (sr..=er).map(|r| (sc..=ec).map(|c| self.get_cell(None, r, c)).collect()).collect();
            RangeVal { rows: (er - sr + 1) as usize, cols: (ec - sc + 1) as usize, data }
        }
        fn get_table_range(&self, _: &str, _: Option<&str>, _: Option<&str>, _: Option<u32>) -> RangeVal { RangeVal { rows: 0, cols: 0, data: vec![] } }
        fn current_sheet(&self) -> &str { "Sheet1" }
    }

    fn ev(f: &str) -> CellVal { Evaluator::eval(&Parser::parse(f).unwrap(), &Ctx(vec![]), None) }
    fn ec(ctx: &Ctx, f: &str) -> CellVal { Evaluator::eval(&Parser::parse(f).unwrap(), ctx, None) }

    #[test]
    fn test_sum() { assert_eq!(ev("=SUM(1,2,3)"), CellVal::Number(6.0)); }

    #[test]
    fn test_sum_range() {
        let ctx = Ctx(vec![vec![10.0], vec![20.0], vec![30.0]]);
        assert_eq!(ec(&ctx, "=SUM(A1:A3)"), CellVal::Number(60.0));
    }

    #[test]
    fn test_average() { assert_eq!(ev("=AVERAGE(2,4,6)"), CellVal::Number(4.0)); }

    #[test]
    fn test_max_min() {
        assert_eq!(ev("=MAX(3,1,5,2)"), CellVal::Number(5.0));
        assert_eq!(ev("=MIN(3,1,5,2)"), CellVal::Number(1.0));
    }

    #[test]
    fn test_round() {
        assert_eq!(ev("=ROUND(3.14159,2)"), CellVal::Number(3.14));
        assert_eq!(ev("=ROUNDUP(1.1,0)"), CellVal::Number(2.0));
        assert_eq!(ev("=ROUNDDOWN(1.9,0)"), CellVal::Number(1.0));
    }

    #[test]
    fn test_int_trunc() {
        assert_eq!(ev("=INT(-1.5)"), CellVal::Number(-2.0));
        assert_eq!(ev("=TRUNC(-1.5)"), CellVal::Number(-1.0));
    }

    #[test]
    fn test_mod() {
        assert_eq!(ev("=MOD(10,3)"), CellVal::Number(1.0));
        assert_eq!(ev("=MOD(-10,3)"), CellVal::Number(2.0));
    }

    #[test]
    fn test_sqrt_abs_power() {
        assert_eq!(ev("=SQRT(9)"), CellVal::Number(3.0));
        assert_eq!(ev("=ABS(-5)"), CellVal::Number(5.0));
        assert_eq!(ev("=POWER(2,10)"), CellVal::Number(1024.0));
    }

    #[test]
    fn test_large_small() {
        let ctx = Ctx(vec![vec![3.0, 1.0, 4.0, 1.0, 5.0]]);
        assert_eq!(ec(&ctx, "=LARGE(A1:E1,2)"), CellVal::Number(4.0));
        assert_eq!(ec(&ctx, "=SMALL(A1:E1,2)"), CellVal::Number(1.0));
    }

    #[test]
    fn test_countif() {
        let ctx = Ctx(vec![vec![1.0], vec![2.0], vec![3.0], vec![2.0]]);
        assert_eq!(ec(&ctx, "=COUNTIF(A1:A4,2)"), CellVal::Number(2.0));
    }

    #[test]
    fn test_sumif() {
        let ctx = Ctx(vec![vec![1.0, 10.0], vec![2.0, 20.0], vec![3.0, 30.0], vec![2.0, 40.0]]);
        assert_eq!(ec(&ctx, "=SUMIF(A1:A4,2,B1:B4)"), CellVal::Number(60.0));
    }

    #[test]
    fn test_rank() {
        let ctx = Ctx(vec![vec![3.0], vec![1.0], vec![4.0], vec![1.0], vec![5.0]]);
        assert_eq!(ec(&ctx, "=RANK(5,A1:A5,0)"), CellVal::Number(1.0));
        assert_eq!(ec(&ctx, "=RANK(3,A1:A5,0)"), CellVal::Number(3.0));
    }
}
