// Mermaid-style sequence diagram parser.
//
// Accepts the common core of Mermaid's `sequenceDiagram` syntax:
//
//   sequenceDiagram
//   title Checkout Flow
//   participant U as User
//   actor S as Support
//   U->>S: Hello            (solid arrow)
//   S-->>U: Hi back         (dashed reply)
//   U->S / U-->S            (open arrows — rendered the same)
//   U-)S: async             (async — rendered solid)
//   Note over U,S: text     (also: Note left of U / Note right of U)
//   loop Every minute ... end
//   alt Success ... else Failure ... end
//   opt Optional ... end
//
// Activation markers (`->>+`, `-->>-`, activate/deactivate lines) are
// accepted and ignored so real Mermaid files paste in cleanly.

export interface SequenceParticipant {
  id: string;
  name: string;
  actor: boolean; // declared with `actor` instead of `participant`
}

export type SequenceItem =
  | { kind: 'message'; from: string; to: string; text: string; dashed: boolean }
  | { kind: 'note'; targets: string[]; position: 'over' | 'left' | 'right'; text: string }
  | { kind: 'frameStart'; frameType: string; label: string }
  | { kind: 'frameElse'; label: string }
  | { kind: 'frameEnd' };

export interface SequenceDiagramModel {
  title: string;
  participants: SequenceParticipant[];
  items: SequenceItem[];
}

const MESSAGE_RE = /^([\w "]+?)\s*(-{1,2})(>>|>|\)|[xX])\s*([+-]?)\s*([\w "]+?)\s*:\s*(.*)$/;

function cleanId(raw: string): string {
  return raw.trim().replace(/^"|"$/g, '');
}

export function parseSequenceDiagram(text: string): SequenceDiagramModel {
  const participants: SequenceParticipant[] = [];
  const items: SequenceItem[] = [];
  let title = '';

  const seen = new Map<string, SequenceParticipant>();
  const ensure = (rawId: string, name?: string, actor = false): SequenceParticipant => {
    const id = cleanId(rawId);
    let p = seen.get(id);
    if (!p) {
      p = { id, name: name ?? id, actor };
      seen.set(id, p);
      participants.push(p);
    } else if (name) {
      p.name = name;
    }
    return p;
  };

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || line.startsWith('#')) continue;
    if (/^sequenceDiagram\b/i.test(line)) continue;
    if (/^autonumber\b/i.test(line)) continue;
    if (/^(activate|deactivate)\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s*:?\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    const partMatch = line.match(/^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i);
    if (partMatch) {
      ensure(partMatch[2], partMatch[3]?.trim(), partMatch[1].toLowerCase() === 'actor');
      continue;
    }

    const noteMatch = line.match(/^note\s+(over|left of|right of)\s+([\w ,"]+?)\s*:\s*(.+)$/i);
    if (noteMatch) {
      const position = noteMatch[1].toLowerCase().startsWith('over')
        ? 'over'
        : noteMatch[1].toLowerCase().startsWith('left') ? 'left' : 'right';
      const targets = noteMatch[2].split(',').map(t => ensure(t).id);
      items.push({ kind: 'note', targets, position, text: noteMatch[3].trim() });
      continue;
    }

    const frameMatch = line.match(/^(loop|alt|opt|par|critical|break)\b\s*(.*)$/i);
    if (frameMatch) {
      items.push({ kind: 'frameStart', frameType: frameMatch[1].toLowerCase(), label: frameMatch[2].trim() });
      continue;
    }
    const elseMatch = line.match(/^(else|and)\b\s*(.*)$/i);
    if (elseMatch) {
      items.push({ kind: 'frameElse', label: elseMatch[2].trim() });
      continue;
    }
    if (/^end\b/i.test(line)) {
      items.push({ kind: 'frameEnd' });
      continue;
    }

    const msgMatch = line.match(MESSAGE_RE);
    if (msgMatch) {
      const from = ensure(msgMatch[1]).id;
      const to = ensure(msgMatch[5]).id;
      items.push({
        kind: 'message',
        from,
        to,
        text: msgMatch[6].trim(),
        dashed: msgMatch[2] === '--',
      });
      continue;
    }
    // Unrecognised lines are skipped so partial typing never hard-fails.
  }

  return { title, participants, items };
}
