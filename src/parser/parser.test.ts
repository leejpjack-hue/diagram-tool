import { describe, it, expect } from 'vitest';
import { parseDiagram } from './parser';

describe('Architecture Parser', () => {
  it('should parse diagram mode declaration', () => {
    const dsl = `diagram: architecture`;
    const result = parseDiagram(dsl);
    expect(result.mode).toBe('architecture');
  });

  it('should parse diagram title', () => {
    const dsl = `
diagram: architecture
title: Test Diagram
    `;
    const result = parseDiagram(dsl);
    expect(result.title).toBe('Test Diagram');
  });

  it('should parse a simple service', () => {
    const dsl = `
service TestService {
  type: api
  tech: Node.js
}
    `;
    const result = parseDiagram(dsl);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('service');
    expect(result.nodes[0].name).toBe('TestService');
    expect(result.nodes[0].id).toBe('testservice');
  });

  it('should parse service with all properties', () => {
    const dsl = `
service FullService {
  type: microservice
  tech: Java
  port: 8080
  replicas: 3
}
    `;
    const result = parseDiagram(dsl);
    const node = result.nodes[0];
    expect(node.type).toBe('service');
    if (node.type === 'service') {
      expect(node.properties.type).toBe('microservice');
      expect(node.properties.tech).toBe('Java');
      expect(node.properties.port).toBe(8080);
      expect(node.properties.replicas).toBe(3);
    }
  });

  it('should parse connections and create edges', () => {
    const dsl = `
service ServiceA {
  connects: ServiceB
}
service ServiceB {}
    `;
    const result = parseDiagram(dsl);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('servicea');
    expect(result.edges[0].to).toBe('serviceb');
  });

  it('should parse multiple connections', () => {
    const dsl = `
service Hub {
  connects: Service1, Service2, Service3
}
service Service1 {}
service Service2 {}
service Service3 {}
    `;
    const result = parseDiagram(dsl);
    expect(result.edges).toHaveLength(3);
  });

  it('should parse database node', () => {
    const dsl = `
database TestDB {
  type: postgresql
  data: users, orders, products
}
    `;
    const result = parseDiagram(dsl);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('database');
    expect(result.nodes[0].name).toBe('TestDB');
  });

  it('should parse queue node', () => {
    const dsl = `
queue EventQueue {
  type: kafka
  topic: order-events
}
    `;
    const result = parseDiagram(dsl);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('queue');
    expect(result.nodes[0].name).toBe('EventQueue');
  });

  it('should parse group with contains', () => {
    const dsl = `
group ClaimsDomain {
  contains: ClaimsService, ClaimsDB
}
    `;
    const result = parseDiagram(dsl);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('ClaimsDomain');
    expect(result.groups[0].contains).toContain('claimsservice');
    expect(result.groups[0].contains).toContain('claimsdb');
  });

  it('should parse complete architecture diagram', () => {
    const dsl = `
diagram: architecture
title: Insurance Claims Platform

service ClaimsAPI {
  type: api
  tech: Node.js
  port: 3000
  connects: ClaimsService
}

service ClaimsService {
  type: microservice
  tech: Java
  replicas: 3
  connects: ClaimsDB
}

database ClaimsDB {
  type: postgresql
  data: claims, claim_events
}
    `;
    const result = parseDiagram(dsl);
    expect(result.mode).toBe('architecture');
    expect(result.title).toBe('Insurance Claims Platform');
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it('should handle empty input', () => {
    const result = parseDiagram('');
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.groups).toHaveLength(0);
  });

  it('should generate unique node IDs', () => {
    const dsl = `
service MyAPI-Gateway {
  type: api
}
database Main_DB {
  type: postgresql
}
    `;
    const result = parseDiagram(dsl);
    expect(result.nodes[0].id).toBe('myapi_gateway');
    expect(result.nodes[1].id).toBe('main_db');
  });
});
