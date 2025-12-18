// Dataview Query Parser
// Parses Obsidian Dataview-compatible syntax

import type {
  DataviewQuery,
  QueryType,
  FieldReference,
  FromSource,
  Condition,
  ComparisonCondition,
  LogicalCondition,
  SortClause,
  SortDirection,
  ComparisonOperator,
  ValueExpression,
} from "./types";

class ParseError extends Error {
  constructor(message: string, public position: number) {
    super(message);
    this.name = "ParseError";
  }
}

interface Token {
  type: "keyword" | "identifier" | "string" | "number" | "operator" | "punctuation" | "eof";
  value: string;
  position: number;
}

class Lexer {
  private pos = 0;
  private input: string;

  private keywords = new Set([
    "TABLE", "LIST", "TASK", "FROM", "WHERE", "SORT", "GROUP", "BY",
    "LIMIT", "ASC", "DESC", "AND", "OR", "NOT", "CONTAINS", "STARTSWITH", "ENDSWITH",
    "FLATTEN", "true", "false", "null"
  ]);

  private operators = ["!=", ">=", "<=", "=", ">", "<"];

  constructor(input: string) {
    this.input = input.trim();
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private readString(quote: string): string {
    const start = this.pos;
    this.pos++; // Skip opening quote
    let value = "";
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === "\\") {
        this.pos++;
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
        }
      } else {
        value += this.input[this.pos];
      }
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      throw new ParseError("Unterminated string", start);
    }
    this.pos++; // Skip closing quote
    return value;
  }

  private readNumber(): string {
    let value = "";
    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    return value;
  }

  private readIdentifier(): string {
    let value = "";
    while (this.pos < this.input.length && /[\w.]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    return value;
  }

  nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return { type: "eof", value: "", position: this.pos };
    }

    const startPos = this.pos;
    const char = this.input[this.pos];

    // String literals
    if (char === '"' || char === "'") {
      return { type: "string", value: this.readString(char), position: startPos };
    }

    // Numbers
    if (/\d/.test(char)) {
      return { type: "number", value: this.readNumber(), position: startPos };
    }

    // Operators
    for (const op of this.operators) {
      if (this.input.slice(this.pos, this.pos + op.length) === op) {
        this.pos += op.length;
        return { type: "operator", value: op, position: startPos };
      }
    }

    // Punctuation
    if (",()[]#".includes(char)) {
      this.pos++;
      return { type: "punctuation", value: char, position: startPos };
    }

    // Identifiers and keywords
    if (/[\w]/.test(char)) {
      const value = this.readIdentifier();
      const upper = value.toUpperCase();
      if (this.keywords.has(upper) || this.keywords.has(value)) {
        return { type: "keyword", value: upper === "TRUE" || upper === "FALSE" || upper === "NULL" ? value.toLowerCase() : upper, position: startPos };
      }
      return { type: "identifier", value, position: startPos };
    }

    throw new ParseError(`Unexpected character: ${char}`, startPos);
  }

  peek(): Token {
    const savedPos = this.pos;
    const token = this.nextToken();
    this.pos = savedPos;
    return token;
  }
}

export class DataviewParser {
  private lexer: Lexer;
  private currentToken: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.currentToken = this.lexer.nextToken();
  }

  private advance(): void {
    this.currentToken = this.lexer.nextToken();
  }

  private expect(type: Token["type"], value?: string): Token {
    if (this.currentToken.type !== type) {
      throw new ParseError(
        `Expected ${type}${value ? ` '${value}'` : ""}, got ${this.currentToken.type} '${this.currentToken.value}'`,
        this.currentToken.position
      );
    }
    if (value && this.currentToken.value !== value) {
      throw new ParseError(
        `Expected '${value}', got '${this.currentToken.value}'`,
        this.currentToken.position
      );
    }
    const token = this.currentToken;
    this.advance();
    return token;
  }

  private match(type: Token["type"], value?: string): boolean {
    if (this.currentToken.type !== type) return false;
    if (value && this.currentToken.value !== value) return false;
    return true;
  }

  parse(): DataviewQuery {
    const queryType = this.parseQueryType();
    const fields = queryType === "TABLE" ? this.parseFields() : [];

    const query: DataviewQuery = {
      queryType,
      fields,
    };

    // Parse optional clauses
    while (this.currentToken.type !== "eof") {
      if (this.match("keyword", "FROM")) {
        this.advance();
        query.from = this.parseFromSources();
      } else if (this.match("keyword", "WHERE")) {
        this.advance();
        query.where = this.parseCondition();
      } else if (this.match("keyword", "SORT")) {
        this.advance();
        query.sort = this.parseSortClauses();
      } else if (this.match("keyword", "GROUP")) {
        this.advance();
        this.expect("keyword", "BY");
        query.groupBy = { field: this.parseFieldReference() };
      } else if (this.match("keyword", "LIMIT")) {
        this.advance();
        const num = this.expect("number");
        query.limit = parseInt(num.value, 10);
      } else if (this.match("keyword", "FLATTEN")) {
        this.advance();
        query.flatten = this.parseFieldReference();
      } else {
        break;
      }
    }

    return query;
  }

  private parseQueryType(): QueryType {
    const token = this.currentToken;
    if (token.type === "keyword" && ["TABLE", "LIST", "TASK"].includes(token.value)) {
      this.advance();
      return token.value as QueryType;
    }
    throw new ParseError(
      `Expected TABLE, LIST, or TASK, got '${token.value}'`,
      token.position
    );
  }

  private parseFields(): FieldReference[] {
    const fields: FieldReference[] = [];

    // First field is required for TABLE
    fields.push(this.parseFieldReference());

    // Parse additional comma-separated fields
    while (this.match("punctuation", ",")) {
      this.advance();
      fields.push(this.parseFieldReference());
    }

    return fields;
  }

  private parseFieldReference(): FieldReference {
    const token = this.currentToken;
    if (token.type !== "identifier") {
      throw new ParseError(`Expected field name, got '${token.value}'`, token.position);
    }
    this.advance();
    return {
      type: "field",
      path: token.value.split("."),
    };
  }

  private parseFromSources(): FromSource[] {
    const sources: FromSource[] = [];
    sources.push(this.parseFromSource());

    while (this.match("punctuation", ",") || this.match("keyword", "AND")) {
      this.advance();
      sources.push(this.parseFromSource());
    }

    return sources;
  }

  private parseFromSource(): FromSource {
    // Tag: #tagname
    if (this.match("punctuation", "#")) {
      this.advance();
      const tag = this.expect("identifier");
      return { type: "tag", value: tag.value };
    }

    // Link: [[note]]
    if (this.match("punctuation", "[")) {
      this.advance();
      this.expect("punctuation", "[");
      const note = this.expect("identifier");
      this.expect("punctuation", "]");
      this.expect("punctuation", "]");
      return { type: "link", value: note.value };
    }

    // Folder: "path/to/folder" or path/to/folder
    if (this.match("string")) {
      const folder = this.currentToken.value;
      this.advance();
      return { type: "folder", value: folder };
    }

    if (this.match("identifier")) {
      const folder = this.currentToken.value;
      this.advance();
      return { type: "folder", value: folder };
    }

    throw new ParseError(
      `Expected FROM source, got '${this.currentToken.value}'`,
      this.currentToken.position
    );
  }

  private parseCondition(): Condition {
    return this.parseOrCondition();
  }

  private parseOrCondition(): Condition {
    let left = this.parseAndCondition();

    while (this.match("keyword", "OR")) {
      this.advance();
      const right = this.parseAndCondition();
      left = {
        type: "logical",
        operator: "OR",
        conditions: [left, right],
      } as LogicalCondition;
    }

    return left;
  }

  private parseAndCondition(): Condition {
    let left = this.parsePrimaryCondition();

    while (this.match("keyword", "AND")) {
      this.advance();
      const right = this.parsePrimaryCondition();
      left = {
        type: "logical",
        operator: "AND",
        conditions: [left, right],
      } as LogicalCondition;
    }

    return left;
  }

  private parsePrimaryCondition(): Condition {
    // NOT condition
    if (this.match("keyword", "NOT")) {
      this.advance();
      return {
        type: "negation",
        condition: this.parsePrimaryCondition(),
      };
    }

    // Parenthesized condition
    if (this.match("punctuation", "(")) {
      this.advance();
      const condition = this.parseCondition();
      this.expect("punctuation", ")");
      return condition;
    }

    // Comparison
    return this.parseComparison();
  }

  private parseComparison(): ComparisonCondition {
    const left = this.parseFieldReference();

    // Check for CONTAINS, STARTSWITH, ENDSWITH
    let operator: ComparisonOperator;
    if (this.match("keyword", "CONTAINS")) {
      this.advance();
      operator = "CONTAINS";
    } else if (this.match("keyword", "STARTSWITH")) {
      this.advance();
      operator = "STARTSWITH";
    } else if (this.match("keyword", "ENDSWITH")) {
      this.advance();
      operator = "ENDSWITH";
    } else if (this.match("operator")) {
      operator = this.currentToken.value as ComparisonOperator;
      this.advance();
    } else {
      throw new ParseError(
        `Expected comparison operator, got '${this.currentToken.value}'`,
        this.currentToken.position
      );
    }

    const right = this.parseValue();

    return {
      type: "comparison",
      left,
      operator,
      right,
    };
  }

  private parseValue(): ValueExpression {
    // String literal
    if (this.match("string")) {
      const value = this.currentToken.value;
      this.advance();
      return { type: "literal", value };
    }

    // Number literal
    if (this.match("number")) {
      const value = parseFloat(this.currentToken.value);
      this.advance();
      return { type: "literal", value };
    }

    // Boolean/null literals
    if (this.match("keyword", "true")) {
      this.advance();
      return { type: "literal", value: true };
    }
    if (this.match("keyword", "false")) {
      this.advance();
      return { type: "literal", value: false };
    }
    if (this.match("keyword", "null")) {
      this.advance();
      return { type: "literal", value: null };
    }

    // Field reference
    if (this.match("identifier")) {
      return this.parseFieldReference();
    }

    throw new ParseError(
      `Expected value, got '${this.currentToken.value}'`,
      this.currentToken.position
    );
  }

  private parseSortClauses(): SortClause[] {
    const clauses: SortClause[] = [];
    clauses.push(this.parseSortClause());

    while (this.match("punctuation", ",")) {
      this.advance();
      clauses.push(this.parseSortClause());
    }

    return clauses;
  }

  private parseSortClause(): SortClause {
    const field = this.parseFieldReference();
    let direction: SortDirection = "ASC";

    if (this.match("keyword", "ASC")) {
      this.advance();
      direction = "ASC";
    } else if (this.match("keyword", "DESC")) {
      this.advance();
      direction = "DESC";
    }

    return { field, direction };
  }
}

// Convenience function
export function parseDataviewQuery(input: string): DataviewQuery {
  const parser = new DataviewParser(input);
  return parser.parse();
}
