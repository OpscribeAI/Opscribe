import { useState, useEffect } from "react";
import { Settings, Database, Github, CheckCircle, AlertCircle, Play, Copy, Check, Eye } from "lucide-react";
import IngestionVisualization from "./IngestionVisualization";
// IngestionIntelligenceReport removed per request

const API_BASE = "/api";

interface SettingsModalProps {
    isOpen: boolean;
    initialTab?: "aws" | "repos";
    onClose: () => void;
}

export default function SettingsModal({ isOpen, initialTab, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<"aws" | "repos">(initialTab || "aws");
    
    // Use an effect to sync activeTab with initialTab when the modal opens
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);
    
    // Real client ID — fetched from /clients/me on mount
    const [clientId, setClientId] = useState<string | null>(null);
    useEffect(() => {
        fetch(`${API_BASE}/clients/me`)
            .then(r => r.json())
            .then(d => setClientId(d.id))
            .catch(() => console.error("Could not load client session from /clients/me"));
    }, []);

    // AWS State
    const [authMethod, setAuthMethod] = useState<"role" | "keys">("role");
    const [awsRegion, setAwsRegion] = useState("us-east-1");
    const [roleArn, setRoleArn] = useState("");
    const [externalId, setExternalId] = useState("");
    const [awsAccessKey, setAwsAccessKey] = useState("");
    const [awsSecretKey, setAwsSecretKey] = useState("");
    const [awsStatus, setAwsStatus] = useState<{ type: "success" | "error", text: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // GitHub Config State
    const [githubInstallUrl, setGithubInstallUrl] = useState<string | null>(null);
    const [ghAppSlug, setGhAppSlug] = useState("");
    const [ghAppId, setGhAppId] = useState("");
    const [ghPrivateKey, setGhPrivateKey] = useState("");
    const [ghWebhookSecret, setGhWebhookSecret] = useState("");
    const [isSavingGh, setIsSavingGh] = useState(false);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [githubStatus, setGithubStatus] = useState<{ type: "success" | "error", text: string } | null>(null);
    const [showIngestionViz, setShowIngestionViz] = useState(false);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates({ ...copiedStates, [id]: true });
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
    };

    useEffect(() => {
        if (clientId) {
            fetch(`${API_BASE}/github/config?client_id=${clientId}`)
                .then(r => r.json())
                .then(d => {
                    setGithubInstallUrl(d.app_install_url);
                })
                .catch(() => setGithubInstallUrl(null));
        }
    }, [clientId, isOpen]);

    // Repo State
    const [availableRepos, setAvailableRepos] = useState<any[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [selectedRepo, setSelectedRepo] = useState("");
    const [repos, setRepos] = useState<any[]>([]);
    const [loadingRepos, setLoadingRepos] = useState(false);
    const [ingesting, setIngesting] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen && clientId) {
            fetchRepos(clientId);
            fetchAvailableRepos(clientId);
            
            const params = new URLSearchParams(window.location.search);
            if (params.get("github_app_installed") === "true") {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [isOpen, clientId]);

    const fetchRepos = async (cid: string) => {
        setLoadingRepos(true);
        try {
            const res = await fetch(`${API_BASE}/github/connected-repos?client_id=${cid}`);
            if (res.ok) setRepos(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingRepos(false);
        }
    };

    const fetchAvailableRepos = async (cid: string) => {
        setLoadingAvailable(true);
        try {
            const res = await fetch(`${API_BASE}/github/repos?client_id=${cid}`);
            if (res.ok) {
                const data = await res.json();
                setAvailableRepos(data);
                if (data.length > 0) setSelectedRepo(data[0].name);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleForceIngest = async (repo: any) => {
        setIngesting({ ...ingesting, [repo.id]: true });
        try {
            await fetch(`${API_BASE}/pipeline/export`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    client_id: clientId, 
                    repo_url: repo.repo_url, 
                    include_github: true, 
                    include_aws: false 
                })
            });
            setTimeout(() => {
                fetchRepos(clientId!);
                setShowIngestionViz(true); // Open status viz
            }, 2000);
        } catch (e) {
            console.error("Manual sync failed", e);
        } finally {
            setIngesting({ ...ingesting, [repo.id]: false });
        }
    };

    const handleConnectAndIngest = async () => {
        if (!clientId || !selectedRepo) return;
        const repoObj = availableRepos.find(r => r.name === selectedRepo);
        const branch = repoObj?.default_branch || "main";

        try {
            await fetch(`${API_BASE}/github/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    repo_url: `https://github.com/${selectedRepo}`,
                    target_repo_id: String(repoObj?.id || ""),
                    default_branch: branch
                })
            });
            setTimeout(() => {
                fetchRepos(clientId);
                fetchAvailableRepos(clientId);
                setShowIngestionViz(true); // Open the visualization automatically
            }, 1500);
        } catch (e) {
            console.error("Failed to connect", e);
        }
    };

    const handleSaveAWS = async () => {
        if (!clientId) return;
        setIsSaving(true);
        setAwsStatus(null);
        try {
            const credentialsPayload: any = { region: awsRegion };
            if (authMethod === "role" && roleArn) {
                credentialsPayload.role_arn = roleArn;
                if (externalId) credentialsPayload.external_id = externalId;
            } else if (authMethod === "keys" && (awsAccessKey || awsSecretKey)) {
                credentialsPayload.aws_access_key_id = awsAccessKey;
                credentialsPayload.aws_secret_access_key = awsSecretKey;
            }

            if (Object.keys(credentialsPayload).length > 1) {
                const res = await fetch(`${API_BASE}/integrations/aws?client_id=${clientId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ credentials: credentialsPayload })
                });

                if (!res.ok) throw new Error("Failed to validate AWS credentials.");

                await fetch(`${API_BASE}/pipeline/export`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ client_id: clientId, include_aws: true, include_github: false, aws_region: awsRegion })
                });
            }
            setAwsStatus({ type: "success", text: "Integrations saved & discovery started!" });
        } catch (e: any) {
            setAwsStatus({ type: "error", text: e.message || "Failed to save integrations" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGitHub = async () => {
        if (!clientId) return;
        setIsSavingGh(true);
        setGithubStatus(null);
        try {
            const res = await fetch(`${API_BASE}/integrations/github_app?client_id=${clientId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    credentials: {
                        github_app_slug: ghAppSlug,
                        github_app_id: ghAppId,
                        github_private_key: ghPrivateKey,
                        github_webhook_secret: ghWebhookSecret,
                    }
                })
            });
            if (!res.ok) throw new Error("Failed to save App configuration");
            
            // Clear sensitive fields after successful save
            setGhPrivateKey(""); 
            setGhWebhookSecret("");
            
            // Refresh repos and config
            await fetchRepos(clientId);
            fetch(`${API_BASE}/github/config?client_id=${clientId}`)
                .then(r => r.json())
                .then(d => setGithubInstallUrl(d.app_install_url));
                
            setGithubStatus({ type: "success", text: "GitHub App credentials saved successfully!" });
            setShowIngestionViz(true); // Open visualization
        } catch (e: any) {
            setGithubStatus({ type: "error", text: e.message || "Failed to save GitHub App configuration" });
        } finally {
            setIsSavingGh(false);
        }
    };

    if (!isOpen) return null;

    // Constructed setup URLs based on the user's requirement
    const homepageUrl = "http://localhost:5173";
    const setupUrl = `${homepageUrl}/api/github/app/callback?client_id=${clientId}`;
    const webhookUrl = `${homepageUrl}/api/github/webhook?client_id=${clientId}`;

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                            <Settings className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Provider Settings</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Manage your cloud and source control integrations</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowIngestionViz(true)}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all flex items-center gap-2"
                        >
                            <Eye className="w-3 h-3" />
                            Pipeline Status
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
                            <Play className="w-5 h-5 rotate-45" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-950/30">
                    <button className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'aws' ? 'text-blue-400 border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`} onClick={() => setActiveTab("aws")}>
                        <Database className="w-4 h-4 inline mr-2 mb-0.5" /> AWS Configuration
                    </button>
                    <button className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'repos' ? 'text-blue-400 border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`} onClick={() => setActiveTab("repos")}>
                        <Github className="w-4 h-4 inline mr-2 mb-1" /> Repositories
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-900/40">
                    {activeTab === "aws" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-sm font-medium text-white mb-3 flex items-center justify-between">AWS Discovery Setup</h3>
                                <div className="flex bg-gray-800 p-1 rounded-lg mb-5 w-max">
                                    <button onClick={() => setAuthMethod("role")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${authMethod === 'role' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Role-based Access</button>
                                    <button onClick={() => setAuthMethod("keys")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${authMethod === 'keys' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Access Keys</button>
                                </div>
                                {authMethod === "role" ? (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-xs text-gray-500 mb-1">Role ARN</label><input type="text" value={roleArn} onChange={e => setRoleArn(e.target.value)} placeholder="arn:aws:iam::..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">External ID</label><input type="text" value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="Optional" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="block text-xs text-gray-500 mb-1">Access Key ID</label><input type="text" value={awsAccessKey} onChange={e => setAwsAccessKey(e.target.value)} placeholder="AKIA..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">Secret Key</label><input type="password" value={awsSecretKey} onChange={e => setAwsSecretKey(e.target.value)} placeholder="••••••••" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                                    </div>
                                )}
                                <div><label className="block text-xs text-gray-500 mb-1">Default Region</label><input type="text" value={awsRegion} onChange={e => setAwsRegion(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" /></div>
                            </div>
                            {awsStatus && <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${awsStatus.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-800/50' : 'bg-red-900/20 text-red-400 border border-red-800/50'}`}>{awsStatus.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}<p className="mt-0.5">{awsStatus.text}</p></div>}
                            <div className="flex justify-end pt-4"><button onClick={handleSaveAWS} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">{isSaving ? "Saving..." : "Save Configuration"}</button></div>
                        </div>
                    )}

                    {activeTab === "repos" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            
                            {/* Section 1: Create or Configure GitHub App */}
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">1</div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium mb-2">Create or Configure a GitHub App</h3>
                                        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                                            Opscribe requires a dedicated GitHub App installed on your Organization. To create a new app or configure an existing one, go to <span className="text-gray-200">Settings &gt; Developer Settings &gt; GitHub Apps</span> and ensure the following values are set:
                                        </p>

                                        <div className="space-y-3">
                                            {[
                                                { label: "Homepage URL", value: homepageUrl, id: "homepage" },
                                                { label: "Setup URL (Post-Install)", value: setupUrl, id: "setup" },
                                                { label: "Webhook URL", value: webhookUrl, id: "webhook" }
                                            ].map(item => (
                                                <div key={item.id} className="flex items-center justify-between bg-gray-950/50 p-3 rounded-lg border border-gray-800 group">
                                                    <span className="text-xs text-gray-500">{item.label}</span>
                                                    <div className="flex items-center gap-3 max-w-[70%]">
                                                        <code className="text-[11px] text-blue-400 truncate font-mono">{item.value}</code>
                                                        <button onClick={() => handleCopy(item.value, item.id)} className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-500 hover:text-white">
                                                            {copiedStates[item.id] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 p-3 bg-blue-600/5 rounded-lg border border-blue-500/10">
                                            <h4 className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">Important Settings:</h4>
                                            <ul className="text-[11px] text-gray-400 space-y-1.5 ml-1 list-disc list-inside">
                                                <li>Under <span className="text-gray-200">Post Installation</span>, check <span className="text-gray-200">"Redirect on update"</span>.</li>
                                                <li>Repository Permissions: <span className="text-gray-200">Contents (Read), Metadata (Read), Workflows (Read)</span></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Configure App Credentials */}
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium mb-4">Configure App Credentials</h3>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-[11px] text-gray-500 mb-1.5 ml-1">App Name (Slug) *</label>
                                                <input type="text" value={ghAppSlug} onChange={e => setGhAppSlug(e.target.value)} placeholder="my-company-opscribe" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all focus:bg-gray-800" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] text-gray-500 mb-1.5 ml-1">App ID *</label>
                                                <input type="text" value={ghAppId} onChange={e => setGhAppId(e.target.value)} placeholder="123456" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all focus:bg-gray-800" />
                                            </div>
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-[11px] text-gray-500 mb-1.5 ml-1">Webhook Secret (Optional)</label>
                                            <input type="password" value={ghWebhookSecret} onChange={e => setGhWebhookSecret(e.target.value)} placeholder="Enter the secret you created..." className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all focus:bg-gray-800" />
                                        </div>
                                        <div className="mb-6">
                                            <label className="block text-[11px] text-gray-500 mb-1.5 ml-1">Private Key (PEM Content) *</label>
                                            <textarea value={ghPrivateKey} onChange={e => setGhPrivateKey(e.target.value)} rows={3} placeholder="-----BEGIN RSA PRIVATE KEY-----..." className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs font-mono text-gray-300 focus:border-blue-500 outline-none transition-all focus:bg-gray-800 resize-none" />
                                        </div>
                                        {githubStatus && <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${githubStatus.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-800/50' : 'bg-red-900/20 text-red-400 border border-red-800/50'}`}>{githubStatus.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}<p className="mt-0.5">{githubStatus.text}</p></div>}
                                        <div className="flex justify-end pt-2">
                                            <button onClick={handleSaveGitHub} disabled={isSavingGh} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-blue-900/20">
                                                {isSavingGh ? "Saving..." : "Save App Credentials"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Repository Connection */}
                            {githubInstallUrl && (
                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-500">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold shrink-0">3</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-white font-medium">Connect & Ingest</h3>
                                                <a href={githubInstallUrl} target="_blank" rel="noreferrer" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-medium border border-gray-700 flex items-center gap-2 transition-colors">
                                                    <Github className="w-4 h-4" /> Go to App Installation
                                                </a>
                                            </div>

                                            <div className="p-4 bg-gray-950/50 rounded-lg border border-gray-800 flex items-end gap-3 mb-6">
                                                <div className="flex-1">
                                                    <label className="block text-[11px] text-gray-500 mb-2 ml-1">Available Repositories</label>
                                                    <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-200 outline-none focus:border-blue-500 transition-all focus:bg-gray-800" disabled={loadingAvailable || availableRepos.length === 0}>
                                                        {availableRepos.length === 0 ? <option>No repositories found. Ensure app is installed.</option> : availableRepos.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                    </select>
                                                </div>
                                                <button onClick={handleConnectAndIngest} disabled={loadingAvailable || availableRepos.length === 0} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-all active:scale-95 shadow-lg shadow-green-900/20">
                                                    Connect & Ingest
                                                </button>
                                            </div>

                                            {loadingRepos ? (
                                                <div className="text-center py-8 flex flex-col items-center gap-3">
                                                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                    <span className="text-xs text-gray-500">Loading connected repositories...</span>
                                                </div>
                                            ) : repos.length > 0 ? (
                                                <div className="space-y-3">
                                                    {repos.map((repo: any) => (
                                                        <div key={repo.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between group hover:border-gray-700 transition-all">
                                                            <div className="flex-1 min-w-0 pr-4">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded uppercase tracking-widest">{repo.default_branch || "main"}</span>
                                                                    <a href={repo.repo_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-300 hover:text-white transition-colors truncate">{repo.repo_url.replace("https://github.com/", "")}</a>
                                                                </div>
                                                                <div className="flex items-center gap-4 mt-2">
                                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${repo.ingestion_status === 'success' ? 'bg-green-500' : repo.ingestion_status === 'failed' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                                                                        Status: <span className="text-gray-300 font-medium capitalize">{repo.ingestion_status || "Pending"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleForceIngest(repo)} disabled={ingesting[repo.id]} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 text-gray-300 hover:text-white rounded text-[11px] font-medium transition-all active:scale-95 border border-gray-700">
                                                                <Play className="w-3 h-3" />
                                                                {ingesting[repo.id] ? "Running..." : "Sync Now"}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <Github className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No connected repositories found</p>
                                            <p>Please check your GitHub App installation and try again.</p>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
</div>
</div>
        <IngestionVisualization 
            clientId={clientId} 
            isOpen={showIngestionViz} 
            onClose={() => setShowIngestionViz(false)} 
        />
</>
    );
}
