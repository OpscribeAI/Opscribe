import React, { useEffect } from "react";
import { 
  Users, 
  ArrowRight, 
  Cpu, 
  Presentation, 
  Terminal,
  Layers,
  Sparkles,
  Search
} from "lucide-react";

interface LandingPageProps {
  onLaunch: () => void;
  onEnterprise: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch, onEnterprise }) => {
  // Simple Scroll Reveal Implementation
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#050a14] text-white selection:bg-cyan-500/30 overflow-x-hidden">
      <div className="hero-glow" />
      
      {/* Hero Section */}
      <section className="pt-40 pb-32 px-8 max-w-7xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 mb-8 animate-fade-in-up">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            The World's First LLM for Infrastructure
          </span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Map. Understand. <br />
          <span className="gradient-text">Architectural Intelligence.</span>
        </h1>
        
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-fade-in-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
          Opscribe transforms generic UML diagrams and existing cloud graphs into a grounded knowledge engine. Explain architecture to stakeholders and onboard teams in minutes.
        </p>
        
        <div className="flex flex-wrap items-center justify-center gap-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <button 
            onClick={onLaunch}
            className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-lg hover:shadow-[0_0_40px_rgba(0,242,255,0.4)] transition-all flex items-center gap-2 active:scale-95 glow-card"
          >
            Launch Agentic Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button 
            onClick={onEnterprise}
            className="px-10 py-5 rounded-2xl glass border-white/10 font-bold text-lg hover:bg-white/10 transition-all active:scale-95"
          >
            Schedule Enterprise Audit
          </button>
        </div>
      </section>

      {/* Featured Bento Grid */}
      <section className="py-32 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-20 reveal">
          <h2 className="text-4xl font-bold mb-4">Grounded in Reality. Powered by AI.</h2>
          <p className="text-slate-400">Everything you need to manage enterprise-scale operations in one intelligent hub.</p>
        </div>

        <div className="bento-grid">
          {/* Main Feature: RAG Engine */}
          <div className="bento-item group bento-item-lg p-10 flex flex-col justify-between reveal">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Cpu className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold">Infinite Context RAG</h3>
              <p className="text-slate-400">Our custom RAG engine ingests your UML, Cloud JSON, and Telemetry data to provide 100% grounded architectural intelligence.</p>
            </div>
            <div className="mt-8 flex gap-2">
              <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold border border-white/10 text-slate-400">GARDENED DATA</span>
              <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold border border-white/10 text-slate-400">JSON SCHEMA</span>
            </div>
          </div>

          {/* Multimodal: PowerPoints */}
          <div className="bento-item group bento-item-tall p-8 flex flex-col justify-center reveal" style={{ transitionDelay: "0.1s" }}>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6">
              <Presentation className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Slide Generation</h3>
            <p className="text-slate-400 text-sm">Transform complex graphs into executive PowerPoints for your next board meeting instantly.</p>
          </div>

          <div className="bento-item group bento-item-sm p-6 reveal" style={{ transitionDelay: "0.2s" }}>
             <Terminal className="w-6 h-6 text-emerald-400 mb-4" />
             <h4 className="font-bold text-sm">Terraform Sync</h4>
             <p className="text-slate-500 text-xs">IaC auto-generation.</p>
          </div>

          <div className="bento-item group bento-item-sm p-6 reveal" style={{ transitionDelay: "0.3s" }}>
             <Shield className="w-6 h-6 text-rose-400 mb-4" />
             <h4 className="font-bold text-sm">SOC2 Isolation</h4>
             <p className="text-slate-500 text-xs">Secure data silos.</p>
          </div>

          {/* New Hire Experience */}
          <div className="bento-item group bento-item-md p-8 flex items-center gap-8 reveal" style={{ transitionDelay: "0.4s" }}>
             <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 relative">
                <Users className="w-10 h-10 text-indigo-400" />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold">+10</div>
             </div>
             <div>
               <h3 className="text-xl font-bold mb-2">Onboard Devs 10x Faster</h3>
               <p className="text-slate-400 text-sm">Opscribe generates interactive onboarding guides that let new hires 'Chat with the System'.</p>
             </div>
          </div>
        </div>
      </section>

      {/* The "LLM for Infra" Deep Dive */}
      <section className="py-32 px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="grid md:grid-cols-2 gap-20 items-center">
          <div className="reveal">
            <h2 className="text-4xl font-black mb-8">From Sketch to <span className="gradient-text">Intelligence.</span></h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Don't manually document your infrastructure. Just drop your UML diagrams or export your Cloud JSON. Opscribe's grounded LLM analyzes the relationships and builds a living knowledge base.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                Identifies critical dependencies automatically
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                Bridges the gap between PMs and Lead Architects
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                Grounds AI responses in your actual system logic
              </li>
            </ul>
          </div>
          <div className="relative reveal" style={{ transitionDelay: "0.2s" }}>
            <div className="w-full aspect-square glass-card p-4 flex flex-col gap-4 animate-float">
               <div className="h-8 w-1/2 rounded bg-white/5 animate-pulse" />
               <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
               <div className="flex-1 rounded-2xl bg-[#050a14]/50 border border-white/5 flex items-center justify-center text-slate-600">
                  <Layers className="w-20 h-20 opacity-20" />
               </div>
               <div className="h-10 w-full rounded-xl bg-gradient-to-r from-cyan-400/20 to-indigo-400/20 flex items-center px-4">
                  <Search className="w-4 h-4 text-cyan-400 mr-2" />
                  <span className="text-xs text-cyan-400 font-mono">system.analyze(architecture_uml.json)</span>
               </div>
            </div>
            <div className="absolute -top-10 -right-10 w-40 h-40 glass-card p-6 rotate-12 animate-float" style={{ animationDelay: "1s" }}>
               <Presentation className="w-full h-full text-indigo-400 opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* Developer Companion CTA */}
      <section className="py-32 px-8">
         <div className="max-w-4xl mx-auto glass-card p-16 text-center reveal">
            <h2 className="text-4xl font-bold mb-6">Coming Soon: The Developer Companion</h2>
            <p className="text-slate-400 mb-10 text-lg">
              A Copilot plugin that lets you chat with your entire architecture directly from your IDE. Understand your infrastructure without leaving the code.
            </p>
            <div className="flex justify-center gap-4">
               <button className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition-all">
                  Join Beta Waitlist
               </button>
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 text-center reveal">
        <h2 className="text-5xl md:text-7xl font-black mb-12">Ready to <span className="gradient-text">Architect?</span></h2>
        <button 
          onClick={onLaunch}
          className="px-12 py-6 rounded-3xl bg-white text-[#050a14] font-black text-2xl hover:scale-105 transition-all shadow-white/20 shadow-2xl active:scale-95"
        >
          GET STARTED FOR FREE
        </button>
      </section>

      {/* Footer */}
      <footer className="py-20 px-8 border-t border-white/5 text-center text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-4">
           <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-indigo-600 p-0.5">
              <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain rounded-sm" />
           </div>
           <span className="text-lg font-bold text-white tracking-widest uppercase">Opscribe</span>
        </div>
        <p className="text-sm">Engineered for the intelligent enterprise. © 2026 Opscribe.</p>
      </footer>
    </div>
  );
};

const Shield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default LandingPage;
