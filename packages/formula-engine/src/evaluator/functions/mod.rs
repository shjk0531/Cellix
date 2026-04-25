pub mod date;
pub mod logical;
pub mod lookup;
pub mod math;
pub mod stat;
pub mod text;

use crate::evaluator::{CellVal, EvalContext, Evaluator, RangeVal};
use crate::parser::ast::Expr;

pub fn call(
    name: &str,
    args: &[Expr],
    ctx: &dyn EvalContext,
    current_row: Option<u32>,
) -> Option<CellVal> {
    match name.to_uppercase().as_str() {
        "SUM" | "SUMIF" | "SUMIFS" | "AVERAGE" | "AVERAGEIF" | "AVERAGEIFS"
        | "COUNT" | "COUNTA" | "COUNTBLANK" | "COUNTIF" | "COUNTIFS"
        | "MAX" | "MIN" | "LARGE" | "SMALL"
        | "ROUND" | "ROUNDUP" | "ROUNDDOWN" | "INT" | "ABS" | "MOD" | "POWER" | "SQRT"
        | "CEILING" | "FLOOR" | "TRUNC" | "RANK" | "SUBTOTAL" => {
            Some(math::call(name, args, ctx, current_row))
        }
        "LEFT" | "RIGHT" | "MID" | "LEN" | "FIND" | "SEARCH"
        | "SUBSTITUTE" | "REPLACE" | "UPPER" | "LOWER" | "PROPER" | "TRIM" | "CLEAN"
        | "CONCATENATE" | "CONCAT" | "TEXTJOIN" | "TEXT" | "VALUE" | "T" | "N"
        | "REPT" | "EXACT" => Some(text::call(name, args, ctx, current_row)),
        "IF" | "IFS" | "AND" | "OR" | "NOT" | "XOR"
        | "IFERROR" | "IFNA" | "CHOOSE" | "SWITCH" | "TRUE" | "FALSE" => {
            Some(logical::call(name, args, ctx, current_row))
        }
        "VLOOKUP" | "HLOOKUP" | "INDEX" | "MATCH" | "OFFSET" | "INDIRECT"
        | "ADDRESS" | "ROW" | "COL" | "ROWS" | "COLUMNS" | "TRANSPOSE" => {
            Some(lookup::call(name, args, ctx, current_row))
        }
        "STDEV" | "STDEVP" | "VAR" | "VARP" | "MEDIAN" | "MODE"
        | "PERCENTILE" | "QUARTILE" | "FREQUENCY" | "CORREL" | "SLOPE" | "INTERCEPT" => {
            Some(stat::call(name, args, ctx, current_row))
        }
        "TODAY" | "NOW" | "DATE" | "TIME" | "YEAR" | "MONTH" | "DAY"
        | "HOUR" | "MINUTE" | "SECOND" | "WEEKDAY"
        | "DATEVALUE" | "TIMEVALUE" | "DAYS" | "NETWORKDAYS"
        | "EDATE" | "EOMONTH" | "DATEDIF" => Some(date::call(name, args, ctx, current_row)),
        _ => None,
    }
}

// ── 공유 헬퍼 ──────────────────────────────────────────────────────────────────

/// RangeVal에서 숫자만 수집 (비숫자 셀 무시)
pub fn nums_from_range(range: &RangeVal) -> Vec<f64> {
    range
        .data
        .iter()
        .flat_map(|row| row.iter())
        .filter_map(|v| if let CellVal::Number(n) = v { Some(*n) } else { None })
        .collect()
}

/// 여러 Expr 인수를 펼쳐 모든 CellVal 수집
pub fn collect_vals(args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> Vec<CellVal> {
    args.iter()
        .flat_map(|a| Evaluator::eval_as_range(a, ctx, current_row).flat())
        .collect()
}

/// 여러 Expr 인수에서 숫자만 수집
pub fn collect_nums(args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> Vec<f64> {
    collect_vals(args, ctx, current_row)
        .into_iter()
        .filter_map(|v| if let CellVal::Number(n) = v { Some(n) } else { None })
        .collect()
}

/// Excel 조건 매칭: ">=100", "<>A", "*wild*", "exact" 등 지원
pub fn matches_criteria(val: &CellVal, criteria: &CellVal) -> bool {
    match criteria {
        CellVal::Number(n) => match val {
            CellVal::Number(v) => (v - n).abs() < 1e-10,
            CellVal::Null => *n == 0.0,
            _ => false,
        },
        CellVal::Bool(b) => matches!(val, CellVal::Bool(v) if v == b),
        CellVal::Null => matches!(val, CellVal::Null),
        CellVal::Error(_) => false,
        CellVal::Text(s) => {
            let s = s.trim();
            if let Some(rest) = s.strip_prefix(">=") {
                return if let Ok(n) = rest.parse::<f64>() {
                    val.to_number().map_or(false, |v| v >= n)
                } else {
                    val.to_text().to_lowercase() >= rest.to_lowercase()
                };
            }
            if let Some(rest) = s.strip_prefix("<=") {
                return if let Ok(n) = rest.parse::<f64>() {
                    val.to_number().map_or(false, |v| v <= n)
                } else {
                    val.to_text().to_lowercase() <= rest.to_lowercase()
                };
            }
            if let Some(rest) = s.strip_prefix("<>") {
                let inv = if let Ok(n) = rest.parse::<f64>() {
                    CellVal::Number(n)
                } else {
                    CellVal::Text(rest.to_string())
                };
                return !matches_criteria(val, &inv);
            }
            if let Some(rest) = s.strip_prefix('>') {
                return if let Ok(n) = rest.parse::<f64>() {
                    val.to_number().map_or(false, |v| v > n)
                } else {
                    val.to_text().to_lowercase() > rest.to_lowercase()
                };
            }
            if let Some(rest) = s.strip_prefix('<') {
                return if let Ok(n) = rest.parse::<f64>() {
                    val.to_number().map_or(false, |v| v < n)
                } else {
                    val.to_text().to_lowercase() < rest.to_lowercase()
                };
            }
            if let Some(rest) = s.strip_prefix('=') {
                let c = if let Ok(n) = rest.parse::<f64>() {
                    CellVal::Number(n)
                } else {
                    CellVal::Text(rest.to_string())
                };
                return matches_criteria(val, &c);
            }
            // 텍스트 / 와일드카드 매칭
            match val {
                CellVal::Text(v) => wildcard_match(s, v),
                CellVal::Number(n) => {
                    let ns = if n.fract() == 0.0 { format!("{}", *n as i64) } else { format!("{}", n) };
                    s.eq_ignore_ascii_case(&ns)
                }
                CellVal::Null => s.is_empty(),
                _ => false,
            }
        }
    }
}

/// 대소문자 무시 와일드카드 매칭 (* = 임의 문자열, ? = 임의 한 문자)
pub fn wildcard_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.to_lowercase().chars().collect();
    let t: Vec<char> = text.to_lowercase().chars().collect();
    let (m, n) = (p.len(), t.len());
    let mut dp = vec![vec![false; n + 1]; m + 1];
    dp[0][0] = true;
    for i in 1..=m {
        dp[i][0] = p[i - 1] == '*' && dp[i - 1][0];
    }
    for i in 1..=m {
        for j in 1..=n {
            dp[i][j] = if p[i - 1] == '*' {
                dp[i - 1][j] || dp[i][j - 1]
            } else if p[i - 1] == '?' || p[i - 1] == t[j - 1] {
                dp[i - 1][j - 1]
            } else {
                false
            };
        }
    }
    dp[m][n]
}
