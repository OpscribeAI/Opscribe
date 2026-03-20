import { useState, useCallback } from "react";
import InfrastructureDashboard from "./components/InfrastructureDashboard";
import InfrastructureDesigner from "./components/InfrastructureDesigner";
import LandingPage from "./components/landing/LandingPage";
import EnterpriseSetup from "./components/landing/EnterpriseSetup";
import Navbar from "./components/landing/Navbar";
import { useInfrastructureDesigns } from "./hooks/useInfrastructureDesigns";
import type { Node, Edge } from "reactflow";
import type { InfrastructureNodeData } from "./types/infrastructure";
import "./App.css";

type View = "LANDING" | "ENTERPRISE" | "DASHBOARD" | "DESIGNER";

function App() {
  const {
    designs,
    loading,
    error,
    createDesignAsync,
    updateDesign,
    deleteDesign,
    getDesign,
  } = useInfrastructureDesigns();
  
  const [currentView, setCurrentView] = useState<View>("LANDING");
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);

  const handleLaunchApp = useCallback(() => {
    setCurrentView("DASHBOARD");
  }, []);

  const handleGoToEnterprise = useCallback(() => {
    setCurrentView("ENTERPRISE");
  }, []);

  const handleGoHome = useCallback(() => {
    setCurrentView("LANDING");
    setActiveDesignId(null);
  }, []);

  const handleCreateNew = useCallback(() => {
    setCreatePending(true);
    createDesignAsync()
      .then((design) => {
        setActiveDesignId(design.id);
        setCurrentView("DESIGNER");
      })
      .finally(() => setCreatePending(false));
  }, [createDesignAsync]);

  const handleOpenDesign = useCallback((id: string) => {
    setActiveDesignId(id);
    setCurrentView("DESIGNER");
  }, []);

  const handleBackToDashboard = useCallback(
    (
      nodes: Node<InfrastructureNodeData>[],
      edges: Edge[],
      name: string
    ) => {
      if (activeDesignId) {
        updateDesign(activeDesignId, { nodes, edges, name });
      }
      setActiveDesignId(null);
      setCurrentView("DASHBOARD");
    },
    [activeDesignId, updateDesign]
  );

  const activeDesign = activeDesignId ? getDesign(activeDesignId) : null;

  // Render Logic
  return (
    <div className="min-h-screen bg-[#050a14]">
      {/* Show Navbar on Landing and Enterprise pages */}
      {(currentView === "LANDING" || currentView === "ENTERPRISE") && (
        <Navbar onNavigate={(view) => {
          if (view === "DASHBOARD") handleLaunchApp();
          else if (view === "ENTERPRISE") handleGoToEnterprise();
          else handleGoHome();
        }} currentView={currentView} />
      )}

      {currentView === "LANDING" && (
        <LandingPage onLaunch={handleLaunchApp} onEnterprise={handleGoToEnterprise} />
      )}

      {currentView === "ENTERPRISE" && (
        <EnterpriseSetup onBack={handleGoHome} />
      )}

      {currentView === "DASHBOARD" && (
        <InfrastructureDashboard
          designs={designs}
          loading={loading}
          error={error}
          createPending={createPending}
          onCreateNew={handleCreateNew}
          onOpenDesign={handleOpenDesign}
          onDeleteDesign={deleteDesign}
        />
      )}

      {currentView === "DESIGNER" && (
        <InfrastructureDesigner
          design={activeDesign ?? { id: activeDesignId!, name: "Untitled Infrastructure", updatedAt: new Date().toISOString(), nodes: [], edges: [] }}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

export default App;
