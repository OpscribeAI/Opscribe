import { useEffect, useState } from 'react';

export default function InfoPage({ page }: { page: string }) {
  const [status, setStatus] = useState('Checking the API…');
  const checkStatus = async () => {
    setStatus('Checking the API…');
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      setStatus(response.ok && body.status === 'ok' ? 'API reachable — health check passed.' : 'The API did not pass its health check.');
    } catch { setStatus('Could not reach the API. Please try again.'); }
  };
  useEffect(() => { if (page === 'status') void checkStatus(); }, [page]);
  const titles: Record<string,string> = { docs: 'Opscribe documentation', status: 'Service status', security: 'Security guide', privacy: 'Data & privacy' };
  return <div className="min-h-screen bg-slate-950 text-slate-200">
    <header className="flex flex-wrap justify-between gap-4 border-b border-slate-800 p-6"><a href="/" className="text-xl font-bold text-white">← Opscribe</a><nav className="flex gap-5 text-blue-300"><a href="/demo">Live demo</a><a href="/docs">Documentation</a><a href="/api/docs">API reference</a></nav></header>
    <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="mb-10 text-4xl font-bold text-white">{titles[page]}</h1>
      {page === 'docs' && <div className="space-y-10 leading-7">
        <section id="getting-started"><h2 className="mb-3 text-2xl font-semibold">Get started</h2><p>Open the <a href="/demo" className="text-blue-300 underline">interactive demo</a> to explore a sample system. Select components on the canvas or in the component menu, drag them to rearrange the map, and follow connections to inspect dependencies.</p><p className="mt-3">For your own infrastructure, choose <a href="/?signup=1" className="text-blue-300 underline">Create an account</a>. After signing in, use Settings to configure your GitHub or AWS integration and start discovery from the dashboard.</p></section>
        <section id="intelligence"><h2 className="mb-3 text-2xl font-semibold">Architecture intelligence</h2><p>The signed-in app can ingest a graph and answer questions using the configured AI service. AI chat requires a server-side Groq API key. The public demo uses guided explanations of sample data and does not send questions to an AI service.</p></section>
        <section id="exports"><h2 className="mb-3 text-2xl font-semibold">Export a diagram</h2><p>Choose Export JSON in the demo to download the current components, their positions, and their connections. Reset layout restores the example. PowerPoint export and automatic Terraform generation are not available in this release.</p></section>
        <section id="api"><h2 className="mb-3 text-2xl font-semibold">API</h2><p>Explore endpoint definitions and request schemas in the <a href="/api/docs" className="text-blue-300 underline">API reference</a>. Check current connectivity on the <a href="/status" className="text-blue-300 underline">service status page</a>.</p></section>
      </div>}
      {page === 'status' && <section className="rounded-xl border border-slate-700 p-6"><p role="status" className="text-xl">{status}</p><p className="mt-4 text-slate-400">This checks the Opscribe API health endpoint. It does not test your cloud integrations or AI provider.</p><button onClick={() => void checkStatus()} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-white">Check again</button></section>}
      {page === 'security' && <div className="space-y-6 leading-7"><p>The public demo uses sample data and needs no cloud credentials.</p><h2 className="text-2xl font-semibold">Connecting your infrastructure</h2><p>Use a dedicated cloud role with only the read permissions needed for discovery. Review GitHub App repository permissions before installation. Do not include secrets in diagrams or uploaded source files.</p><p>Sign-in is handled by Auth0. The application encrypts selected integration credential fields using its configured encryption key. The operator must keep that key stable across deployments.</p><p>This guide does not certify the service’s compliance with any security standard.</p></div>}
      {page === 'privacy' && <div className="space-y-6 leading-7"><h2 className="text-2xl font-semibold">Public demo</h2><p>The demo contains sample architecture data. Diagram edits stay in the page’s memory and disappear on reload. Export JSON saves a file to your device.</p><h2 className="text-2xl font-semibold">Signed-in application</h2><p>Auth0 handles authentication. Opscribe stores account identifiers, infrastructure graphs, and configured integration information in its database. Connected providers may supply repository or cloud resource information. When configured, AI queries send relevant context to the AI provider.</p><p>The app stores your sidebar display preference in your browser. Replit hosts the app and may record request logs. This page describes the current product behavior; it is not a complete organizational privacy policy.</p></div>}
    </main>
  </div>;
}
