// Token types
export const TokenType = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  COLON: 'COLON',
  COMMA: 'COMMA',
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  NEWLINE: 'NEWLINE',
  ARROW: 'ARROW', // ->
  PIPE: 'PIPE', // |
  EOF: 'EOF',
} as const;

export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}

const KEYWORDS = [
  'diagram', 'title', 'service', 'database', 'queue', 'group',
  'contains', 'type', 'tech', 'port', 'replicas', 'data', 'topic', 'connects',
  'cloud', 'provider', 'kind', 'region',
  // Flow-mode keywords
  'start', 'end', 'node', 'label', 'system', 'duration', 'assignee',
  // C4 hierarchy
  'level', 'parent',
  // UML class
  'class', 'attributes', 'methods', 'stereotype',
  // Swimlanes
  'lane', 'color',
];

export class Lexer {
  private text: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(text: string) {
    this.text = text;
  }

  private peek(): string | null {
    if (this.pos >= this.text.length) return null;
    return this.text[this.pos];
  }

  private peekNext(): string | null {
    if (this.pos + 1 >= this.text.length) return null;
    return this.text[this.pos + 1];
  }

  private advance(): string | null {
    const char = this.peek();
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (this.peek() && /[ \t]/.test(this.peek()!)) {
      this.advance();
    }
  }

  private readIdentifier(): string {
    let value = '';
    while (this.peek() && /[a-zA-Z0-9_-]/.test(this.peek()!)) {
      value += this.advance();
    }
    return value;
  }

  private readString(): string {
    const quote = this.advance(); // consume opening quote
    let value = '';
    while (this.peek() && this.peek() !== quote) {
      value += this.advance();
    }
    this.advance(); // consume closing quote
    return value;
  }

  private readNumber(): number {
    let value = '';
    while (this.peek() && /[0-9]/.test(this.peek()!)) {
      value += this.advance();
    }
    return parseInt(value, 10);
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.text.length) {
      this.skipWhitespace();
      
      const char = this.peek();
      
      if (!char) break;

      if (char === '\n') {
        this.advance();
        tokens.push({
          type: TokenType.NEWLINE,
          value: '\n',
          line: this.line - 1,
          column: this.column,
        });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        const value = this.readIdentifier();
        const isKeyword = KEYWORDS.includes(value.toLowerCase());
        tokens.push({
          type: isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER,
          value: value, // Preserve original casing
          line: this.line,
          column: this.column - value.length,
        });
        continue;
      }

      if (char === '"' || char === "'") {
        const value = this.readString();
        tokens.push({
          type: TokenType.STRING,
          value,
          line: this.line,
          column: this.column - value.length - 2,
        });
        continue;
      }

      if (/[0-9]/.test(char)) {
        const value = this.readNumber();
        tokens.push({
          type: TokenType.NUMBER,
          value,
          line: this.line,
          column: this.column - value.toString().length,
        });
        continue;
      }

      if (char === ':') {
        this.advance();
        tokens.push({
          type: TokenType.COLON,
          value: ':',
          line: this.line,
          column: this.column - 1,
        });
        continue;
      }

      if (char === ',') {
        this.advance();
        tokens.push({
          type: TokenType.COMMA,
          value: ',',
          line: this.line,
          column: this.column - 1,
        });
        continue;
      }

      if (char === '{') {
        this.advance();
        tokens.push({
          type: TokenType.LBRACE,
          value: '{',
          line: this.line,
          column: this.column - 1,
        });
        continue;
      }

      if (char === '}') {
        this.advance();
        tokens.push({
          type: TokenType.RBRACE,
          value: '}',
          line: this.line,
          column: this.column - 1,
        });
        continue;
      }

      if (char === '-' && this.peekNext() === '>') {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.ARROW,
          value: '->',
          line: this.line,
          column: this.column - 2,
        });
        continue;
      }

      if (char === '|') {
        this.advance();
        tokens.push({
          type: TokenType.PIPE,
          value: '|',
          line: this.line,
          column: this.column - 1,
        });
        continue;
      }

      // Skip unknown characters
      this.advance();
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
    });

    return tokens;
  }
}
