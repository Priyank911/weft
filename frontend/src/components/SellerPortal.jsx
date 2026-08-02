import React, { useState, useEffect } from 'react';
import '../seller.css';
import {
  Mail, Lock, Phone, ArrowRight, Store, Plus, RefreshCw, DollarSign, Layers,
  Activity, CheckCircle2, Shield, Cpu, Upload, LogOut, Search, CreditCard,
  Zap, Copy, Check, FileText, Key, ChevronRight, BarChart2, ArrowLeft, File as FileIcon, X as XIcon
} from 'lucide-react';
import { apiRequest, API_BASE } from '../api';
import MetadataReviewModal from './MetadataReviewModal';

const ACCEPTED_EXTENSIONS = ['.zip', '.doc', '.docx', '.txt', '.md'];

async function uploadListingFile(listingId, file, token) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/listings/${listingId}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
  return data.data;
}

export default function SellerPortal({ user, token, sellerProfile, onAuthSuccess, onListingPublished, showToast, onLogout, onGoToLanding }) {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Seller listings & profile state
  const [sellerListings, setSellerListings] = useState([]);
  const [localSeller, setLocalSeller] = useState(sellerProfile || null);
  const [loadingListings, setLoadingListings] = useState(false);

  // Listing creation form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [listingType, setListingType] = useState('static');
  const [priceCents, setPriceCents] = useState(0);
  const [category, setCategory] = useState('Agent Skills');
  const [a2aUrl, setA2aUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Upload wizard state
  const [uploadFile, setUploadFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewMetadata, setReviewMetadata] = useState(null);
  const [reviewListingId, setReviewListingId] = useState(null);

  const sellerId = localSeller ? localSeller.id : (user ? user.id : 'seller-demo-id');

  // Fetch seller profile & listings on load
  const loadSellerData = async () => {
    if (!token || !user) return;
    setLoadingListings(true);
    try {
      let prof = localSeller;
      if (!prof) {
        try {
          prof = await apiRequest('/api/sellers/profile', 'POST', {
            business_name: user.email.split('@')[0],
            description: 'Weft Agentic Seller'
          }, token);
          setLocalSeller(prof);
          localStorage.setItem('weft_seller', JSON.stringify(prof));
        } catch {
          prof = { id: user.id, business_name: user.email.split('@')[0] };
          setLocalSeller(prof);
        }
      }

      if (prof && prof.id) {
        const res = await apiRequest(`/api/sellers/${prof.id}/listings`);
        setSellerListings(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      console.warn('Failed to load seller data:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    loadSellerData();
  }, [user, token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      let authData;
      if (authMode === 'register') {
        authData = await apiRequest('/api/auth/register', 'POST', { email, password, role: 'seller', phone });
        showToast('Seller account created successfully!', 'success');
      } else {
        authData = await apiRequest('/api/auth/login', 'POST', { email, password });
        showToast('Signed into Seller Portal successfully!', 'success');
      }

      if (authData && authData.token && authData.user) {
        let prof = null;
        try {
          prof = await apiRequest('/api/sellers/profile', 'POST', {
            business_name: authData.user.email.split('@')[0],
            description: 'Weft Agentic Seller'
          }, authData.token);
          setLocalSeller(prof);
          localStorage.setItem('weft_seller', JSON.stringify(prof));
        } catch {
          prof = { id: authData.user.id, business_name: authData.user.email.split('@')[0] };
          setLocalSeller(prof);
        }
        onAuthSuccess(authData.token, authData.user, prof);
      }
    } catch (err) {
      showToast(`Auth error: ${err.message}`, 'info');
    }
  };

  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setLongDescription('');
    setPriceCents(0);
    setA2aUrl('');
    setUploadFile(null);
    setActiveTab('overview');
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (listingType === 'static' && !uploadFile) {
      showToast('Attach a file (.zip, .doc, .docx, .txt, .md) before publishing a static listing.', 'info');
      return;
    }

    setPublishing(true);
    try {
      showToast('Creating draft listing...', 'info');
      const listing = await apiRequest('/api/listings', 'POST', {
        title,
        description,
        long_description: longDescription || description,
        category,
        listing_type: listingType,
        price_cents: parseInt(priceCents) || 0,
        a2a_endpoint_url: a2aUrl,
        seller_id: sellerId,
        capabilities: [],
        tags: []
      }, token);

      if (listingType === 'live') {
        // Live A2A listings have no file to analyze — publish directly.
        showToast('Publishing to NANDA Fact Index & FTS...', 'info');
        await apiRequest(`/api/listings/${listing.id}/publish`, 'POST', {}, token);
        showToast('Listing published successfully!', 'success');
        resetCreateForm();
        loadSellerData();
        if (onListingPublished) onListingPublished();
        return;
      }

      showToast('Uploading asset file...', 'info');
      await uploadListingFile(listing.id, uploadFile, token);

      showToast('Analyzing file contents with AI...', 'info');
      const metadata = await apiRequest(`/api/listings/${listing.id}/generate-metadata`, 'POST', {}, token);

      setReviewListingId(listing.id);
      setReviewMetadata(metadata);
    } catch (err) {
      showToast(`Publish error: ${err.message}`, 'info');
    } finally {
      setPublishing(false);
    }
  };

  const handleConfirmMetadata = async (confirmed) => {
    try {
      showToast('Saving confirmed metadata...', 'info');
      await apiRequest(`/api/listings/${reviewListingId}`, 'PUT', confirmed, token);

      showToast('Publishing to NANDA Fact Index & FTS...', 'info');
      await apiRequest(`/api/listings/${reviewListingId}/publish`, 'POST', {}, token);

      showToast('Listing published successfully!', 'success');
      setReviewMetadata(null);
      setReviewListingId(null);
      resetCreateForm();
      loadSellerData();
      if (onListingPublished) onListingPublished();
    } catch (err) {
      showToast(`Publish error: ${err.message}`, 'info');
    }
  };

  const handleCancelReview = () => {
    setReviewMetadata(null);
    setReviewListingId(null);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      showToast(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`, 'info');
      return;
    }
    setUploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(`weft_live_sk_${sellerId.slice(0, 12)}`);
    setCopiedKey(true);
    showToast('Seller API Key copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // If not logged in, render standalone Auth Login/Register form
  if (!token || !user) {
    return (
      <div className="seller-dashboard-wrapper" style={{ padding: '60px 24px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="seller-auth-card">
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'rgba(255, 77, 77, 0.12)', border: '1px solid rgba(255, 77, 77, 0.3)', color: 'var(--accent-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Store size={24} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>Seller Network Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Log in or register to access your dedicated seller portal dashboard.</p>
          </div>

          <div className="auth-tabs">
            <button 
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input 
                  type="email" 
                  className="form-input" 
                  required 
                  placeholder="seller@weft.protocol"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {authMode === 'register' && (
              <div className="form-group">
                <label>Phone Number (for Linq iMessage Receipts)</label>
                <div className="input-with-icon">
                  <Phone className="input-icon" size={18} />
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="+1 (555) 019-2831"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-brand btn-block btn-lg" style={{ marginTop: '24px' }}>
              {authMode === 'register' ? 'Register Seller Account' : 'Sign In to Dashboard'} <ArrowRight size={18} />
            </button>
          </form>

          {onGoToLanding && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button className="btn btn-ghost btn-sm" onClick={onGoToLanding}>
                <ArrowLeft size={14} /> Back to Weft Marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calculate total earnings strictly from DB
  const totalSalesCount = sellerListings.reduce((sum, item) => sum + (item.download_count || 0), 0);
  const totalRevenueUsd = (sellerListings.reduce((sum, item) => sum + ((item.price_cents || 0) * (item.download_count || 0)), 0) / 100).toFixed(2);

  return (
    <div className="seller-dashboard-wrapper">
      <div className="seller-app-frame">
        {/* Top Header Bar */}
        <div className="seller-top-header">
          <div className="seller-brand-area">
            {onGoToLanding && (
              <button onClick={onGoToLanding} className="btn btn-secondary btn-sm" title="Back to Marketplace" style={{ marginRight: '8px' }}>
                <ArrowLeft size={14} /> Marketplace
              </button>
            )}
            <img src="/logo.png" alt="Weft Logo" className="seller-brand-logo" />
            <div>
              <div className="seller-brand-name">WEFT.DASHBOARD</div>
              <div className="seller-route-badge">
                <span>seller-portal/id={sellerId.slice(0, 10)}</span>
              </div>
            </div>
          </div>

          <div className="seller-top-actions">
            <button className="btn btn-secondary btn-sm" onClick={loadSellerData} title="Refresh Dashboard">
              <RefreshCw size={14} className={loadingListings ? 'spin' : ''} /> Refresh
            </button>
            <button className="seller-logout-btn" onClick={onLogout} title="Sign Out">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="seller-grid-layout">
          {/* Left Sidebar Navigation */}
          <aside className="seller-sidebar">
            <div className="seller-profile-card">
              <div className="seller-avatar">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div className="seller-user-name">{user.email.split('@')[0]}</div>
                <div className="seller-user-email">{user.email}</div>
              </div>
            </div>

            <nav className="seller-menu-list">
              <button 
                className={`seller-menu-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Layers size={16} className="menu-icon" /> Dashboard Overview
              </button>
              <button 
                className={`seller-menu-item ${activeTab === 'publish' ? 'active' : ''}`}
                onClick={() => setActiveTab('publish')}
              >
                <Plus size={16} className="menu-icon" /> Publish New Primitive
              </button>
              <button 
                className={`seller-menu-item ${activeTab === 'my-assets' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-assets')}
              >
                <FileText size={16} className="menu-icon" /> My Published Assets ({sellerListings.length})
              </button>
              <button 
                className={`seller-menu-item ${activeTab === 'payouts' ? 'active' : ''}`}
                onClick={() => setActiveTab('payouts')}
              >
                <CreditCard size={16} className="menu-icon" /> Prava Payouts & API Keys
              </button>
            </nav>
          </aside>

          {/* Main Dashboard Area */}
          <main className="seller-main-body">
            {activeTab === 'overview' && (
              <>
                {/* Greeting & Header */}
                <div>
                  <h1 className="seller-welcome-title">
                    Hey {user.email.split('@')[0]}, Welcome back to Seller Portal
                  </h1>
                  <div className="seller-sub-greeting">
                    Managing live agent primitives, Prava settlement balances, and NANDA index facts.
                  </div>
                </div>

                {/* Financial Pills Row */}
                <div className="financial-pills-row">
                  <div className="fin-pill-card">
                    <div className="fin-pill-top">
                      <span className="fin-pill-lbl">AVAILABLE PAYOUT BALANCE</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-brand)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>PRAVA SANDBOX</span>
                    </div>
                    <div className="fin-pill-val">${totalRevenueUsd}</div>
                  </div>

                  <div className="fin-pill-card">
                    <div className="fin-pill-top">
                      <span className="fin-pill-lbl">TOTAL SALES & EXECUTIONS</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>REAL-TIME DB SYNC</span>
                    </div>
                    <div className="fin-pill-val">{totalSalesCount.toLocaleString()}</div>
                  </div>
                </div>

                {/* Protocol Mandate Nodes Row (Clean Professional Theme-Aligned) */}
                <div>
                  <div className="prava-cards-title-row">Active Protocol Mandates & Nodes</div>
                  <div className="prava-cards-grid">
                    {/* Prava Settlement Vault Card */}
                    <div className="virtual-prava-card red-glow">
                      <div className="vcard-top">
                        <span className="vcard-bank-name">PRAVA SETTLEMENT VAULT</span>
                        <Shield size={18} className="accent-text-brand" />
                      </div>
                      <div className="vcard-number">prava_mandate_#8829</div>
                      <div className="vcard-bottom">
                        <span>{user.email.split('@')[0].toUpperCase()}</span>
                        <span className="vcard-status-pill">SANDBOX ACTIVE</span>
                      </div>
                    </div>

                    {/* Weft Revenue Ledger Card */}
                    <div className="virtual-prava-card cyan-glow">
                      <div className="vcard-top">
                        <span className="vcard-bank-name">WEFT REVENUE LEDGER</span>
                        <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
                      </div>
                      <div className="vcard-number">weft_ledger_#4110</div>
                      <div className="vcard-bottom">
                        <span>{user.email.split('@')[0].toUpperCase()}</span>
                        <span className="vcard-status-pill cyan">AUTO-SETTLE</span>
                      </div>
                    </div>

                    {/* Linq SMS Receipt Node Card */}
                    {/* Linq SMS Receipt Node Card */}
                    <div className="virtual-prava-card emerald-glow" style={{ position: 'relative' }}>
                      <div className="vcard-top">
                        <span className="vcard-bank-name">LINQ RECEIPT DISPATCH</span>
                        <CheckCircle2 size={18} className="accent-text-green" />
                      </div>
                      <div className="vcard-number">linq_sms_#9012</div>
                      
                      {/* QR Code & SMS Activation Widget */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', margin: '10px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          📱 Scan QR to activate Seller iMessage Notifications
                        </div>
                        {(() => {
                          const linqPhone = '+12063268039';
                          const sId = sellerProfile?.id || user?.id || 'seller';
                          const timeId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
                          const smsBody = `Weft seller account activate ID:${sId} Session:${timeId}`;
                          const smstoPayload = `SMSTO:${linqPhone}:${smsBody}`;
                          const smsUri = `sms:${linqPhone}?body=${encodeURIComponent(smsBody)}`;
                          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(smstoPayload)}`;

                          return (
                            <>
                              <img 
                                src={qrCodeUrl} 
                                alt="Seller Linq Activation QR Code"
                                style={{ width: '130px', height: '130px', borderRadius: '8px', border: '2px solid var(--border-subtle)', margin: '0 auto 8px auto', display: 'block', background: '#ffffff', padding: '6px' }}
                              />
                              <a 
                                href={smsUri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', width: '100%', display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                              >
                                <Zap size={12} color="var(--accent-green)" /> Send Session Activation SMS
                              </a>
                            </>
                          );
                        })()}
                      </div>

                      <div className="vcard-bottom">
                        <span>{user.email.split('@')[0].toUpperCase()}</span>
                        <span className="vcard-status-pill green">ACTIVE & OPTED-IN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Published Primitives Table */}
                <div className="dashboard-table-card">
                  <div className="table-card-header">
                    <h3 className="table-card-title">My Published Agent Primitives</h3>
                    <button className="btn btn-brand btn-sm" onClick={() => setActiveTab('publish')}>
                      <Plus size={14} /> Publish New Asset
                    </button>
                  </div>

                  {sellerListings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      You haven't published any agent primitives yet. Click "Publish New Asset" to get started!
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="dashboard-data-table">
                        <thead>
                          <tr>
                            <th>Primitive Title</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Price</th>
                            <th>Installs</th>
                            <th>NANDA Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerListings.map(item => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</td>
                              <td><span className="card-category-tag">{item.category}</span></td>
                              <td>{item.listing_type === 'live' ? 'Live A2A' : 'Static Asset'}</td>
                              <td>{item.price_cents === 0 ? 'FREE' : `$${(item.price_cents / 100).toFixed(2)}`}</td>
                              <td>{item.download_count || 0}</td>
                              <td><span className="type-badge live"><CheckCircle2 size={11} /> Synced</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: PUBLISH NEW PRIMITIVE */}
            {activeTab === 'publish' && (
              <div className="dashboard-table-card">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>Publish New Agent Primitive</h2>
                <form onSubmit={handleCreateListing}>
                  <div className="form-group">
                    <label>Primitive Title</label>
                    <input 
                      type="text" 
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      required 
                      placeholder="e.g., Next.js Security Audit Playbook"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Brief Description</label>
                    <textarea 
                      className="form-textarea"
                      rows="2" 
                      required 
                      placeholder="Brief overview of what this primitive does..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="form-group">
                    <label>Detailed Markdown Specifications (long_description)</label>
                    <textarea 
                      className="form-textarea"
                      rows="4" 
                      placeholder="Detailed markdown specification, requirements, and usage guidelines..."
                      value={longDescription}
                      onChange={(e) => setLongDescription(e.target.value)}
                    ></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Category</label>
                      <select 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '14px' }}
                      >
                        <option value="Agent Skills">Agent Skills</option>
                        <option value="MCP Tools">MCP Tools</option>
                        <option value="MCP Resources">MCP Resources</option>
                        <option value="MCP Prompts">MCP Prompts</option>
                        <option value="Vision & ML Assets">Vision & ML Assets</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Listing Type</label>
                      <select 
                        value={listingType} 
                        onChange={(e) => setListingType(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '14px' }}
                      >
                        <option value="static">Static Package / SKILL.md</option>
                        <option value="live">Live A2A Microservice</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Price (USD Cents)</label>
                      <input 
                        type="number" 
                        className="form-input"
                        style={{ paddingLeft: '14px' }}
                        required 
                        placeholder="0 for Free, 1499 for $14.99"
                        value={priceCents}
                        onChange={(e) => setPriceCents(e.target.value)}
                      />
                    </div>
                  </div>

                  {listingType === 'live' && (
                    <div className="form-group">
                      <label>Live A2A Endpoint URL</label>
                      <input
                        type="url"
                        className="form-input"
                        style={{ paddingLeft: '14px' }}
                        placeholder="https://my-live-agent.ngrok.app/a2a"
                        value={a2aUrl}
                        onChange={(e) => setA2aUrl(e.target.value)}
                      />
                    </div>
                  )}

                  {listingType === 'static' && (
                    <div className="form-group">
                      <label>Asset File ({ACCEPTED_EXTENSIONS.join(', ')})</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('seller-file-input').click()}
                        style={{
                          border: `2px dashed ${isDragging ? 'var(--accent-brand)' : 'var(--border-strong)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '28px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: isDragging ? 'rgba(255, 77, 77, 0.06)' : 'var(--bg-input)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          id="seller-file-input"
                          type="file"
                          accept={ACCEPTED_EXTENSIONS.join(',')}
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(e.target.files[0])}
                        />
                        {uploadFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <FileIcon size={20} color="var(--accent-brand)" />
                            <span style={{ fontWeight: 600 }}>{uploadFile.name}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              ({(uploadFile.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                              <XIcon size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload size={24} style={{ marginBottom: '8px', color: 'var(--text-secondary)' }} />
                            <div style={{ fontWeight: 600 }}>Drag & drop your asset file here</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>or click to browse</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-brand btn-block btn-lg" style={{ marginTop: '18px' }} disabled={publishing}>
                    {publishing ? 'Working...' : <>Publish to NANDA Index & Marketplace <ArrowRight size={18} /></>}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: MY ASSETS */}
            {activeTab === 'my-assets' && (
              <div className="dashboard-table-card">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>Published Primitive Assets</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="dashboard-data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>NANDA Agent ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerListings.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{item.id.slice(0, 8)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</td>
                          <td><span className="card-category-tag">{item.category}</span></td>
                          <td>{item.price_cents === 0 ? 'FREE' : `$${(item.price_cents / 100).toFixed(2)}`}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-brand)' }}>
                            {item.nanda_agent_id || 'nanda_ag_8829'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: PAYOUTS & KEYS */}
            {activeTab === 'payouts' && (
              <div className="dashboard-table-card">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>Prava Settlement & API Keys</h2>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Seller Stdio API Key</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '14px', fontFamily: 'var(--font-mono)', flex: 1 }}
                      readOnly 
                      value={`weft_live_sk_${sellerId.slice(0, 12)}`}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={copyApiKey}>
                      {copiedKey ? <Check size={14} className="accent-text-brand" /> : <Copy size={14} />}
                      {copiedKey ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>
                </div>

                <div className="fin-pill-card" style={{ background: 'var(--bg-input)' }}>
                  <div className="fin-pill-top">
                    <span className="fin-pill-lbl">PRAVA AUTOMATED PAYOUT GATEWAY</span>
                    <span className="type-badge live"><CheckCircle2 size={12} /> Auto-Settlement Active</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                    Earnings are automatically settled into your linked Prava merchant account upon every successful purchase or rental mandate.
                  </p>
                  <button className="btn btn-brand btn-sm" onClick={() => showToast('Payout batch of $' + totalRevenueUsd + ' dispatched via Prava!', 'success')}>
                    Request Immediate Batch Payout (${totalRevenueUsd})
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {reviewMetadata && (
        <MetadataReviewModal
          metadata={reviewMetadata}
          onConfirm={handleConfirmMetadata}
          onCancel={handleCancelReview}
        />
      )}
    </div>
  );
}
