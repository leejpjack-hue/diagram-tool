import { Lexer, TokenType } from './lexer';
import type { Token } from './lexer';
import type { DiagramNode, Edge, Group, Lane, ParsedDiagram, DiagramMode, FlowNode, CloudProvider, C4Level, ClassNode, LayoutDirection, EdgeStyle } from '../store/types';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private nodes: DiagramNode[] = [];
  private edges: Edge[] = [];
  private groups: Group[] = [];
  private lanes: Lane[] = [];
  private title: string = 'Untitled Diagram';
  private mode: DiagramMode = 'architecture';
  private direction: LayoutDirection = 'TB';
  private edgeStyle: EdgeStyle | undefined; // undefined until the DSL declares `edges:`
  private startNode: string | undefined;
  private endNode: string | undefined;
  private flowNodes: Map<string, FlowNode> = new Map();

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

  // Accept a name in a definition position (after `service`, `lane`, `class`, etc.).
  // A user-defined name may collide with a reserved keyword like `System` or `Cloud`,
  // so allow either token type.
  private expectName(): Token {
    const token = this.advance();
    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.KEYWORD) {
      throw new Error(
        `Expected name but got ${token.type} at line ${token.line}, column ${token.column}`
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
        switch ((token.value as string).toLowerCase()) {
          case 'diagram':
            this.parseDiagramDeclaration();
            break;
          case 'title':
            this.parseTitle();
            break;
          case 'direction':
            this.parseDirection();
            break;
          case 'edges':
            this.parseEdgeStyle();
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
          case 'cloud':
            this.parseCloud();
            break;
          case 'class':
            this.parseClass();
            break;
          case 'group':
            this.parseGroup();
            break;
          case 'lane':
            this.parseLane();
            break;
          case 'start':
            this.parseFlowStart();
            break;
          case 'end':
            this.parseFlowEnd();
            break;
          case 'node':
            this.parseFlowNodeMetadata();
            break;
          default:
            // Try to parse as flow connection if identifier follows
            if (this.mode === 'flow') {
              this.parseFlowConnection();
            } else {
              this.advance();
            }
        }
      } else if (this.mode === 'flow' && token.type === TokenType.IDENTIFIER) {
        // Flow mode: parse connections like "A -> B -> C"
        this.parseFlowConnection();
      } else {
        this.advance();
      }

      this.skipNewlines();
    }

    // Mark decision nodes in flow mode
    if (this.mode === 'flow') {
      this.identifyDecisionNodes();
      this.assignLaneMembership();
    }

    // Convert flowNodes map to array if in flow mode
    const allNodes = this.mode === 'flow'
      ? Array.from(this.flowNodes.values())
      : this.nodes;

    return {
      mode: this.mode,
      title: this.title,
      nodes: allNodes,
      edges: this.edges,
      groups: this.groups,
      lanes: this.lanes.length > 0 ? this.lanes : undefined,
      startNode: this.startNode,
      endNode: this.endNode,
      direction: this.direction,
      edgeStyle: this.edgeStyle,
    };
  }

  // Parse `edges: curved | orthogonal | step | straight` (aliases:
  // bezier→curved, smoothstep→orthogonal, line→straight).
  // Anything unrecognised falls back to curved.
  private parseEdgeStyle(): void {
    this.advance(); // consume 'edges'
    this.expect(TokenType.COLON);
    const valueToken = this.advance();
    if (
      valueToken.type !== TokenType.IDENTIFIER &&
      valueToken.type !== TokenType.STRING &&
      valueToken.type !== TokenType.KEYWORD
    ) {
      return;
    }
    const raw = String(valueToken.value).toLowerCase().replace(/[\s_-]/g, '');
    if (raw === 'orthogonal' || raw === 'smoothstep' || raw === 'rounded') {
      this.edgeStyle = 'orthogonal';
    } else if (raw === 'step' || raw === 'sharp' || raw === '90' || raw === 'rightangle') {
      this.edgeStyle = 'step';
    } else if (raw === 'straight' || raw === 'line' || raw === 'direct') {
      this.edgeStyle = 'straight';
    } else {
      this.edgeStyle = 'curved';
    }
  }

  // Map each lane's `contains` ids onto the corresponding flow node's lane property.
  private assignLaneMembership(): void {
    this.lanes.forEach(lane => {
      lane.contains.forEach(nodeId => {
        const node = this.flowNodes.get(nodeId);
        if (node) {
          node.properties = node.properties || {};
          node.properties.lane = lane.id;
        }
      });
    });
  }

  private identifyDecisionNodes(): void {
    // Find nodes that have outgoing edges with labels (conditional paths)
    const nodesWithLabeledEdges = new Set<string>();
    
    this.edges.forEach(edge => {
      if (edge.label && edge.label.trim().length > 0) {
        nodesWithLabeledEdges.add(edge.from);
      }
    });
    
    // Mark these nodes as decision nodes — but DON'T overwrite an explicit
    // nodeType that the user already declared (e.g. `type: gatewayexclusive`).
    nodesWithLabeledEdges.forEach(nodeId => {
      const node = this.flowNodes.get(nodeId);
      if (node) {
        node.properties = node.properties || {};
        if (!node.properties.nodeType) {
          node.properties.nodeType = 'decision';
        }
      }
    });
  }

  private parseDiagramDeclaration(): void {
    this.advance(); // consume 'diagram'
    this.expect(TokenType.COLON);
    const modeToken = this.advance();
    if (modeToken.type === TokenType.IDENTIFIER || modeToken.type === TokenType.STRING) {
      this.mode = (modeToken.value as string) as DiagramMode;
    }
  }

  // Parse `direction: vertical | horizontal | tb | lr | top-bottom | left-right`.
  // Unknown values fall back to TB so a typo can't break rendering.
  private parseDirection(): void {
    this.advance(); // consume 'direction'
    this.expect(TokenType.COLON);
    const valueToken = this.advance();
    if (valueToken.type !== TokenType.IDENTIFIER && valueToken.type !== TokenType.STRING && valueToken.type !== TokenType.KEYWORD) {
      return;
    }
    const raw = String(valueToken.value).toLowerCase().replace(/[\s_-]/g, '');
    if (raw === 'horizontal' || raw === 'lr' || raw === 'leftright' || raw === 'lefttoright') {
      this.direction = 'LR';
    } else {
      this.direction = 'TB';
    }
  }

  private parseTitle(): void {
    this.advance(); // consume 'title'
    this.expect(TokenType.COLON);
    
    // Read all tokens until newline to get full title
    const titleParts: string[] = [];
    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      const token = this.advance();
      // Accept identifiers, strings, and keywords (for words like "diagram" in titles)
      if (token.type === TokenType.IDENTIFIER || 
          token.type === TokenType.STRING || 
          token.type === TokenType.KEYWORD) {
        titleParts.push(token.value as string);
      }
    }
    this.title = titleParts.join(' ') || 'Untitled Diagram';
  }

  private parseService(): void {
    this.advance(); // consume 'service'
    const nameToken = this.expectName();
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
        this.advance(); // consume property keyword
        this.expect(TokenType.COLON);
        
        switch ((propToken.value as string).toLowerCase()) {
          case 'type': {
            const typeToken = this.advance();
            node.properties.type = typeToken.value as 'api' | 'microservice' | 'lambda';
            break;
          }
          case 'tech': {
            const techToken = this.advance();
            node.properties.tech = techToken.value as string;
            break;
          }
          case 'port': {
            const portToken = this.advance();
            node.properties.port = portToken.value as number;
            break;
          }
          case 'replicas': {
            const replicasToken = this.advance();
            node.properties.replicas = replicasToken.value as number;
            break;
          }
          case 'level': {
            const v = this.advance();
            node.properties.level = (v.value as string).toLowerCase() as C4Level;
            break;
          }
          case 'parent': {
            const v = this.advance();
            node.properties.parent = (v.value as string).toLowerCase().replace(/[^a-z0-9]/g, '_');
            break;
          }
          case 'color': {
            const v = this.advance();
            node.properties.color = String(v.value);
            break;
          }
          case 'icon': {
            const v = this.advance();
            node.properties.icon = String(v.value);
            break;
          }
          case 'connects': {
            // Don't consume token - parseConnectionList will read identifiers
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
    const nameToken = this.expectName();
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

        const key = (propToken.value as string).toLowerCase();
        if (key === 'connects') {
          // parseConnectionList reads its own identifiers — no value token here
          this.parseConnectionList().forEach((target) => {
            const targetId = target.toLowerCase().replace(/[^a-z0-9]/g, '_');
            this.edges.push({ id: `${id}_to_${targetId}`, from: id, to: targetId });
          });
          continue;
        }

        const valueToken = this.advance();

        switch (key) {
          case 'type':
            node.properties.type = valueToken.value as 'postgresql' | 'mongodb' | 'mysql' | 'redis';
            break;
          case 'data':
            if (valueToken.type === TokenType.STRING) {
              node.properties.data = (valueToken.value as string).split(',').map(s => s.trim());
            }
            break;
          case 'color':
            node.properties.color = String(valueToken.value);
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
    const nameToken = this.expectName();
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

        const key = (propToken.value as string).toLowerCase();
        if (key === 'connects') {
          // parseConnectionList reads its own identifiers — no value token here
          this.parseConnectionList().forEach((target) => {
            const targetId = target.toLowerCase().replace(/[^a-z0-9]/g, '_');
            this.edges.push({ id: `${id}_to_${targetId}`, from: id, to: targetId });
          });
          continue;
        }

        const valueToken = this.advance();

        switch (key) {
          case 'type':
            node.properties.type = valueToken.value as 'kafka' | 'rabbitmq' | 'sqs';
            break;
          case 'topic':
            node.properties.topic = valueToken.value as string;
            break;
          case 'color':
            node.properties.color = String(valueToken.value);
            break;
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  private parseCloud(): void {
    this.advance(); // consume 'cloud'
    const nameToken = this.expectName();
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const node: DiagramNode = {
      type: 'cloud',
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

        switch ((propToken.value as string).toLowerCase()) {
          case 'provider': {
            const v = this.advance();
            node.properties.provider = (v.value as string).toLowerCase() as CloudProvider;
            break;
          }
          case 'kind': {
            const v = this.advance();
            node.properties.kind = (v.value as string).toLowerCase();
            break;
          }
          case 'tech': {
            const v = this.advance();
            node.properties.tech = v.value as string;
            break;
          }
          case 'region': {
            const v = this.advance();
            node.properties.region = v.value as string;
            break;
          }
          case 'level': {
            const v = this.advance();
            node.properties.level = (v.value as string).toLowerCase() as C4Level;
            break;
          }
          case 'parent': {
            const v = this.advance();
            node.properties.parent = (v.value as string).toLowerCase().replace(/[^a-z0-9]/g, '_');
            break;
          }
          case 'color': {
            const v = this.advance();
            node.properties.color = String(v.value);
            break;
          }
          case 'connects': {
            const connections = this.parseConnectionList();
            node.connections = connections;
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
          default:
            this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  private parseClass(): void {
    this.advance(); // consume 'class'
    const nameToken = this.expectName();
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const node: ClassNode = {
      type: 'class',
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

        switch ((propToken.value as string).toLowerCase()) {
          case 'stereotype': {
            // Read rest-of-line as stereotype text.
            const parts: string[] = [];
            while (
              this.peek().type !== TokenType.NEWLINE &&
              this.peek().type !== TokenType.RBRACE &&
              this.peek().type !== TokenType.EOF
            ) {
              const t = this.advance();
              if (
                t.type === TokenType.IDENTIFIER ||
                t.type === TokenType.STRING ||
                t.type === TokenType.KEYWORD
              ) {
                parts.push(String(t.value));
              }
            }
            node.properties.stereotype = parts.join(' ').trim();
            break;
          }
          case 'attributes': {
            // attributes: name:string, age:int
            // Comma-separated entries. Tokens between commas are joined.
            const items = this.readCommaSeparatedLine();
            node.properties.attributes = items;
            break;
          }
          case 'methods': {
            const items = this.readCommaSeparatedLine();
            node.properties.methods = items;
            break;
          }
          case 'level': {
            const v = this.advance();
            node.properties.level = (v.value as string).toLowerCase() as C4Level;
            break;
          }
          case 'parent': {
            const v = this.advance();
            node.properties.parent = (v.value as string).toLowerCase().replace(/[^a-z0-9]/g, '_');
            break;
          }
          case 'color': {
            const v = this.advance();
            node.properties.color = String(v.value);
            break;
          }
          case 'connects': {
            const connections = this.parseConnectionList();
            node.connections = connections;
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
          default:
            this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.nodes.push(node);
  }

  // Read tokens until the next newline/rbrace/eof and split on commas. Each item
  // becomes one entry. Used by `attributes:` and `methods:` on class nodes.
  private readCommaSeparatedLine(): string[] {
    const buffer: string[] = [];
    let current: string[] = [];
    while (
      this.peek().type !== TokenType.NEWLINE &&
      this.peek().type !== TokenType.RBRACE &&
      this.peek().type !== TokenType.EOF
    ) {
      const t = this.advance();
      if (t.type === TokenType.COMMA) {
        if (current.length) buffer.push(current.join(' ').trim());
        current = [];
      } else if (
        t.type === TokenType.IDENTIFIER ||
        t.type === TokenType.STRING ||
        t.type === TokenType.KEYWORD ||
        t.type === TokenType.NUMBER ||
        t.type === TokenType.COLON
      ) {
        current.push(String(t.value));
      }
    }
    if (current.length) buffer.push(current.join(' ').trim());
    return buffer.filter(s => s.length > 0);
  }

  private parseLane(): void {
    this.advance(); // consume 'lane'
    const nameToken = this.expectName();
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const lane: Lane = {
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
      if (propToken.type === TokenType.KEYWORD) {
        this.advance();
        this.expect(TokenType.COLON);

        switch ((propToken.value as string).toLowerCase()) {
          case 'contains': {
            lane.contains = this.parseConnectionList().map(c =>
              c.toLowerCase().replace(/[^a-z0-9]/g, '_')
            );
            break;
          }
          case 'color': {
            const v = this.advance();
            lane.color = v.value as string;
            break;
          }
          default:
            this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.lanes.push(lane);
  }

  private parseGroup(): void {
    this.advance(); // consume 'group'
    const nameToken = this.expectName();
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
      // Compare property keywords case-insensitively — the lexer preserves
      // original casing on token.value, but the user may write `Label:`
      // or `Color:`.
      const propKey =
        propToken.type === TokenType.KEYWORD
          ? String(propToken.value).toLowerCase()
          : '';
      if (propKey === 'contains') {
        this.advance();
        this.expect(TokenType.COLON);
        group.contains = this.parseConnectionList().map(c =>
          c.toLowerCase().replace(/[^a-z0-9]/g, '_')
        );
      } else if (propKey === 'label') {
        // `label:` overrides the default display name
        this.advance();
        this.expect(TokenType.COLON);
        const parts: string[] = [];
        while (
          this.peek().type !== TokenType.NEWLINE &&
          this.peek().type !== TokenType.RBRACE &&
          this.peek().type !== TokenType.EOF
        ) {
          const t = this.advance();
          if (
            t.type === TokenType.IDENTIFIER ||
            t.type === TokenType.STRING ||
            t.type === TokenType.KEYWORD ||
            t.type === TokenType.NUMBER
          ) {
            parts.push(String(t.value));
          }
        }
        if (parts.length > 0) group.label = parts.join(' ');
      } else if (propKey === 'color') {
        this.advance();
        this.expect(TokenType.COLON);
        const t = this.advance();
        if (t.type === TokenType.IDENTIFIER || t.type === TokenType.STRING) {
          group.color = String(t.value);
        }
      } else {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    this.groups.push(group);
  }

  private parseConnectionList(): string[] {
    const connections: string[] = [];
    
    // Collect all identifiers and commas until we hit a closing brace or keyword
    while (true) {
      const token = this.peek();
      
      // Stop on these tokens
      if (token.type === TokenType.RBRACE || 
          token.type === TokenType.EOF) {
        break;
      }
      
      // Skip newlines but continue parsing
      if (token.type === TokenType.NEWLINE) {
        this.advance();
        // After newline, check if we have a keyword (means end of list)
        const next = this.peek();
        if (next.type === TokenType.KEYWORD || next.type === TokenType.RBRACE) {
          break;
        }
        continue;
      }
      
      if (token.type === TokenType.COMMA) {
        this.advance();
        continue;
      }
      
      if (token.type === TokenType.IDENTIFIER) {
        connections.push(token.value as string);
        this.advance();
      } else if (token.type === TokenType.KEYWORD) {
        // Keyword means we've moved to a new property
        break;
      } else {
        // Unknown token, skip it
        this.advance();
      }
    }

    return connections;
  }

  // Flow Mode Parsing
  
  private parseFlowStart(): void {
    this.advance(); // consume 'start'
    const nodeToken = this.peek();
    if (nodeToken.type === TokenType.IDENTIFIER) {
      this.startNode = nodeToken.value as string;
      this.advance();
      
      // Create start node
      const id = this.startNode.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!this.flowNodes.has(id)) {
        this.flowNodes.set(id, {
          type: 'flow',
          id,
          name: this.startNode,
          properties: {},
          isStart: true,
        });
      }
    }
  }

  private parseFlowEnd(): void {
    this.advance(); // consume 'end'
    const nodeToken = this.peek();
    if (nodeToken.type === TokenType.IDENTIFIER) {
      this.endNode = nodeToken.value as string;
      this.advance();
      
      // Create end node
      const id = this.endNode.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!this.flowNodes.has(id)) {
        this.flowNodes.set(id, {
          type: 'flow',
          id,
          name: this.endNode,
          properties: {},
          isEnd: true,
        });
      }
    }
  }

  private parseFlowConnection(): void {
    // Parse flow connections: A -> B -> C or A ->|Label| B
    const nodeNames: string[] = [];
    let currentLabel: string | undefined;
    
    while (this.peek().type !== TokenType.NEWLINE && 
           this.peek().type !== TokenType.EOF &&
           this.peek().type !== TokenType.RBRACE) {
      const token = this.peek();
      
      if (token.type === TokenType.IDENTIFIER) {
        nodeNames.push(token.value as string);
        this.advance();
        
        // Register node
        const id = (token.value as string).toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!this.flowNodes.has(id)) {
          this.flowNodes.set(id, {
            type: 'flow',
            id,
            name: token.value as string,
            properties: {},
          });
        }
      } else if (token.type === TokenType.ARROW) {
        this.advance();
      } else if (token.type === TokenType.PIPE) {
        // Label follows: |Label| — accept multi-word labels until the closing pipe.
        this.advance();
        const labelParts: string[] = [];
        while (
          this.peek().type !== TokenType.PIPE &&
          this.peek().type !== TokenType.NEWLINE &&
          this.peek().type !== TokenType.EOF &&
          this.peek().type !== TokenType.RBRACE
        ) {
          const lt = this.advance();
          if (
            lt.type === TokenType.IDENTIFIER ||
            lt.type === TokenType.STRING ||
            lt.type === TokenType.KEYWORD ||
            lt.type === TokenType.NUMBER
          ) {
            labelParts.push(String(lt.value));
          }
        }
        if (this.peek().type === TokenType.PIPE) {
          this.advance(); // consume closing pipe
        }
        if (labelParts.length > 0) currentLabel = labelParts.join(' ');
      } else if (token.type === TokenType.STRING) {
        // Could be a label
        currentLabel = token.value as string;
        this.advance();
      } else {
        this.advance();
      }
    }
    
    // Create edges between consecutive nodes
    for (let i = 0; i < nodeNames.length - 1; i++) {
      const from = nodeNames[i].toLowerCase().replace(/[^a-z0-9]/g, '_');
      const to = nodeNames[i + 1].toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      this.edges.push({
        id: `${from}_to_${to}_${this.edges.length}`,
        from,
        to,
        label: currentLabel,
      });
      
      // Reset label after first edge
      currentLabel = undefined;
    }
    
    // Skip to end of line
    while (this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  private parseFlowNodeMetadata(): void {
    this.advance(); // consume 'node'
    const nameToken = this.peek();
    if (nameToken.type !== TokenType.IDENTIFIER) {
      return;
    }
    
    const name = nameToken.value as string;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    this.advance();
    
    this.expect(TokenType.LBRACE);
    this.skipNewlines();
    
    const nodeData: Partial<FlowNode> = {
      type: 'flow',
      id,
      name,
      properties: {},
    };
    
    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE) break;
      
      const propToken = this.peek();
      if (propToken.type === TokenType.KEYWORD) {
        this.advance();
        this.expect(TokenType.COLON);

        // Gather the full rest-of-line value (supports multi-word strings)
        const valueParts: string[] = [];
        while (
          this.peek().type !== TokenType.NEWLINE &&
          this.peek().type !== TokenType.RBRACE &&
          this.peek().type !== TokenType.EOF
        ) {
          const t = this.advance();
          if (
            t.type === TokenType.IDENTIFIER ||
            t.type === TokenType.STRING ||
            t.type === TokenType.KEYWORD ||
            t.type === TokenType.NUMBER
          ) {
            valueParts.push(String(t.value));
          }
        }
        const fullValue = valueParts.join(' ').trim();
        const firstValue = valueParts[0] ? String(valueParts[0]) : '';

        switch ((propToken.value as string).toLowerCase()) {
          case 'label':
            nodeData.properties!.label = fullValue;
            break;
          case 'system':
            nodeData.properties!.system = fullValue;
            break;
          case 'duration':
            nodeData.properties!.duration = fullValue;
            break;
          case 'assignee':
            nodeData.properties!.assignee = fullValue;
            break;
          case 'type': {
            const raw = firstValue.toLowerCase().replace(/[-_]/g, '');
            nodeData.properties!.nodeType = raw as FlowNode['properties']['nodeType'];
            break;
          }
        }
      } else {
        this.advance();
      }
    }
    
    this.expect(TokenType.RBRACE);
    
    // Update or create node
    const existing = this.flowNodes.get(id);
    if (existing) {
      this.flowNodes.set(id, {
        ...existing,
        ...nodeData,
        properties: {
          ...existing.properties,
          ...nodeData.properties,
        },
      } as FlowNode);
    } else {
      this.flowNodes.set(id, nodeData as FlowNode);
    }
  }
}

export function parseDiagram(text: string): ParsedDiagram {
  const parser = new Parser(text);
  return parser.parse();
}
