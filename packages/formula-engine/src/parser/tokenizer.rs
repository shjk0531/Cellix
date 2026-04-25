#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(f64),
    Text(String),
    Bool(bool),
    CellRef {
        sheet: Option<String>,
        col_abs: bool,
        col: u32,
        row_abs: bool,
        row: u32,
    },
    RangeRef {
        sheet: Option<String>,
        start_col_abs: bool,
        start_col: u32,
        start_row_abs: bool,
        start_row: u32,
        end_col_abs: bool,
        end_col: u32,
        end_row_abs: bool,
        end_row: u32,
    },
    StructuredRef {
        table: String,
        column: Option<String>,
        specifier: Option<String>,
        this_row: bool,
    },
    Name(String),
    Plus,
    Minus,
    Star,
    Slash,
    Caret,
    Ampersand,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    LParen,
    RParen,
    LBracket,
    RBracket,
    Comma,
    Semicolon,
    Colon,
    Exclamation,
    At,
    Percent,
    EOF,
    Error(String),
}

pub struct Tokenizer {
    chars: Vec<char>,
    pos: usize,
}

impl Tokenizer {
    pub fn new(input: &str) -> Self {
        Tokenizer {
            chars: input.chars().collect(),
            pos: 0,
        }
    }

    pub fn tokenize(&mut self) -> Vec<Token> {
        let mut tokens = Vec::new();
        loop {
            self.skip_whitespace();
            let tok = self.next_token();
            let is_eof = tok == Token::EOF;
            tokens.push(tok);
            if is_eof {
                break;
            }
        }

        // Post-process: merge CellRef : CellRef → RangeRef
        self.merge_ranges(tokens)
    }

    fn merge_ranges(&self, tokens: Vec<Token>) -> Vec<Token> {
        let mut result: Vec<Token> = Vec::new();
        let mut i = 0;
        while i < tokens.len() {
            // Check pattern: CellRef Colon CellRef
            if i + 2 < tokens.len() {
                if let Token::CellRef { sheet: ref s1, col_abs: ca1, col: c1, row_abs: ra1, row: r1 } = tokens[i] {
                    if tokens[i + 1] == Token::Colon {
                        if let Token::CellRef { sheet: ref s2, col_abs: ca2, col: c2, row_abs: ra2, row: r2 } = tokens[i + 2] {
                            let sheet = s1.clone().or_else(|| s2.clone());
                            result.push(Token::RangeRef {
                                sheet,
                                start_col_abs: ca1,
                                start_col: c1,
                                start_row_abs: ra1,
                                start_row: r1,
                                end_col_abs: ca2,
                                end_col: c2,
                                end_row_abs: ra2,
                                end_row: r2,
                            });
                            i += 3;
                            continue;
                        }
                    }
                }
            }
            result.push(tokens[i].clone());
            i += 1;
        }
        result
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    #[allow(dead_code)]
    fn peek2(&self) -> Option<char> {
        self.chars.get(self.pos + 1).copied()
    }

    fn advance(&mut self) -> Option<char> {
        let ch = self.chars.get(self.pos).copied();
        if ch.is_some() {
            self.pos += 1;
        }
        ch
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek(), Some(c) if c.is_whitespace()) {
            self.advance();
        }
    }

    fn next_token(&mut self) -> Token {
        self.skip_whitespace();
        match self.peek() {
            None => Token::EOF,
            Some(ch) => match ch {
                '0'..='9' | '.' => self.read_number(),
                '"' => self.read_string(),
                '\'' => {
                    let sheet = self.read_single_quoted_sheet();
                    // expect '!'
                    if self.peek() == Some('!') {
                        self.advance();
                    }
                    self.read_cell_ref_with_sheet(Some(sheet))
                }
                '$' | 'A'..='Z' | 'a'..='z' => self.read_cell_or_name(),
                '@' => {
                    self.advance();
                    // @[ColumnName] or @ColumnName
                    if self.peek() == Some('[') {
                        self.advance();
                        let col = self.read_until(']');
                        if self.peek() == Some(']') { self.advance(); }
                        Token::StructuredRef {
                            table: String::new(),
                            column: Some(col),
                            specifier: None,
                            this_row: true,
                        }
                    } else {
                        let name = self.read_ident();
                        Token::StructuredRef {
                            table: String::new(),
                            column: Some(name),
                            specifier: None,
                            this_row: true,
                        }
                    }
                }
                '+' => { self.advance(); Token::Plus }
                '-' => { self.advance(); Token::Minus }
                '*' => { self.advance(); Token::Star }
                '/' => { self.advance(); Token::Slash }
                '^' => { self.advance(); Token::Caret }
                '&' => { self.advance(); Token::Ampersand }
                '%' => { self.advance(); Token::Percent }
                '(' => { self.advance(); Token::LParen }
                ')' => { self.advance(); Token::RParen }
                '[' => { self.advance(); Token::LBracket }
                ']' => { self.advance(); Token::RBracket }
                ',' => { self.advance(); Token::Comma }
                ';' => { self.advance(); Token::Semicolon }
                ':' => { self.advance(); Token::Colon }
                '!' => { self.advance(); Token::Exclamation }
                '=' => { self.advance(); Token::Eq }
                '<' => {
                    self.advance();
                    match self.peek() {
                        Some('>') => { self.advance(); Token::Ne }
                        Some('=') => { self.advance(); Token::Le }
                        _ => Token::Lt,
                    }
                }
                '>' => {
                    self.advance();
                    if self.peek() == Some('=') {
                        self.advance();
                        Token::Ge
                    } else {
                        Token::Gt
                    }
                }
                '#' => {
                    let err = self.read_error_literal();
                    Token::Error(err)
                }
                _ => {
                    let c = self.advance().unwrap();
                    Token::Error(format!("unexpected char: {}", c))
                }
            }
        }
    }

    fn read_number(&mut self) -> Token {
        let mut s = String::new();
        while matches!(self.peek(), Some(c) if c.is_ascii_digit() || c == '.') {
            s.push(self.advance().unwrap());
        }
        // exponent
        if matches!(self.peek(), Some('e') | Some('E')) {
            s.push(self.advance().unwrap());
            if matches!(self.peek(), Some('+') | Some('-')) {
                s.push(self.advance().unwrap());
            }
            while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
                s.push(self.advance().unwrap());
            }
        }
        match s.parse::<f64>() {
            Ok(n) => Token::Number(n),
            Err(_) => Token::Error(format!("bad number: {}", s)),
        }
    }

    fn read_string(&mut self) -> Token {
        self.advance(); // opening "
        let mut s = String::new();
        loop {
            match self.advance() {
                None => return Token::Error("unterminated string".into()),
                Some('"') => {
                    if self.peek() == Some('"') {
                        self.advance();
                        s.push('"');
                    } else {
                        break;
                    }
                }
                Some(c) => s.push(c),
            }
        }
        Token::Text(s)
    }

    fn read_single_quoted_sheet(&mut self) -> String {
        self.advance(); // opening '
        let mut s = String::new();
        loop {
            match self.advance() {
                None => break,
                Some('\'') => {
                    if self.peek() == Some('\'') {
                        self.advance();
                        s.push('\'');
                    } else {
                        break;
                    }
                }
                Some(c) => s.push(c),
            }
        }
        s
    }

    fn read_ident(&mut self) -> String {
        let mut s = String::new();
        while matches!(self.peek(), Some(c) if c.is_alphanumeric() || c == '_') {
            s.push(self.advance().unwrap());
        }
        s
    }

    fn read_until(&mut self, stop: char) -> String {
        let mut s = String::new();
        while let Some(c) = self.peek() {
            if c == stop { break; }
            s.push(self.advance().unwrap());
        }
        s
    }

    fn read_error_literal(&mut self) -> String {
        let mut s = String::new();
        while let Some(c) = self.peek() {
            if c.is_whitespace() || c == ')' || c == ',' { break; }
            s.push(self.advance().unwrap());
        }
        s
    }

    fn parse_col_name(&self, s: &str) -> Option<u32> {
        if s.is_empty() || s.len() > 3 { return None; }
        let mut col: u32 = 0;
        for c in s.chars() {
            if !c.is_ascii_alphabetic() { return None; }
            col = col * 26 + (c.to_ascii_uppercase() as u32 - b'A' as u32 + 1);
        }
        Some(col - 1)
    }

    fn parse_row_num(&self, s: &str) -> Option<u32> {
        if s.is_empty() || s.len() > 7 { return None; }
        s.parse::<u32>().ok().and_then(|n| if n >= 1 { Some(n - 1) } else { None })
    }

    fn read_cell_or_name(&mut self) -> Token {
        // Collect optional leading $
        let col_abs = if self.peek() == Some('$') {
            self.advance();
            true
        } else {
            false
        };

        // Collect alpha part (column letters)
        let mut alpha = String::new();
        while matches!(self.peek(), Some(c) if c.is_ascii_alphabetic()) {
            alpha.push(self.advance().unwrap());
        }

        // Check for TRUE/FALSE
        if !col_abs {
            let upper = alpha.to_uppercase();
            if upper == "TRUE" {
                return Token::Bool(true);
            }
            if upper == "FALSE" {
                return Token::Bool(false);
            }
        }

        // Check for structured ref: TableName[...] or TableName[@...]
        if !col_abs && self.peek() == Some('[') {
            return self.read_structured_ref(alpha);
        }

        // Sheet reference: alpha followed by '!'
        if !col_abs && self.peek() == Some('!') {
            self.advance(); // consume '!'
            return self.read_cell_ref_with_sheet(Some(alpha));
        }

        // Try to parse as cell ref: alpha = column letters, then optional $ + digits
        let col = self.parse_col_name(&alpha);

        if let Some(c) = col {
            if alpha.len() <= 3 {
                let row_abs = if self.peek() == Some('$') {
                    self.advance();
                    true
                } else {
                    false
                };
                // Collect digit part
                let mut digits = String::new();
                while matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
                    digits.push(self.advance().unwrap());
                }
                if let Some(r) = self.parse_row_num(&digits) {
                    // After cell ref, check for '!' (shouldn't happen here but handle)
                    // Check if followed by sheet separator - already handled above
                    return Token::CellRef {
                        sheet: None,
                        col_abs,
                        col: c,
                        row_abs,
                        row: r,
                    };
                }
                // Not a valid cell ref - treat as name
                // Put back the digits we read (we can't, so reconstruct)
                let mut name = alpha;
                name.push_str(&digits);
                // Continue collecting remaining ident chars
                while matches!(self.peek(), Some(c) if c.is_alphanumeric() || c == '_' || c == '.') {
                    name.push(self.advance().unwrap());
                }
                return Token::Name(name.to_uppercase());
            }
        }

        // Collect rest of identifier
        let mut name = alpha;
        while matches!(self.peek(), Some(c) if c.is_alphanumeric() || c == '_' || c == '.') {
            name.push(self.advance().unwrap());
        }

        // Check for function call: name followed by '('
        // We just return Name - parser will distinguish function vs named range
        Token::Name(name.to_uppercase())
    }

    fn read_cell_ref_with_sheet(&mut self, sheet: Option<String>) -> Token {
        let col_abs = if self.peek() == Some('$') {
            self.advance();
            true
        } else {
            false
        };
        let mut alpha = String::new();
        while matches!(self.peek(), Some(c) if c.is_ascii_alphabetic()) {
            alpha.push(self.advance().unwrap());
        }
        let col = match self.parse_col_name(&alpha) {
            Some(c) => c,
            None => return Token::Error(format!("bad cell ref after sheet: {}", alpha)),
        };
        let row_abs = if self.peek() == Some('$') {
            self.advance();
            true
        } else {
            false
        };
        let mut digits = String::new();
        while matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
            digits.push(self.advance().unwrap());
        }
        let row = match self.parse_row_num(&digits) {
            Some(r) => r,
            None => return Token::Error(format!("bad row num: {}", digits)),
        };
        Token::CellRef { sheet, col_abs, col, row_abs, row }
    }

    fn read_structured_ref(&mut self, table: String) -> Token {
        self.advance(); // consume '['
        let content = self.read_until(']');
        if self.peek() == Some(']') { self.advance(); }

        // Check specifier keywords
        let specifiers = ["#All", "#Headers", "#Data", "#Totals", "#ThisRow"];
        for spec in &specifiers {
            if content.eq_ignore_ascii_case(spec) {
                return Token::StructuredRef {
                    table,
                    column: None,
                    specifier: Some(spec.to_string()),
                    this_row: false,
                };
            }
        }
        // @ColumnName inside brackets → this_row
        if content.starts_with('@') {
            let col = content[1..].to_string();
            return Token::StructuredRef {
                table,
                column: Some(col),
                specifier: None,
                this_row: true,
            };
        }
        Token::StructuredRef {
            table,
            column: Some(content),
            specifier: None,
            this_row: false,
        }
    }
}
