#[derive(Debug, Clone, PartialEq)]
pub enum FormulaError {
    Div0,
    Na,
    Name,
    Null,
    Num,
    Ref,
    Value,
    GettingData,
}

impl std::fmt::Display for FormulaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            FormulaError::Div0 => "#DIV/0!",
            FormulaError::Na => "#N/A",
            FormulaError::Name => "#NAME?",
            FormulaError::Null => "#NULL!",
            FormulaError::Num => "#NUM!",
            FormulaError::Ref => "#REF!",
            FormulaError::Value => "#VALUE!",
            FormulaError::GettingData => "#GETTING_DATA",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Number(f64),
    Text(String),
    Bool(bool),
    Error(FormulaError),
    CellRef {
        sheet: Option<String>,
        row: u32,
        col: u32,
        abs_row: bool,
        abs_col: bool,
    },
    RangeRef {
        sheet: Option<String>,
        start_row: u32,
        start_col: u32,
        end_row: u32,
        end_col: u32,
        abs_start_row: bool,
        abs_start_col: bool,
        abs_end_row: bool,
        abs_end_col: bool,
    },
    StructuredRef {
        table: String,
        column: Option<String>,
        specifier: Option<String>,
        this_row: bool,
    },
    FunctionCall {
        name: String,
        args: Vec<Expr>,
    },
    BinaryOp {
        op: BinaryOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
    UnaryNeg(Box<Expr>),
    Percent(Box<Expr>),
    Concat {
        left: Box<Expr>,
        right: Box<Expr>,
    },
}
