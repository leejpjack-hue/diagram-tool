import { useState } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { useDiagramStore } from './store/diagramStore';

const ARCHITECTURE_DSL = `diagram: architecture
title: Insurance Claims Platform

service ClaimsAPI {
  type: api
  tech: Node.js
  port: 3000
  connects: ClaimsService, PolicyService
}

service ClaimsService {
  type: microservice
  tech: Java
  replicas: 3
  connects: ClaimsDB, EventQueue
}

service PolicyService {
  type: microservice
  tech: Python
  connects: PolicyDB
}

database ClaimsDB {
  type: postgresql
  data: claims, claim_events
}

database PolicyDB {
  type: mongodb
  data: policies, customers
}

queue EventQueue {
  type: kafka
  topic: claim-events
}`;

const FLOW_DSL = `diagram: flow
title: Claims Processing Flow

start FNOL

FNOL -> Intake
Intake -> Assignment
Assignment -> Investigation

Investigation ->|Fraud Detected| SpecialInvestigation
Investigation ->|No Fraud| Evaluation

SpecialInvestigation -> Evaluation

Evaluation ->|Approved| Settlement
Evaluation ->|Denied| Closure

Settlement -> Payment -> Closure

end Closure

node FNOL {
  label: First Notice of Loss
  system: ClaimsAPI
  duration: 1d
}

node Investigation {
  assignee: ClaimsAdjuster
  duration: 5d
}

node Payment {
  system: PaymentGateway
  type: external
}`;

function App() {
  const { setDslText, diagramMode, setDiagramMode } = useDiagramStore();
  const [activeTab, setActiveTab] = useState<'architecture' | 'flow'>('architecture');

  const handleTabChange = (tab: 'architecture' | 'flow') => {
    setActiveTab(tab);
    setDiagramMode(tab);
    
    // Load corresponding DSL
    if (tab === 'architecture') {
      setDslText(ARCHITECTURE_DSL);
    } else {
      setDslText(FLOW_DSL);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-canvas-white">
      {/* Header */}
      <header className="h-header-h bg-white border-b border-border-gray flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-deep-navy rounded-sm"></div>
          <h1 className="text-lg font-semibold text-deep-navy">DiagramTool</h1>
        </div>
        
        {/* Mode Tabs */}
        <div className="ml-6 flex gap-1">
          <button
            onClick={() => handleTabChange('architecture')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'architecture'
                ? 'bg-electric-indigo text-white'
                : 'text-slate-600 border border-border-gray hover:bg-panel-light'
            }`}
          >
            🏗️ Architecture
          </button>
          <button
            onClick={() => handleTabChange('flow')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'flow'
                ? 'bg-electric-indigo text-white'
                : 'text-slate-600 border border-border-gray hover:bg-panel-light'
            }`}
          >
            🔄 Flow
          </button>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-border-gray rounded hover:bg-panel-light transition">
            Save
          </button>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-electric-indigo rounded hover:bg-indigo-600 transition">
            Export PNG
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-panel-w">
          <DSLEditor />
        </div>
        
        {/* Canvas */}
        <DiagramCanvas />
        
        {/* Properties Panel */}
        <PropertiesPanel />
      </div>
      
      {/* Footer */}
      <footer className="h-toolbar-h bg-white border-t border-border-gray flex items-center px-6 text-xs text-slate-500">
        <div className="capitalize">{diagramMode} Mode</div>
        <div className="ml-auto">Zoom: 100%</div>
      </footer>
    </div>
  );
}

export default App;
