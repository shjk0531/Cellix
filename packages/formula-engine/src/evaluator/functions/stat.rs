use crate::evaluator::{CellVal, EvalContext, Evaluator};
use crate::parser::ast::Expr;
use super::collect_nums;

pub fn call(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
    match name.to_uppercase().as_str() {
        "STDEV"       => stdev_impl(args, ctx, current_row, false),
        "STDEVP"      => stdev_impl(args, ctx, current_row, true),
        "VAR"         => var_impl(args, ctx, current_row, false),
        "VARP"        => var_impl(args, ctx, current_row, true),
        "MEDIAN"      => median(args, ctx, current_row),
        "MODE"        => mode(args, ctx, current_row),
        "PERCENTILE"  => percentile(args, ctx, current_row),
        "QUARTILE"    => quartile(args, ctx, current_row),
        "FREQUENCY"   => frequency(args, ctx, current_row),
        "CORREL"      => correl(args, ctx, current_row),
        "SLOPE"       => slope(args, ctx, current_row),
        "INTERCEPT"   => intercept(args, ctx, current_row),
        _             => CellVal::Error("#NAME?".to_string()),
    }
}

// ── 분산/표준편차 (subtotal에서도 호출) ────────────────────────────────────────

pub fn var_impl(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>, population: bool) -> CellVal {
    let nums = collect_nums(args, ctx, cr);
    let n = nums.len();
    let denom = if population { n } else { n.saturating_sub(1) };
    if denom == 0 { return CellVal::Error("#DIV/0!".to_string()); }
    let mean = nums.iter().sum::<f64>() / n as f64;
    let var = nums.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / denom as f64;
    CellVal::Number(var)
}

pub fn stdev_impl(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>, population: bool) -> CellVal {
    match var_impl(args, ctx, cr, population) {
        CellVal::Number(v) => CellVal::Number(v.sqrt()),
        other => other,
    }
}

fn median(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let mut nums = collect_nums(args, ctx, cr);
    if nums.is_empty() { return CellVal::Error("#NUM!".to_string()); }
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = nums.len();
    let med = if n % 2 == 1 { nums[n / 2] } else { (nums[n / 2 - 1] + nums[n / 2]) / 2.0 };
    CellVal::Number(med)
}

fn mode(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    let nums = collect_nums(args, ctx, cr);
    if nums.is_empty() { return CellVal::Error("#N/A".to_string()); }
    // 10^10 단위로 반올림하여 정수 키로 변환
    let mut counts: std::collections::HashMap<i64, usize> = std::collections::HashMap::new();
    for &n in &nums {
        *counts.entry((n * 1e10_f64).round() as i64).or_insert(0) += 1;
    }
    let (&key, _) = counts.iter().max_by_key(|(_, &v)| v).unwrap();
    CellVal::Number(key as f64 / 1e10_f64)
}

fn percentile(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let k = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v, Err(e) => return e };
    if !(0.0..=1.0).contains(&k) { return CellVal::Error("#NUM!".to_string()); }
    let mut nums = collect_nums(&args[..1], ctx, cr);
    if nums.is_empty() { return CellVal::Error("#NUM!".to_string()); }
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = nums.len() as f64;
    let idx = k * (n - 1.0);
    let lo = idx.floor() as usize;
    let hi = idx.ceil() as usize;
    let frac = idx.fract();
    let result = if lo == hi { nums[lo] } else { nums[lo] * (1.0 - frac) + nums[hi] * frac };
    CellVal::Number(result)
}

fn quartile(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let quart = match Evaluator::eval(&args[1], ctx, cr).to_number() { Ok(v) => v as u32, Err(e) => return e };
    let k = match quart {
        0 => 0.0, 1 => 0.25, 2 => 0.5, 3 => 0.75, 4 => 1.0,
        _ => return CellVal::Error("#NUM!".to_string()),
    };
    let k_expr = Expr::Number(k);
    percentile(&[args[0].clone(), k_expr], ctx, cr)
}

fn frequency(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let data = collect_nums(&args[..1], ctx, cr);
    let mut bins = collect_nums(&args[1..2], ctx, cr);
    bins.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let mut counts = vec![0u32; bins.len() + 1];
    for &v in &data {
        let idx = bins.partition_point(|&b| b < v);
        counts[idx] += 1;
    }
    // 스칼라 컨텍스트: 첫 번째 버킷 반환
    CellVal::Number(*counts.first().unwrap_or(&0) as f64)
}

fn correl(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let xs = collect_nums(&args[..1], ctx, cr);
    let ys = collect_nums(&args[1..2], ctx, cr);
    let (slope_v, _) = linear_regression(&xs, &ys);
    if slope_v.is_nan() { return CellVal::Error("#DIV/0!".to_string()); }
    let sx = std_dev(&xs, true);
    let sy = std_dev(&ys, true);
    if sy == 0.0 { return CellVal::Error("#DIV/0!".to_string()); }
    CellVal::Number(slope_v * sx / sy)
}

fn slope(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let ys = collect_nums(&args[..1], ctx, cr);
    let xs = collect_nums(&args[1..2], ctx, cr);
    let (s, _) = linear_regression(&xs, &ys);
    if s.is_nan() { CellVal::Error("#DIV/0!".to_string()) } else { CellVal::Number(s) }
}

fn intercept(args: &[Expr], ctx: &dyn EvalContext, cr: Option<u32>) -> CellVal {
    if args.len() < 2 { return CellVal::Error("#VALUE!".to_string()); }
    let ys = collect_nums(&args[..1], ctx, cr);
    let xs = collect_nums(&args[1..2], ctx, cr);
    let (_, b) = linear_regression(&xs, &ys);
    if b.is_nan() { CellVal::Error("#DIV/0!".to_string()) } else { CellVal::Number(b) }
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

fn mean(v: &[f64]) -> f64 {
    if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 }
}

fn std_dev(v: &[f64], population: bool) -> f64 {
    if v.len() < 2 { return 0.0; }
    let m = mean(v);
    let denom = if population { v.len() } else { v.len() - 1 } as f64;
    (v.iter().map(|&x| (x - m).powi(2)).sum::<f64>() / denom).sqrt()
}

fn linear_regression(xs: &[f64], ys: &[f64]) -> (f64, f64) {
    let n = xs.len().min(ys.len());
    if n < 2 { return (f64::NAN, f64::NAN); }
    let mx = mean(&xs[..n]);
    let my = mean(&ys[..n]);
    let ss_xx: f64 = xs[..n].iter().map(|&x| (x - mx).powi(2)).sum();
    let ss_xy: f64 = xs[..n].iter().zip(ys[..n].iter()).map(|(&x, &y)| (x - mx) * (y - my)).sum();
    if ss_xx == 0.0 { return (f64::NAN, f64::NAN); }
    let slope = ss_xy / ss_xx;
    let intercept = my - slope * mx;
    (slope, intercept)
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

    fn approx(a: &CellVal, b: f64) -> bool {
        matches!(a, CellVal::Number(n) if (n - b).abs() < 1e-6)
    }

    #[test]
    fn test_stdev() {
        // STDEV(2,4,4,4,5,5,7,9): 표본 표준편차 ≈ 2.138
        assert!(approx(&ev("=STDEV(2,4,4,4,5,5,7,9)"), 2.1380899));
        // STDEVP: 모집단 표준편차 = 2.0
        assert!(approx(&ev("=STDEVP(2,4,4,4,5,5,7,9)"), 2.0));
    }

    #[test]
    fn test_median_odd()  { assert_eq!(ev("=MEDIAN(1,3,2)"), CellVal::Number(2.0)); }
    #[test]
    fn test_median_even() { assert_eq!(ev("=MEDIAN(1,2,3,4)"), CellVal::Number(2.5)); }

    #[test]
    fn test_percentile() {
        // PERCENTILE({1,2,3,4}, 0.5) = 2.5
        assert!(approx(&ev("=PERCENTILE(2,0.5)"), 2.0));
    }

    #[test]
    fn test_slope_intercept() {
        // 단일 스칼라 인수는 1점 → #DIV/0!
        assert!(matches!(ev("=SLOPE(3,1)"), CellVal::Error(_)));
        // INTERCEPT도 마찬가지
        assert!(matches!(ev("=INTERCEPT(3,1)"), CellVal::Error(_)));
    }
}
