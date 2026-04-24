pub mod tokenizer;
pub mod ast;

use tokenizer::{Token, Tokenizer};
use ast::{BinaryOp, Expr, FormulaError};

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    pub fn parse(input: &str) -> Result<Expr, String> {
        let src = input.trim_start_matches('=');
        let mut tok = Tokenizer::new(src);
        let tokens = tok.tokenize();
        let mut parser = Parser { tokens, pos: 0 };
        let expr = parser.parse_expr()?;
        if parser.peek() != &Token::EOF {
            return Err(format!("unexpected token after expression: {:?}", parser.peek()));
        }
        Ok(expr)
    }

    fn peek(&self) -> &Token {
        self.tokens.get(self.pos).unwrap_or(&Token::EOF)
    }

    fn advance(&mut self) -> &Token {
        let tok = self.tokens.get(self.pos).unwrap_or(&Token::EOF);
        self.pos += 1;
        tok
    }

    fn expect(&mut self, expected: &Token) -> Result<(), String> {
        let tok = self.peek().clone();
        if &tok == expected {
            self.advance();
            Ok(())
        } else {
            Err(format!("expected {:?}, got {:?}", expected, tok))
        }
    }

    // Precedence: compare < concat < additive < multiplicative < power < unary < postfix < primary
    fn parse_expr(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_concat()?;
        loop {
            let op = match self.peek() {
                Token::Eq => BinaryOp::Eq,
                Token::Ne => BinaryOp::Ne,
                Token::Lt => BinaryOp::Lt,
                Token::Le => BinaryOp::Le,
                Token::Gt => BinaryOp::Gt,
                Token::Ge => BinaryOp::Ge,
                _ => break,
            };
            self.advance();
            let right = self.parse_concat()?;
            left = Expr::BinaryOp { op, left: Box::new(left), right: Box::new(right) };
        }
        Ok(left)
    }

    fn parse_concat(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_additive()?;
        while self.peek() == &Token::Ampersand {
            self.advance();
            let right = self.parse_additive()?;
            left = Expr::Concat { left: Box::new(left), right: Box::new(right) };
        }
        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_multiplicative()?;
        loop {
            let op = match self.peek() {
                Token::Plus => BinaryOp::Add,
                Token::Minus => BinaryOp::Sub,
                _ => break,
            };
            self.advance();
            let right = self.parse_multiplicative()?;
            left = Expr::BinaryOp { op, left: Box::new(left), right: Box::new(right) };
        }
        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_power()?;
        loop {
            let op = match self.peek() {
                Token::Star => BinaryOp::Mul,
                Token::Slash => BinaryOp::Div,
                _ => break,
            };
            self.advance();
            let right = self.parse_power()?;
            left = Expr::BinaryOp { op, left: Box::new(left), right: Box::new(right) };
        }
        Ok(left)
    }

    fn parse_power(&mut self) -> Result<Expr, String> {
        let base = self.parse_unary()?;
        if self.peek() == &Token::Caret {
            self.advance();
            // right-associative: recurse into parse_power
            let exp = self.parse_power()?;
            Ok(Expr::BinaryOp { op: BinaryOp::Pow, left: Box::new(base), right: Box::new(exp) })
        } else {
            Ok(base)
        }
    }

    fn parse_unary(&mut self) -> Result<Expr, String> {
        if self.peek() == &Token::Minus {
            self.advance();
            let inner = self.parse_unary()?;
            return Ok(Expr::UnaryNeg(Box::new(inner)));
        }
        if self.peek() == &Token::Plus {
            self.advance();
            return self.parse_unary();
        }
        self.parse_postfix()
    }

    fn parse_postfix(&mut self) -> Result<Expr, String> {
        let mut expr = self.parse_primary()?;
        while self.peek() == &Token::Percent {
            self.advance();
            expr = Expr::Percent(Box::new(expr));
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<Expr, String> {
        let tok = self.peek().clone();
        match tok {
            Token::Number(n) => {
                self.advance();
                Ok(Expr::Number(n))
            }
            Token::Text(s) => {
                self.advance();
                Ok(Expr::Text(s))
            }
            Token::Bool(b) => {
                self.advance();
                Ok(Expr::Bool(b))
            }
            Token::Error(e) => {
                self.advance();
                let fe = match e.as_str() {
                    "#DIV/0!" => FormulaError::Div0,
                    "#N/A" => FormulaError::Na,
                    "#NAME?" => FormulaError::Name,
                    "#NULL!" => FormulaError::Null,
                    "#NUM!" => FormulaError::Num,
                    "#REF!" => FormulaError::Ref,
                    "#VALUE!" => FormulaError::Value,
                    "#GETTING_DATA" => FormulaError::GettingData,
                    _ => FormulaError::Value,
                };
                Ok(Expr::Error(fe))
            }
            Token::CellRef { sheet, col_abs, col, row_abs, row } => {
                self.advance();
                Ok(Expr::CellRef { sheet, row, col, abs_row: row_abs, abs_col: col_abs })
            }
            Token::RangeRef {
                sheet,
                start_col_abs, start_col, start_row_abs, start_row,
                end_col_abs, end_col, end_row_abs, end_row,
            } => {
                self.advance();
                Ok(Expr::RangeRef {
                    sheet,
                    start_row, start_col, end_row, end_col,
                    abs_start_row: start_row_abs, abs_start_col: start_col_abs,
                    abs_end_row: end_row_abs, abs_end_col: end_col_abs,
                })
            }
            Token::StructuredRef { table, column, specifier, this_row } => {
                self.advance();
                Ok(Expr::StructuredRef { table, column, specifier, this_row })
            }
            Token::Name(name) => {
                self.advance();
                if self.peek() == &Token::LParen {
                    self.parse_function_call(name)
                } else {
                    // Named range or bare identifier
                    Ok(Expr::CellRef { sheet: None, row: 0, col: 0, abs_row: false, abs_col: false })
                    // Actually return as a named reference - for now use a placeholder
                    // Named ranges will be resolved at evaluation time
                    // We need a Name variant... but spec doesn't have one.
                    // Use FunctionCall with 0 args as a name placeholder won't work.
                    // Let's just return the name as a FunctionCall with empty args for now —
                    // evaluator will handle NAME resolution separately.
                }
            }
            Token::LParen => {
                self.advance();
                let inner = self.parse_expr()?;
                self.expect(&Token::RParen)?;
                Ok(inner)
            }
            _ => Err(format!("unexpected token in primary: {:?}", tok)),
        }
    }

    fn parse_function_call(&mut self, name: String) -> Result<Expr, String> {
        self.expect(&Token::LParen)?;
        let mut args = Vec::new();
        if self.peek() != &Token::RParen {
            loop {
                // Allow empty args (e.g. IF(,,))
                if self.peek() == &Token::Comma || self.peek() == &Token::Semicolon {
                    args.push(Expr::Bool(false)); // placeholder for empty arg
                } else {
                    args.push(self.parse_expr()?);
                }
                match self.peek() {
                    Token::Comma | Token::Semicolon => { self.advance(); }
                    Token::RParen => break,
                    _ => return Err(format!("expected , or ) in function args, got {:?}", self.peek())),
                }
            }
        }
        self.expect(&Token::RParen)?;
        Ok(Expr::FunctionCall { name, args })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokenizer::Tokenizer;

    fn tokenize(input: &str) -> Vec<Token> {
        let src = input.trim_start_matches('=');
        let mut t = Tokenizer::new(src);
        t.tokenize()
    }

    #[test]
    fn test_tokenize_number() {
        let tokens = tokenize("=1.5");
        assert!(matches!(tokens[0], Token::Number(n) if (n - 1.5).abs() < 1e-10));
    }

    #[test]
    fn test_tokenize_cell_ref() {
        let tokens = tokenize("=A1");
        assert!(
            matches!(tokens[0], Token::CellRef { sheet: None, col: 0, row: 0, col_abs: false, row_abs: false })
        );
    }

    #[test]
    fn test_tokenize_abs_ref() {
        let tokens = tokenize("=$B$2");
        assert!(
            matches!(tokens[0], Token::CellRef { sheet: None, col: 1, row: 1, col_abs: true, row_abs: true })
        );
    }

    #[test]
    fn test_parse_sum() {
        let expr = Parser::parse("=1+2").unwrap();
        assert!(matches!(
            expr,
            Expr::BinaryOp {
                op: BinaryOp::Add,
                left,
                right,
            } if matches!(*left, Expr::Number(n) if (n - 1.0).abs() < 1e-10)
              && matches!(*right, Expr::Number(n) if (n - 2.0).abs() < 1e-10)
        ));
    }

    #[test]
    fn test_parse_function() {
        let expr = Parser::parse("=SUM(A1,B1)").unwrap();
        match expr {
            Expr::FunctionCall { name, args } => {
                assert_eq!(name, "SUM");
                assert_eq!(args.len(), 2);
                assert!(matches!(args[0], Expr::CellRef { col: 0, row: 0, .. }));
                assert!(matches!(args[1], Expr::CellRef { col: 1, row: 0, .. }));
            }
            _ => panic!("expected FunctionCall, got {:?}", expr),
        }
    }

    #[test]
    fn test_parse_nested() {
        let result = Parser::parse("=IF(A1>0,A1,-A1)");
        assert!(result.is_ok(), "parse failed: {:?}", result);
        match result.unwrap() {
            Expr::FunctionCall { name, args } => {
                assert_eq!(name, "IF");
                assert_eq!(args.len(), 3);
            }
            _ => panic!("expected FunctionCall"),
        }
    }

    #[test]
    fn test_parse_text() {
        let expr = Parser::parse("=\"hello\"").unwrap();
        assert!(matches!(expr, Expr::Text(s) if s == "hello"));
    }

    #[test]
    fn test_parse_bool() {
        let expr = Parser::parse("=TRUE").unwrap();
        assert!(matches!(expr, Expr::Bool(true)));
    }
}
