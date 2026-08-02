import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marketplace from './components/Marketplace';
import DedicatedMarketplace from './components/DedicatedMarketplace';
import DocumentationView from './components/DocumentationView';
import ProtocolSpec from './components/ProtocolSpec';
import SellerPortal from './components/SellerPortal';
import AgentTerminal from './components/AgentTerminal';
import PravaModal from './components/PravaModal';
import Footer from './components/Footer';
import { apiRequest } from './api';
import { ArrowRight } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState('human'); // 'human' or 'agent'
  const [view, setView] = useState('landing'); // 'landing', 'marketplace', 'docs', or 'seller'
  const [token, setToken] = useState(localStorage.getItem('weft_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('weft_user') || 'null'));
  const [sellerProfile, setSellerProfile] = useState(JSON.parse(localStorage.getItem('weft_seller') || 'null'));
  const [agentId, setAgentId] = useState(localStorage.getItem('weft_agent_id') || null);

  const [listings, setListings] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [modalInfo, setModalInfo] = useState(null);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchListings = async () => {
    try {
      const data = await apiRequest('/api/listings');
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const setViewWithUrl = (newView) => {
    setView(newView);
    if (newView === 'seller' && user) {
      const sId = sellerProfile ? sellerProfile.id : user.id;
      window.history.pushState({}, '', `/seller-portal?id=${sId}`);
    } else if (newView === 'docs') {
      window.history.pushState({}, '', '/docs');
    } else if (newView === 'marketplace') {
      window.history.pushState({}, '', '/marketplace');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('weft_token');
    localStorage.removeItem('weft_user');
    localStorage.removeItem('weft_seller');
    setToken(null);
    setUser(null);
    setSellerProfile(null);
    setViewWithUrl('landing');
    showToast('Logged out successfully', 'info');
  };

  const handleAuthSuccess = (newToken, newUser, newSellerProfile = null) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('weft_token', newToken);
    localStorage.setItem('weft_user', JSON.stringify(newUser));
    if (newSellerProfile) {
      setSellerProfile(newSellerProfile);
      localStorage.setItem('weft_seller', JSON.stringify(newSellerProfile));
    }
    setViewWithUrl('seller');
  };

  const ensureAgent = async () => {
    if (agentId) return agentId;
    const dummyUserId = user ? user.id : 'demo-user-id';
    const agRes = await apiRequest('/api/agents/register', 'POST', {
      user_id: dummyUserId,
      agent_type: 'antigravity',
      agent_name: 'Antigravity Web Agent',
      capabilities: ['search', 'install', 'purchase']
    });
    setAgentId(agRes.agent_id);
    localStorage.setItem('weft_agent_id', agRes.agent_id);
    return agRes.agent_id;
  };

  const handleInstallFree = async (listingId) => {
    try {
      const agId = await ensureAgent();
      showToast('Executing MCP install tool...', 'info');
      await apiRequest('/api/marketplace/install', 'POST', {
        agent_id: agId,
        listing_id: listingId
      });
      showToast('Asset installed successfully! Delivered manifest & files.', 'success');
      fetchListings();
    } catch (err) {
      showToast(`Install note: ${err.message}`, 'info');
    }
  };

  const handlePurchaseClick = async (listingId, title, priceCents) => {
    try {
      const agId = await ensureAgent();
      showToast('Creating Prava Payment Session...', 'info');
      const res = await apiRequest('/api/marketplace/purchase', 'POST', {
        agent_id: agId,
        listing_id: listingId
      });

      setModalInfo({
        txId: res.transaction_id,
        title,
        priceCents,
        paymentUrl: res.payment_url,
        isMock: res.is_mock === true
      });
    } catch (err) {
      showToast(`Purchase initiation error: ${err.message}`, 'info');
    }
  };

  return (
    <div className="weft-app">
      {/* Top Floating Ticker Banner (Hidden on Docs & Seller Dashboard views) */}
      {view !== 'docs' && view !== 'seller' && (
        <div className="announcement-bar">
          <div className="announcement-inner-pill">
            <div className="badge-pulse-wrapper">
              <span className="badge-pulse"></span>
            </div>
            <span className="announcement-text">
              Powered by <strong>Prava Payments</strong> · <strong>NANDA Index</strong> · <strong>Linq Messaging</strong>
            </span>
            <a onClick={() => setViewWithUrl('docs')} className="announcement-link" style={{ cursor: 'pointer' }}>
              Connect via MCP <ArrowRight size={11} />
            </a>
          </div>
        </div>
      )}

      {/* Main Top Navbar (Hidden on Seller Dashboard for a 100% clean standalone portal experience) */}
      {view !== 'seller' && (
        <Navbar 
          mode={mode} 
          setMode={setMode} 
          view={view}
          setView={setViewWithUrl}
        />
      )}

      {mode === 'human' ? (
        view === 'landing' ? (
          <main>
            <Hero 
              totalListings={listings.length} 
              onGoToSeller={() => setViewWithUrl('seller')}
            />
            <Marketplace 
              listings={listings} 
              onInstallFree={handleInstallFree} 
              onPurchaseClick={handlePurchaseClick} 
              onGoToMarketplace={() => setViewWithUrl('marketplace')}
            />
            <ProtocolSpec />
            <Footer onGoToSeller={() => setViewWithUrl('seller')} />
          </main>
        ) : view === 'marketplace' ? (
          <main>
            <DedicatedMarketplace 
              listings={listings} 
              onInstallFree={handleInstallFree} 
              onPurchaseClick={handlePurchaseClick} 
            />
            <Footer onGoToSeller={() => setViewWithUrl('seller')} />
          </main>
        ) : view === 'docs' ? (
          <main>
            <DocumentationView />
            <Footer onGoToSeller={() => setViewWithUrl('seller')} hideBanner={true} />
          </main>
        ) : (
          /* Standalone Seller Portal Page (No navbar, no top ticker, no footer) */
          <main style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
            <SellerPortal 
              user={user} 
              token={token} 
              sellerProfile={sellerProfile} 
              onAuthSuccess={handleAuthSuccess} 
              onListingPublished={fetchListings}
              showToast={showToast}
              onLogout={handleLogout}
              onGoToLanding={() => setViewWithUrl('landing')}
            />
          </main>
        )
      ) : (
        <main>
          <AgentTerminal 
            listings={listings}
            agentId={agentId}
            setAgentId={setAgentId}
            showToast={showToast}
          />
          <Footer onGoToSeller={() => setViewWithUrl('seller')} />
        </main>
      )}

      {/* Prava Payment Modal */}
      <PravaModal 
        info={modalInfo} 
        onClose={() => setModalInfo(null)} 
        showToast={showToast} 
      />

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
