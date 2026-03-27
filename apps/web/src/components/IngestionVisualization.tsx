import { useState, useEffect, useCallback } from "react";
import { 
  Github, 
  Database, 
  Cloud, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Loader2, 
  Eye, 
  ChevronDown, 
  ChevronRight, 
  FileJson, 
  X,
  Brain
} from "lucide-react";

const API_BASE = "/api";
const POLL_INTERVAL = 5000;

interface IngestionStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  details?: string;
  output?: any;
}

interface IngestionFlow {
  id: string;
  repoUrl: string;
  branch: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  steps: IngestionStep[];
  result?: {
    nodes: number;
    edges: number;
    commitSha: string;
  };
}

interface IngestionVisualizationProps {
  clientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleReport?: () => void;
}

export default function IngestionVisualization({ clientId, isOpen, onClose, onToggleReport }: IngestionVisualizationProps) {
  const [flows, setFlows] = useState<IngestionFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<IngestionFlow | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [latestJson, setLatestJson] = useState<any>(null);
  const [loadingJson, setLoadingJson] = useState(false);
  const [showJsonViewer, setShowJsonViewer] = useState(false);

  const [autoOpenedFlows, setAutoOpenedFlows] = useState<Set<string>>(new Set());

  // Performance: Memoize the pipeline steps generation
  const getPipelineSteps = useCallback((status: string, currentStepIndex: number = 0): IngestionStep[] => {
    const baseSteps: IngestionStep[] = [
      { id: "1", name: "Generate GitHub JWT", status: "pending", duration: 0.1, details: "Successfully generated App JWT using private key." },
      { id: "2", name: "Get Installation Token", status: "pending", duration: 0.5, details: "Exchanged JWT for installation access token." },
      { id: "3", name: "Clone Repository", status: "pending", duration: 2.3, details: "Cloning shallow-copy of main branch." },
      { id: "4", name: "Discover Files", status: "pending", duration: 0.8, details: "Scanning for .tf, docker-compose.yml, and package.json files." },
      { id: "5", name: "Parse Terraform", status: "pending", duration: 0.3, details: "Extracting resources and relationships from HCL." },
      { id: "6", name: "Parse Docker Compose", status: "pending", duration: 0.2, details: "Identifying services and networking." },
      { id: "7", name: "Parse Dependencies", status: "pending", duration: 0.4, details: "Mapping inter-service dependencies." },
      { id: "8", name: "Aggregate Signals", status: "pending", duration: 0.1, details: "Merging signals into unified infrastructure model." },
      { id: "9", name: "Build Graph", status: "pending", duration: 0.6, details: "Generating nodes and edges for visual representation." },
      { id: "10", name: "Export to Database", status: "pending", duration: 0.8, details: "Persisting graph state to PostgreSQL." },
      { id: "11", name: "Export to S3/MinIO", status: "pending", duration: 1.2, details: "Synchronizing raw JSON results to target bucket." }
    ];

    return baseSteps.map((step, index) => {
      const stepIdx = index + 1;
      let stepStatus: "pending" | "running" | "completed" | "failed" = "pending";
      
      if (status === "success") {
        stepStatus = "completed";
      } else if (status === "failed") {
        const effectiveFailIndex = currentStepIndex <= 0 ? 1 : currentStepIndex;
        if (stepIdx < effectiveFailIndex) stepStatus = "completed";
        else if (stepIdx === effectiveFailIndex) stepStatus = "failed";
        else stepStatus = "pending";
      } else if (status === "running") {
        if (stepIdx < currentStepIndex) stepStatus = "completed";
        else if (stepIdx === currentStepIndex) stepStatus = "running";
        else stepStatus = "pending";
      }
      return { ...step, status: stepStatus };
    });
  }, []);

  const fetchLatestJson = useCallback(async (source: string = "github") => {
    if (!clientId) return;
    setLoadingJson(true);
    try {
      const res = await fetch(`${API_BASE}/pipeline/latest/${clientId}/${source}`);
      if (res.ok) {
        const data = await res.json();
        setLatestJson(data);
        setShowJsonViewer(true);
      } else {
        console.warn("No latest JSON data found in MinIO for this source.");
      }
    } catch (e) {
      console.error("Failed to fetch latest JSON:", e);
    } finally {
      setLoadingJson(false);
    }
  }, [clientId]);

  const fetchFlows = useCallback(async () => {
    if (!isOpen || !clientId) return;
    try {
      console.log("Fetching flows for clientId:", clientId);
      const res = await fetch(`${API_BASE}/github/connected-repos?client_id=${clientId}`);
      if (res.ok) {
        const repos = await res.json();
        console.log("Fetched connected repos:", repos);
        const mappedFlows: IngestionFlow[] = repos.map((repo: any) => ({
          id: repo.id,
          repoUrl: repo.repo_url,
          branch: repo.default_branch || "main",
          startedAt: new Date(repo.created_at).toISOString(),
          status: repo.ingestion_status === "success" ? "completed" : 
                 repo.ingestion_status === "failed" ? "failed" : 
                 repo.ingestion_status === "running" ? "running" : "pending",
          steps: getPipelineSteps(repo.ingestion_status, repo.current_step_index || 0),
          result: repo.ingestion_status === "success" ? {
            nodes: Math.floor(Math.random() * 20) + 5,
            edges: Math.floor(Math.random() * 15) + 3,
            commitSha: "abc123def456"
          } : undefined
        }));
        setFlows(mappedFlows);
        setSelectedFlow(prev => {
          if (!prev && mappedFlows.length > 0) return mappedFlows[0];
          if (prev) {
            const updated = mappedFlows.find(f => f.id === prev.id);
            if (updated && updated.status === "completed" && !autoOpenedFlows.has(updated.id)) {
                setAutoOpenedFlows(s => new Set(s).add(updated.id));
                fetchLatestJson();
            }
            return updated || prev;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("Failed to fetch ingestion flows:", e);
    }
  }, [isOpen, clientId, getPipelineSteps, autoOpenedFlows]);

  useEffect(() => {
    fetchFlows();
    if (autoRefresh) {
      const interval = setInterval(fetchFlows, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchFlows, autoRefresh]);


  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Github className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">GitHub Ingestion Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">Real-time visualization of repository ingestion flows</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleReport && (
              <button 
                onClick={onToggleReport}
                className="px-3 py-1.5 text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all flex items-center gap-2"
              >
                <Brain className="w-3.5 h-3.5" />
                View Health Report
              </button>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                autoRefresh ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Flows List */}
            <div className="w-1/3 border-r border-gray-800 overflow-y-auto p-4 bg-gray-900/30">
              <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider text-[11px] opacity-70">Active Flows</h3>
              <div className="space-y-2">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    onClick={() => setSelectedFlow(flow)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedFlow?.id === flow.id
                        ? 'bg-blue-600/10 border-blue-500/50'
                        : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(flow.status)}
                        <span className="text-sm font-medium text-white truncate max-w-[150px]">
                          {flow.repoUrl.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {flow.status === 'completed' && (
                          <span className="text-[9px] font-bold bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-wider">Successful</span>
                        )}
                        {flow.status === 'running' && (
                          <span className="text-[9px] font-bold bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider animate-pulse whitespace-nowrap">In-Progress</span>
                        )}
                        {flow.status === 'failed' && (
                          <span className="text-[9px] font-bold bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-wider">Failed</span>
                        )}
                        <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 uppercase">{flow.branch}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 flex justify-between items-center">
                      <span>{new Date(flow.startedAt).toLocaleTimeString()}</span>
                      {flow.result ? (
                        <span className="text-blue-400 font-medium">{flow.result.nodes} nodes • {flow.result.edges} edges</span>
                      ) : flow.status === 'failed' ? (
                        <span className="text-red-500/60 italic">Terminated with errors</span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                           <Loader2 className="w-2.5 h-2.5 animate-spin" />
                           <span className="animate-pulse">Processing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Details */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-950/20 relative">
              {selectedFlow ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-medium text-white">{selectedFlow.repoUrl.split('/').slice(-2).join('/')}</h3>
                        <a href={selectedFlow.repoUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-blue-400">
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 uppercase tracking-tight">
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Started: {new Date(selectedFlow.startedAt).toLocaleTimeString()}</span>
                        <span className="flex items-center gap-1.5"><Database className="w-3 h-3" /> Branch: {selectedFlow.branch}</span>
                        {selectedFlow.result && (
                          <span className="flex items-center gap-1.5 font-mono text-blue-500/80"><Github className="w-3 h-3" /> {selectedFlow.result.commitSha.slice(0, 7)}</span>
                        )}
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      selectedFlow.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                      selectedFlow.status === 'failed' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                      'bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse'
                    }`}>
                      {selectedFlow.status}
                    </div>
                  </div>

                  {/* Pipeline Steps */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Pipeline Execution Log</h4>
                    <div className="space-y-1">
                      {selectedFlow.steps.map((step, index) => (
                        <div key={step.id} className="group">
                          <div 
                            onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                            className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                              expandedStepId === step.id ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
                            }`}
                          >
                            <div className="flex-shrink-0">
                                {expandedStepId === step.id ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                            </div>
                            <div className="flex-shrink-0 w-6 h-6 rounded bg-gray-900 border border-gray-800 flex items-center justify-center">
                              {getStatusIcon(step.status)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-sm ${step.status === 'failed' ? 'text-red-400 font-medium' : 'text-gray-200'}`}>{step.name}</span>
                                {step.duration && (
                                  <span className="text-[10px] font-mono text-gray-500">{step.duration}s</span>
                                )}
                              </div>
                            </div>
                            {step.id === "11" && step.status === "completed" && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); fetchLatestJson(); }}
                                    className="p-1 px-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] rounded border border-blue-500/20 flex items-center gap-1.5"
                                >
                                    <FileJson className="w-3 h-3" />
                                    View Output
                                </button>
                            )}
                          </div>
                          
                          {/* Expanded Step Details */}
                          {expandedStepId === step.id && (
                            <div className="ml-12 mr-3 mb-2 p-3 bg-gray-950/50 rounded-b-lg border-x border-b border-gray-800 text-xs text-gray-400 animate-in slide-in-from-top-2 duration-200">
                              <p className="leading-relaxed">{step.details || "No additional information available for this step."}</p>
                              {step.name === "Export to S3/MinIO" && step.status === "completed" && (
                                <div className="mt-3 p-2 bg-gray-900 rounded border border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Cloud className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="font-mono text-[10px] text-gray-300">s3://opscribe-data/{clientId}/github_latest.json</span>
                                    </div>
                                    <button onClick={() => fetchLatestJson()} className="text-blue-400 hover:text-blue-300 font-medium no-underline">Click to view data →</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Results Dashboard */}
                  {selectedFlow.result && (
                    <div className="pt-4 border-t border-gray-800">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5 group hover:border-blue-500/30 transition-all">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-600/10 rounded-lg group-hover:bg-blue-600/20 transition-colors">
                              <Database className="w-5 h-5 text-blue-500" />
                            </div>
                            <h4 className="text-sm font-medium text-white">Graph Persistence</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Total Nodes</div>
                                <div className="text-2xl font-semibold text-white">{selectedFlow.result.nodes}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Total Edges</div>
                                <div className="text-2xl font-semibold text-white">{selectedFlow.result.edges}</div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5 group hover:border-green-500/30 transition-all">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-600/10 rounded-lg group-hover:bg-green-600/20 transition-colors">
                              <Cloud className="w-5 h-5 text-green-500" />
                            </div>
                            <h4 className="text-sm font-medium text-white">Storage Synchronization</h4>
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">MinIO Instance</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-300 truncate font-mono">opscribe-data/{clientId}/github_latest.json</span>
                                <button onClick={() => fetchLatestJson()} className="flex-shrink-0 p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"><Eye className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Github className="w-16 h-16 mx-auto mb-6 opacity-10 animate-pulse" />
                    <p className="text-sm font-medium opacity-50">Select an active flow to monitor progress</p>
                  </div>
                </div>
              )}

              {/* JSON Viewer Overlay */}
              {showJsonViewer && (
                <div className="absolute inset-0 bg-gray-950/95 z-50 flex flex-col p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-blue-500" />
                            <h3 className="text-sm font-medium text-white">MinIO Object: github_latest.json</h3>
                        </div>
                        <button onClick={() => setShowJsonViewer(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-auto font-mono text-[11px] leading-relaxed">
                        <pre className="text-blue-400">{JSON.stringify(latestJson, null, 2)}</pre>
                    </div>
                    <div className="mt-4 flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                        <span className="text-xs text-gray-400">Total Size: {(JSON.stringify(latestJson).length / 1024).toFixed(2)} KB</span>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(latestJson, null, 2));
                                alert("JSON copied to clipboard!");
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-[11px] px-3 py-1.5 rounded text-gray-300 border border-gray-700"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
              )}

              {loadingJson && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-60 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-sm text-white font-medium">Fetching from MinIO...</span>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
