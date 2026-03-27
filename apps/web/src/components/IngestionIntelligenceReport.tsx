import { useState, useEffect } from "react";
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Github, 
  Database, 
  Clock,
  TrendingUp,
  RefreshCw,
  Settings,
  AlertCircle,
  Info,
  Eye
} from "lucide-react";

const API_BASE = "/api";

interface CredentialHealth {
  is_valid: boolean;
  installation_valid: boolean;
  error_message?: string;
  last_checked: string;
}

interface Metrics {
  total_repositories: number;
  successful_ingestions: number;
  failed_ingestions: number;
  pending_ingestions: number;
  success_rate: number;
  avg_ingestion_time_seconds?: number;
  last_ingestion?: string;
}

interface Repository {
  id: string;
  repo_url: string;
  default_branch: string;
  ingestion_status: string;
  last_ingested_at?: string;
  created_at: string;
  updated_at: string;
}

interface Alert {
  severity: "error" | "warning" | "info";
  message: string;
}

interface IntelligenceReport {
  client_id: string;
  timestamp: string;
  health_score: number;
  credential_health: CredentialHealth;
  metrics: Metrics;
  repositories: Repository[];
  recommendations: string[];
  alerts: Alert[];
  error?: string;
}

interface IngestionIntelligenceReportProps {
  clientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleVisualization?: () => void;
}

export default function IngestionIntelligenceReport({ 
  clientId, 
  isOpen, 
  onClose,
  onToggleVisualization
}: IngestionIntelligenceReportProps) {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'repositories' | 'recommendations'>('overview');

  useEffect(() => {
    if (!isOpen || !clientId) return;
    
    fetchReport();
    
    if (autoRefresh) {
      const interval = setInterval(fetchReport, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, clientId, autoRefresh]);

  const fetchReport = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ingestion-intelligence/report/${clientId}`);
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error("Failed to fetch intelligence report:", error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500/20 border-green-500/50";
    if (score >= 60) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-red-500/20 border-red-500/50";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertBg = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-red-900/20 border-red-800/50 text-red-400";
      case "warning":
        return "bg-yellow-900/20 border-yellow-800/50 text-yellow-400";
      default:
        return "bg-blue-900/20 border-blue-800/50 text-blue-400";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Ingestion Intelligence Report</h2>
              <p className="text-xs text-gray-400 mt-0.5">Comprehensive monitoring and analytics for GitHub ingestion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                autoRefresh ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {report ? (
            <div className="flex h-full">
              {/* Sidebar */}
              <div className="w-80 border-r border-gray-800 p-4 space-y-4">
                {/* Health Score */}
                <div className={`p-4 rounded-lg border ${getHealthScoreBg(report.health_score)} group relative`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white">Health Score</span>
                      <div className="relative group/tooltip">
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-950 border border-gray-800 rounded shadow-xl text-[10px] text-gray-400 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50">
                          <p className="font-semibold text-gray-200 mb-1">Score Breakdown:</p>
                          <ul className="space-y-1">
                            <li>• Credentials: 40%</li>
                            <li>• Success Rate: 40%</li>
                            <li>• Recent Activity: 20%</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <Activity className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className={`text-2xl font-bold ${getHealthScoreColor(report.health_score)}`}>
                    {report.health_score}/100
                  </div>
                </div>

                {/* Credential Status */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Github className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-white">GitHub Credentials</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">App Valid</span>
                      {report.credential_health.is_valid ? 
                        <CheckCircle className="w-3 h-3 text-green-500" /> : 
                        <XCircle className="w-3 h-3 text-red-500" />
                      }
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Installation Valid</span>
                      {report.credential_health.installation_valid ? 
                        <CheckCircle className="w-3 h-3 text-green-500" /> : 
                        <XCircle className="w-3 h-3 text-red-500" />
                      }
                    </div>
                    {report.credential_health.error_message && (
                      <div className="text-xs text-red-400 mt-2">
                        {report.credential_health.error_message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-white">Ingestion Metrics</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Repos</span>
                      <span className="text-white">{report.metrics.total_repositories}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success Rate</span>
                      <span className="text-white">{report.metrics.success_rate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Failed</span>
                      <span className="text-red-400">{report.metrics.failed_ingestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pending</span>
                      <span className="text-yellow-400">{report.metrics.pending_ingestions}</span>
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                {report.alerts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Alerts</h4>
                    {report.alerts.map((alert, index) => (
                      <div key={index} className={`p-2 rounded-lg border text-xs ${getAlertBg(alert.severity)}`}>
                        <div className="flex items-start gap-2">
                          {getAlertIcon(alert.severity)}
                          <span>{alert.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col">
                {/* Tabs */}
                <div className="flex border-b border-gray-800">
                  {[
                    { id: 'overview', label: 'Overview', icon: Activity },
                    { id: 'repositories', label: 'Repositories', icon: Github },
                    { id: 'recommendations', label: 'Recommendations', icon: Settings }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedTab(id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        selectedTab === id
                          ? 'text-white border-blue-500 bg-blue-600/10'
                          : 'text-gray-400 border-transparent hover:text-white hover:border-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selectedTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium text-white mb-4">Performance Overview</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium text-white">Success Rate</span>
                            </div>
                            <div className="text-2xl font-bold text-white">
                              {report.metrics.success_rate.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {report.metrics.successful_ingestions} of {report.metrics.total_repositories} repositories
                            </div>
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-sm font-medium text-white">Last Ingestion</span>
                            </div>
                            <div className="text-sm text-white">
                              {report.metrics.last_ingestion ? 
                                new Date(report.metrics.last_ingestion).toLocaleString() : 
                                'No ingestions yet'
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      {report.error && (
                        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-400">Error</span>
                          </div>
                          <div className="text-sm text-red-400">{report.error}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 'repositories' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Connected Repositories</h3>
                      {report.repositories.length > 0 ? (
                        <div className="space-y-2">
                          {report.repositories.map((repo) => (
                            <div key={repo.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(repo.ingestion_status)}
                                  <div>
                                    <div className="text-sm font-medium text-white">
                                      {repo.repo_url.split('/').pop()}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {repo.repo_url} • {repo.default_branch}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                  <div className="space-y-0.5">
                                    <div className="text-xs text-gray-400">
                                      Last updated: {new Date(repo.updated_at).toLocaleDateString()}
                                    </div>
                                    {repo.last_ingested_at && (
                                      <div className="text-xs text-gray-400">
                                        Ingested: {new Date(repo.last_ingested_at).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                  {onToggleVisualization && (
                                    <button 
                                      onClick={onToggleVisualization}
                                      className="p-2 hover:bg-gray-700 rounded-lg text-blue-400 transition-colors group/btn"
                                      title="View Live Pipeline Status"
                                    >
                                      <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Github className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No repositories connected yet</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 'recommendations' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Recommendations</h3>
                      <div className="space-y-3">
                        {report.recommendations.map((recommendation, index) => (
                          <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-medium text-blue-400">{index + 1}</span>
                              </div>
                              <p className="text-sm text-gray-300">{recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              {loading ? (
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                  <p className="text-gray-500">Loading intelligence report...</p>
                </div>
              ) : (
                <div className="text-center">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-500" />
                  <p className="text-gray-500">No data available</p>
                  <button
                    onClick={fetchReport}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Load Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
