import { Lexer, TokenType } from './lexer';
import type { Token } from './lexer';
import type { DiagramNode, Edge, Group, ParsedDiagram, DiagramMode } from '../store/types';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private nodes: DiagramNode[] = [];
  private edges: Edge[] = [];
  private groups: Group[] = [];
  private title: string = 'Untitled Diagram';
  private mode: DiagramMode = 'architecture';

  constructor(text: string) {
    const lexer = new Lexer(text);
    this.tokens = lexer.tokenize();
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(
        `Expected ${type} but got ${token.type} at line ${token.line}, column ${token.column}`
      );
    }
    return token;
  }

  private skipNewlines(): void {
    while (this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  parse(): ParsedDiagram {
    this.skipNewlines();

    while (this.peek().type !== TokenType.EOF) {
      const token = this.peek();

      if (token.type === TokenType.KEYWORD) {
        switch (token.value) {
          case 'diagram':
            this.parseDiagramDeclaration();
            break;
          case 'title':
            this.parseTitle();
            break;
          case 'service':
            this.parseService();
            break;
          case 'database':
            this.parseDatabase();
            break;
          case 'queue':
            this.parseQueue();
            break;
          case 'group':
            this.parseGroup();
            break;
          default:
            this.advance();
        }
      } else {
        this.advance();
      }

      this.skipNewlines();
    }

    return {
      mode: this.mode,
      title: this.title,
      nodes: this.nodes,
      edges: this.edges,
      groups: this.groups,
    };
  }

  private parseDiagramDeclaration(): void {
    this.advance(); // consume 'diagram'
    this.expect(TokenType.COLON);
    const modeToken = this.advance();
    if (modeToken.type === TokenType.IDENTIFIER || modeToken.type === TokenType.STRING) {
      this.mode = (modeToken.value as string) as DiagramMode;
    }
  }

  private parseTitle(): void {
    this.advance(); // consume 'title'
    this.expect(TokenType.COLON);
    const titleToken = this.advance();
    if (titleToken.type === TokenType.STRING || titleToken.type === TokenType.IDENTIFIER) {
      this.title = titleToken.value as string;
    }
  }

  private parseService(): void {
    this.advance(); // consume 'service'
    const nameToken = this.expect(TokenType.IDENTIFIER);
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const node: DiagramNode = {
      type: 'service',
      id,
      name,
      properties: {},
      connections: [],
    };

    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE) break;

      const propToken = this.peek();
      if (propToken.type === TokenType.KEYWORD) {
        this.advance();
        this.expect(TokenType.COLON);
        
        const valueToken = this.advance();
        
        switch (propToken.value) {
          case 'type':
            node.properties.type = valueToken.value as 'api' | 'microservice' | 'lambda';
            break;
          case 'tech':
            node.properties.tech = valueToken.value as string;
            break;
          case 'port':
            node.properties.port = valueToken.value as number;
            break;
          case 'replicas':
            node.properties.replicas = valueToken.value as number;
            break;
          case 'connects':
            const connections = this.parseConnectionList();
            node.connections = connections;
            // Create edges
            connections.forEach((target) => {
              const targetId = target.toLowerCase().replace(/[^a-z0-9]/g, '_');
              this.edges.push({
                id: `${id}_to_${targetId}`,
                from: id,
                to: targetId,
              });
            });
            break;
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  private parseDatabase(): void {
    this.advance(); // consume 'database'
    const nameToken = this.expect(TokenType.IDENTIFIER);
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const node: DiagramNode = {
      type: 'database',
      id,
      name,
      properties: {},
    };

    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE) break;

      const propToken = this.peek();
      if (propToken.type === TokenType.KEYWORD) {
        this.advance();
        this.expect(TokenType.COLON);
        
        const valueToken = this.advance();
        
        switch (propToken.value) {
          case 'type':
            node.properties.type = valueToken.value as any;
            break;
          case 'data':
            if (valueToken.type === TokenType.STRING) {
              node.properties.data = (valueToken.value as string).split(',').map(s => s.trim());
            }
            break;
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  private parseQueue(): void {
    this.advance(); // consume 'queue'
    const nameToken = this.expect(TokenType.IDENTIFIER);
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const node: DiagramNode = {
      type: 'queue',
      id,
      name,
      properties: {},
    };

    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE) break;

      const propToken = this.peek();
      if (propToken.type === TokenType.KEYWORD) {
        this.advance();
        this.expect(TokenType.COLON);
        
        const valueToken = this.advance();
        
        switch (propToken.value) {
          case 'type':
            node.properties.type = valueToken.value as any;
            break;
          case 'topic':
            node.properties.topic = valueToken.value as string;
            break;
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  private parseGroup(): void {
    this.advance(); // consume 'group'
    const nameToken = this.expect(TokenType.IDENTIFIER);
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const group: Group = {
      id,
      name,
      contains: [],
    };

    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE) break;

      const propToken = this.peek();
      if (propToken.type === TokenType.KEYWORD && propToken.value === 'contains') {
        this.advance();
        this.expect(TokenType.COLON);
        group.contains = this.parseConnectionList().map(c => 
          c.toLowerCase().replace(/[^a-z0-9]/g, '_')
        );
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.groups.push(group);
  }

  private parseConnectionList(): string[] {
    const connections: string[] = [];
    
    while (this.peek().type === TokenType.IDENTIFIER || this.peek().type === TokenType.COMMA) {
      if (this.peek().type === TokenType.COMMA) {
        this.advance();
        continue;
      }
      const idToken = this.advance();
      connections.push(idToken.value as string);
    }

    return connections;
  }
}

export function parseDiagram(text: string): ParsedDiagram {
  const parser = new Parser(text);
  return parser.parse();
}
