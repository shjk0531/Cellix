pub mod functions;

use crate::parser::ast::{BinaryOp, Expr};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", content = "v")]
pub enum CellVal {
    #[serde(rename = "n")]
    Number(f64),
    #[serde(rename = "s")]
    Text(String),
    #[serde(rename = "b")]
    Bool(bool),
    #[serde(rename = "e")]
    Error(String),
    #[serde(rename = "nil")]
    Null,
}

impl CellVal {
    pub fn to_number(&self) -> Result<f64, CellVal> {
        match self {
            CellVal::Number(n) => Ok(*n),
            CellVal::Bool(b) => Ok(if *b { 1.0 } else { 0.0 }),
            CellVal::Text(s) => s
                .trim()
                .parse::<f64>()
                .map_err(|_| CellVal::Error("#VALUE!".to_string())),
            CellVal::Null => Ok(0.0),
            CellVal::Error(e) => Err(CellVal::Error(e.clone())),
        }
    }

    pub fn to_bool(&self) -> bool {
        match self {
            CellVal::Bool(b) => *b,
            CellVal::Number(n) => *n != 0.0,
            CellVal::Text(s) => !s.is_empty(),
            CellVal::Null => false,
            CellVal::Error(_) => false,
        }
    }

    pub fn to_text(&self) -> String {
        match self {
            CellVal::Text(s) => s.clone(),
            CellVal::Number(n) => {
                if n.fract() == 0.0 && n.abs() < 1e15 {
                    format!("{}", *n as i64)
                } else {
                    format!("{}", n)
                }
            }
            CellVal::Bool(b) => if *b { "TRUE".to_string() } else { "FALSE".to_string() },
            CellVal::Null => String::new(),
            CellVal::Error(e) => e.clone(),
        }
    }

    pub fn is_error(&self) -> bool {
        matches!(self, CellVal::Error(_))
    }

    pub fn is_na(&self) -> bool {
        matches!(self, CellVal::Error(e) if e == "#N/A")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeVal {
    pub rows: usize,
    pub cols: usize,
    pub data: Vec<Vec<CellVal>>,
}

impl RangeVal {
    pub fn flat(&self) -> Vec<CellVal> {
        self.data.iter().flat_map(|r| r.iter().cloned()).collect()
    }
}

pub trait EvalContext {
    fn get_cell(&self, sheet: Option<&str>, row: u32, col: u32) -> CellVal;
    fn get_range(
        &self,
        sheet: Option<&str>,
        start_row: u32,
        start_col: u32,
        end_row: u32,
        end_col: u32,
    ) -> RangeVal;
    fn get_table_range(
        &self,
        table: &str,
        column: Option<&str>,
        specifier: Option<&str>,
        this_row: Option<u32>,
    ) -> RangeVal;
    fn current_sheet(&self) -> &str;
}

pub struct Evaluator;

impl Evaluator {
    pub fn eval(expr: &Expr, ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
        match expr {
            Expr::Number(n) => CellVal::Number(*n),
            Expr::Text(s) => CellVal::Text(s.clone()),
            Expr::Bool(b) => CellVal::Bool(*b),
            Expr::Error(fe) => CellVal::Error(fe.to_string()),
            Expr::CellRef { sheet, row, col, .. } => {
                ctx.get_cell(sheet.as_deref(), *row, *col)
            }
            Expr::RangeRef { sheet, start_row, start_col, end_row, end_col, .. } => {
                ctx.get_range(sheet.as_deref(), *start_row, *start_col, *end_row, *end_col)
                    .data
                    .first()
                    .and_then(|r| r.first())
                    .cloned()
                    .unwrap_or(CellVal::Null)
            }
            Expr::StructuredRef { table, column, specifier, this_row } => {
                let row = if *this_row { current_row } else { None };
                ctx.get_table_range(table, column.as_deref(), specifier.as_deref(), row)
                    .data
                    .first()
                    .and_then(|r| r.first())
                    .cloned()
                    .unwrap_or(CellVal::Null)
            }
            Expr::BinaryOp { op, left, right } => {
                let l = Self::eval(left, ctx, current_row);
                if l.is_error() { return l; }
                let r = Self::eval(right, ctx, current_row);
                if r.is_error() { return r; }
                Self::eval_binary(op, l, r)
            }
            Expr::UnaryNeg(inner) => {
                let v = Self::eval(inner, ctx, current_row);
                match v.to_number() {
                    Ok(n) => CellVal::Number(-n),
                    Err(e) => e,
                }
            }
            Expr::Percent(inner) => {
                let v = Self::eval(inner, ctx, current_row);
                match v.to_number() {
                    Ok(n) => CellVal::Number(n / 100.0),
                    Err(e) => e,
                }
            }
            Expr::Concat { left, right } => {
                let l = Self::eval(left, ctx, current_row);
                if l.is_error() { return l; }
                let r = Self::eval(right, ctx, current_row);
                if r.is_error() { return r; }
                CellVal::Text(format!("{}{}", l.to_text(), r.to_text()))
            }
            Expr::FunctionCall { name, args } => {
                Self::eval_function(name, args, ctx, current_row)
            }
        }
    }

    fn eval_binary(op: &BinaryOp, l: CellVal, r: CellVal) -> CellVal {
        use std::cmp::Ordering;
        match op {
            BinaryOp::Add | BinaryOp::Sub | BinaryOp::Mul | BinaryOp::Div | BinaryOp::Pow => {
                let ln = match l.to_number() { Ok(n) => n, Err(e) => return e };
                let rn = match r.to_number() { Ok(n) => n, Err(e) => return e };
                let res = match op {
                    BinaryOp::Add => ln + rn,
                    BinaryOp::Sub => ln - rn,
                    BinaryOp::Mul => ln * rn,
                    BinaryOp::Div => {
                        if rn == 0.0 { return CellVal::Error("#DIV/0!".to_string()); }
                        ln / rn
                    }
                    BinaryOp::Pow => ln.powf(rn),
                    _ => unreachable!(),
                };
                if res.is_nan() {
                    CellVal::Error("#NUM!".to_string())
                } else if res.is_infinite() {
                    CellVal::Error("#DIV/0!".to_string())
                } else {
                    CellVal::Number(res)
                }
            }
            _ => {
                let ord = match (&l, &r) {
                    (CellVal::Number(a), CellVal::Number(b)) => a.partial_cmp(b),
                    (CellVal::Text(a), CellVal::Text(b)) => {
                        Some(a.to_lowercase().cmp(&b.to_lowercase()))
                    }
                    (CellVal::Bool(a), CellVal::Bool(b)) => Some(a.cmp(b)),
                    (CellVal::Null, CellVal::Null) => Some(Ordering::Equal),
                    (CellVal::Null, CellVal::Number(n)) => {
                        Some(0.0f64.partial_cmp(n).unwrap_or(Ordering::Equal))
                    }
                    (CellVal::Number(n), CellVal::Null) => {
                        Some(n.partial_cmp(&0.0).unwrap_or(Ordering::Equal))
                    }
                    _ => None,
                };
                match ord {
                    None => CellVal::Bool(matches!(op, BinaryOp::Ne)),
                    Some(ord) => CellVal::Bool(match op {
                        BinaryOp::Eq => ord == Ordering::Equal,
                        BinaryOp::Ne => ord != Ordering::Equal,
                        BinaryOp::Lt => ord == Ordering::Less,
                        BinaryOp::Le => ord != Ordering::Greater,
                        BinaryOp::Gt => ord == Ordering::Greater,
                        BinaryOp::Ge => ord != Ordering::Less,
                        _ => false,
                    }),
                }
            }
        }
    }

    fn eval_function(name: &str, args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> CellVal {
        functions::call(name, args, ctx, current_row)
            .unwrap_or_else(|| CellVal::Error("#NAME?".to_string()))
    }

    pub fn eval_args(args: &[Expr], ctx: &dyn EvalContext, current_row: Option<u32>) -> Vec<CellVal> {
        args.iter().map(|a| Self::eval(a, ctx, current_row)).collect()
    }

    pub fn eval_as_range(expr: &Expr, ctx: &dyn EvalContext, current_row: Option<u32>) -> RangeVal {
        match expr {
            Expr::RangeRef { sheet, start_row, start_col, end_row, end_col, .. } => {
                ctx.get_range(sheet.as_deref(), *start_row, *start_col, *end_row, *end_col)
            }
            Expr::StructuredRef { table, column, specifier, this_row } => {
                let row = if *this_row { current_row } else { None };
                ctx.get_table_range(table, column.as_deref(), specifier.as_deref(), row)
            }
            _ => {
                let val = Self::eval(expr, ctx, current_row);
                RangeVal { rows: 1, cols: 1, data: vec![vec![val]] }
            }
        }
    }
}
