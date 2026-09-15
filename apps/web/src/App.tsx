import { useState, useCallback, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setApiToken, authFetch as fetch } from "./api/client";
import InfrastructureDashboard from "./components/InfrastructureDashboard";
import InfrastructureDesigner from "./components/InfrastructureDesigner";
import LandingPage from "./components/landing/LandingPage";
import Sidebar from "./components/Sidebar";
import LoadingProgress from "./components/LoadingProgress";
import SettingsModal from "./components/SettingsModal";
import { useInfrastructureDesigns } from "./hooks/useInfrastructureDesigns";
import type { Node, Edge } from "reactflow";
import type { InfrastructureNodeData } from "./types/infrastructure";
import "./App.css";

const API_BASE = "/api";

type View = "dashboard" | "designer";

function App() {
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently, user, logout, error: providerError } = useAuth0();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  const startLogin = useCallback((signup = false) => {
    setLoginError(null);
    void loginWithRedirect(signup ? { authorizationParams: { screen_hint: 'signup' } } : undefined)
      .catch(() => setLoginError('Sign-in could not start. Please try again, or explore the live demo.'));
  }, [loginWithRedirect]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && new URLSearchParams(window.location.search).get('signup') === '1') {
      window.history.replaceState({}, '', '/');
      startLogin(true);
    }
  }, [isLoading, isAuthenticated, startLogin]);

  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then(token => {
          setApiToken(token);
          setTokenReady(true);
        })
        .catch(() => { setLoginError('Unable to finish sign-in. Please retry login.'); setTokenReady(true); });
    } else if (!isLoading) {
      setTokenReady(true);
    }
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

   const [view, setView] = useState<View>("dashboard");
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);
  
  // Ingestion State
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestingGraphName, setIngestingGraphName] = useState("");
  const [prevDesignsCount, setPrevDesignsCount] = useState(0);

  // Connection State
  const [awsConnected, setAwsConnected] = useState<boolean | null>(null);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"aws" | "repos" | undefined>(undefined);

  const {
    designs,
    loading: designsLoading,
    error,
    updateDesign,
    deleteDesign,
    getDesign,
  } = useInfrastructureDesigns(tokenReady && isAuthenticated, isAuthenticated);

  // Fetch connection status
  const fetchConnections = useCallback(() => {
    if (!tokenReady || !isAuthenticated) return;
    fetch(`${API_BASE}/clients/me`)
      .then(r => r.json())
      .then(d => {
        setClientId(d.id);
        fetch(`${API_BASE}/integrations/?client_id=${d.id}`)
          .then(r => r.json())
          .then(ints => {
            const hasAws = Array.isArray(ints) && ints.some((i: any) => i.provider === 'aws');
            const hasGh = Array.isArray(ints) && ints.some((i: any) => i.provider === 'github_app');
            setAwsConnected(hasAws);
            setGithubConnected(hasGh);
          });
      })
      .catch(() => {
        setAwsConnected(false);
        setGithubConnected(false);
      });
  }, [tokenReady, isAuthenticated]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections, isSettingsOpen]);

  // Watch for new designs to stop ingestion
  useEffect(() => {
    if (isIngesting && designs.length > prevDesignsCount) {
      setIsIngesting(false);
      setIngestingGraphName("");
    }
    setPrevDesignsCount(designs.length);
  }, [designs, isIngesting, prevDesignsCount]);

  const handleOpenDesign = useCallback((id: string) => {
    setActiveDesignId(id);
    setView("designer");
    setIsCollapsed(true);
  }, []);

  const handleStartIngestion = useCallback((name: string) => {
    setIngestingGraphName(name);
    setIsIngesting(true);
    setPrevDesignsCount(designs.length);
  }, [designs.length]);

  const handleBack = useCallback(
    (
      nodes: Node<InfrastructureNodeData>[],
      edges: Edge[],
      name: string
    ) => {
      if (activeDesignId) {
        updateDesign(activeDesignId, { nodes, edges, name });
      }
      setActiveDesignId(null);
      setView("dashboard");
      setIsCollapsed(false);
    },
    [activeDesignId, updateDesign]
  );

  const openSettings = (tab?: "aws" | "repos") => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const activeDesign = activeDesignId ? getDesign(activeDesignId) : null;

  if ((providerError || loginError) && !isLoading) {
    return <div className="min-h-screen bg-slate-950 p-10 text-white"><h1 className="text-2xl font-bold">Sign-in needs attention</h1><p role="alert" className="my-5">{loginError || 'Your sign-in could not be completed. Please try again.'}</p><button className="rounded-lg bg-blue-600 px-5 py-3" onClick={() => startLogin()}>Retry login</button><a href="/demo" className="ml-6 text-blue-300">Explore the live demo</a><a href="/" className="ml-6 text-blue-300">Back to home</a></div>;
  }

  if (isLoading || !tokenReady) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center text-gray-400 font-mono text-sm">
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LandingPage
        onLaunch={() => startLogin(true)}
        onLogin={() => startLogin()}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] overflow-hidden">
      <Sidebar 
        designs={designs}
        activeDesignId={activeDesignId}
        onOpenDesign={handleOpenDesign}
        onNewDesign={() => {
          setView("dashboard");
          setIsCollapsed(false);
        }}
        onOpenSettings={openSettings}
        awsConnected={awsConnected}
        githubConnected={githubConnected}
        user={user}
        onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      <main className="flex-1 relative overflow-hidden">
        {view === "designer" && activeDesignId ? (
          <InfrastructureDesigner
            design={activeDesign ?? { id: activeDesignId, name: "Untitled Infrastructure", updatedAt: new Date().toISOString(), nodes: [], edges: [] }}
            onBack={handleBack}
          />
        ) : (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <InfrastructureDashboard
              designs={designs}
              loading={designsLoading}
              error={error}
              clientId={clientId}
              onOpenDesign={handleOpenDesign}
              onDeleteDesign={deleteDesign}
              onIngestionTriggered={handleStartIngestion}
            />
          </div>
        )}
      </main>

      <LoadingProgress 
        isVisible={isIngesting} 
        graphName={ingestingGraphName} 
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
