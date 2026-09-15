import { useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import InfrastructureNode from '../InfrastructureNode';
import type { InfrastructureNodeData } from '../../types/infrastructure';

const nodeTypes = { infrastructureNode: InfrastructureNode };
const sampleNodes: Node<InfrastructureNodeData>[] = [
  { id: 'cdn', type: 'infrastructureNode', position: { x: 0, y: 160 }, data: { label: 'CloudFront CDN', category: 'networking', icon: 'Globe', description: 'Caches static content near visitors and forwards application requests to the load balancer.' } },
  { id: 'lb', type: 'infrastructureNode', position: { x: 260, y: 160 }, data: { label: 'Load Balancer', category: 'networking', icon: 'Network', description: 'Distributes incoming HTTPS requests across healthy application instances.' } },
  { id: 'api', type: 'infrastructureNode', position: { x: 520, y: 160 }, data: { label: 'Application API', category: 'compute', icon: 'Server', description: 'Handles application requests, reads the cache, stores records in PostgreSQL, and queues background work.' } },
  { id: 'db', type: 'infrastructureNode', position: { x: 820, y: 0 }, data: { label: 'PostgreSQL', category: 'database', icon: 'Database', description: 'Stores the application’s durable records. Database availability is critical for reads and writes.' } },
  { id: 'cache', type: 'infrastructureNode', position: { x: 820, y: 160 }, data: { label: 'Redis Cache', category: 'database', icon: 'Zap', description: 'Stores frequently requested data to reduce database load. Cache misses fall back to PostgreSQL.' } },
  { id: 'queue', type: 'infrastructureNode', position: { x: 820, y: 320 }, data: { label: 'Job Queue', category: 'messaging', icon: 'List', description: 'Buffers background work so it can be processed independently of web requests.' } },
  { id: 'worker', type: 'infrastructureNode', position: { x: 1090, y: 320 }, data: { label: 'Background Worker', category: 'compute', icon: 'Cpu', description: 'Consumes queued jobs and writes generated files to object storage.' } },
  { id: 'storage', type: 'infrastructureNode', position: { x: 1360, y: 320 }, data: { label: 'Object Storage', category: 'storage', icon: 'HardDrive', description: 'Keeps files produced by background jobs separate from the application servers.' } },
];
const sampleEdges: Edge[] = [['cdn','lb'],['lb','api'],['api','db'],['api','cache'],['api','queue'],['queue','worker'],['worker','storage']].map(([source,target]) => ({ id: `${source}-${target}`, source, target, animated: true, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#60a5fa', strokeWidth: 2 } }));
const questions = [
  { question: 'How does a request flow?', answer: 'Visitors reach CloudFront, which serves cached content or forwards the request through the load balancer to the Application API. The API consults Redis and PostgreSQL, and queues work that can run in the background.' },
  { question: 'What if the database goes down?', answer: 'The Application API loses access to durable records. Some cached responses may remain available, but writes and uncached reads fail. In this example, the database is a critical dependency.' },
  { question: 'How does background work run?', answer: 'The API adds work to the Job Queue. The Background Worker consumes it and saves generated files to Object Storage. A worker outage delays jobs without immediately blocking web requests.' },
];

export default function DemoPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(sampleNodes);
  const [edges, , onEdgesChange] = useEdgesState(sampleEdges);
  const [selected, setSelected] = useState(sampleNodes[2]);
  const [answer, setAnswer] = useState(questions[0].answer);
  const [notice, setNotice] = useState('');

  const exportDiagram = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: 'Opscribe sample architecture', nodes, edges }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'opscribe-demo.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Diagram downloaded as opscribe-demo.json.');
  };

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
      <a className="font-black text-xl" href="/">← Opscribe</a>
      <nav className="flex items-center gap-5 text-sm"><a href="/docs" className="text-blue-300">Documentation</a><a href="/?signup=1" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold">Create an account</a></nav>
    </header>
    <main className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-400">Interactive demo · sample data</p><h1 className="text-3xl font-bold">Explore a cloud architecture</h1><p className="mt-2 text-slate-400">Drag components, inspect dependencies, and explore the example. No account required.</p></div>
        <div className="flex gap-3"><button className="rounded-lg border border-slate-700 px-4 py-2" onClick={() => { setNodes(sampleNodes.map(n => ({ ...n, position: { ...n.position } }))); setSelected(sampleNodes[2]); setAnswer(questions[0].answer); setNotice('Sample layout reset.'); }}>Reset layout</button><button className="rounded-lg bg-blue-600 px-4 py-2" onClick={exportDiagram}>Export JSON</button></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="h-[520px] overflow-hidden rounded-2xl border border-slate-800" aria-label="Interactive sample architecture">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_,node) => setSelected(node)} nodesConnectable={false} deleteKeyCode={null} fitView minZoom={0.2} maxZoom={2}>
            <Background color="#334155" /><Controls showInteractive={false} /><MiniMap nodeColor="#3b82f6" maskColor="rgba(2,6,23,0.7)" />
          </ReactFlow>
        </div>
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Inspect a component</h2>
          <label htmlFor="demo-component" className="mt-4 block text-sm text-slate-400">Component</label>
          <select id="demo-component" className="my-3 w-full rounded-lg bg-slate-800 p-3" value={selected.id} onChange={e => setSelected(nodes.find(n => n.id === e.target.value)!)}>{nodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select>
          <p className="text-sm leading-6 text-slate-300">{selected.data.description}</p>
          <h3 className="mt-6 font-semibold">Connected components</h3>
          <ul className="mt-3 space-y-2 text-sm">{edges.filter(e => e.source === selected.id || e.target === selected.id).map(e => { const other = nodes.find(n => n.id === (e.source === selected.id ? e.target : e.source))!; return <li key={e.id}><button className="text-left text-blue-300 hover:underline" onClick={() => setSelected(other)}>{e.source === selected.id ? '→' : '←'} {other.data.label}</button></li>; })}</ul>
        </aside>
      </div>
      <section className="mt-5 rounded-2xl border border-slate-800 p-6"><h2 className="text-xl font-semibold">Understand this system</h2><p className="mt-2 text-sm text-slate-400">Guided explanations for this sample architecture.</p><div className="my-5 flex flex-wrap gap-3">{questions.map(q => <button key={q.question} onClick={() => setAnswer(q.answer)} className="rounded-full border border-blue-500/40 px-4 py-2 text-sm text-blue-300 hover:bg-blue-500/10">{q.question}</button>)}</div><p className="max-w-4xl leading-7" aria-live="polite">{answer}</p></section>
      <p role="status" className="mt-3 text-sm text-emerald-400">{notice}</p>
      <p className="mt-4 text-sm text-slate-500">Changes stay in this demo until you leave or reload. Use Export JSON to keep a copy.</p>
    </main>
  </div>;
}
