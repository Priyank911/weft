import React, { useState } from 'react';
import { apiRequest } from '../api';

export default function SellerPortal({ user, token, sellerProfile, onAuthSuccess, onListingPublished, showToast }) {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Listing state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState('static');
  const [priceCents, setPriceCents] = useState(0);
  const [category, setCategory] = useState('dev-tools');
  const [a2aUrl, setA2aUrl] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      let authData;
      if (authMode === 'register') {
        authData = await apiRequest('/api/auth/register', 'POST', { email, password, role: 'seller', phone });
        showToast('Account created successfully!', 'success');
      } else {
        authData = await apiRequest('/api/auth/login', 'POST', { email, password });
        showToast('Logged in successfully!', 'success');
      }

      onAuthSuccess(authData.token, authData.user);

      // Create seller profile if needed
      try {
        const profile = await apiRequest('/api/sellers/profile', 'POST', { business_name: email.split('@')[0], description: 'Weft Seller' }, authData.token);
        localStorage.setItem('weft_seller', JSON.stringify(profile));
      } catch { /* already exists */ }

    } catch (err) {
      showToast(`Auth error: ${err.message}`, 'info');
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      showToast('Creating draft listing...', 'info');
      const sellerId = sellerProfile ? sellerProfile.id : user.id;

      const listing = await apiRequest('/api/listings', 'POST', {
        title, description, listing_type: listingType, price_cents: parseInt(priceCents) || 0, category, a2a_endpoint_url: a2aUrl, seller_id: sellerId
      }, token);

      showToast('Publishing to NANDA Fact Index & FTS...', 'info');
      await apiRequest(`/api/listings/${listing.id}/publish`, 'POST', {}, token);

      showToast('Listing published successfully!', 'success');
      setTitle('');
      setDescription('');
      setPriceCents(0);
      setA2aUrl('');

      onListingPublished();
    } catch (err) {
      showToast(`Publish error: ${err.message}`, 'info');
    }
  };

  return (
    <section id="seller-portal" className="section-container">
      <div className="section-header">
        <div className="header-tag">SELLER NETWORK</div>
        <h2 className="section-title">Monetize Your Tools & Live Agents</h2>
        <p className="section-desc">Publish code packages, prompt skills, or live A2A microservices to the global agent economy.</p>
      </div>

      <div className="seller-wrapper">
        {!token || !user ? (
          <div className="seller-auth-box">
            <h3 style={{ marginBottom: '8px' }}>Seller Registration & Login</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Create your seller account to list static tools and live A2A services.</p>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button 
                className={`btn btn-secondary ${authMode === 'login' ? 'active' : ''}`} 
                onClick={() => setAuthMode('login')}
                style={{ flex: 1 }}
              >
                Login
              </button>
              <button 
                className={`btn btn-secondary ${authMode === 'register' ? 'active' : ''}`} 
                onClick={() => setAuthMode('register')}
                style={{ flex: 1 }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  required 
                  placeholder="seller@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {authMode === 'register' && (
                <div className="form-group">
                  <label>Phone Number (for Linq Receipts)</label>
                  <input 
                    type="tel" 
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-block">
                {authMode === 'register' ? 'Create Seller Account →' : 'Sign In →'}
              </button>
            </form>
          </div>
        ) : (
          <div className="seller-dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3>Seller Portal</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Logged in as: <strong>{user.email}</strong></p>
              </div>
              <button onClick={onListingPublished} className="btn btn-secondary btn-sm">🔄 Refresh Listings</button>
            </div>

            <div style={{ background: 'var(--bg-dark)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ marginBottom: '16px' }}>Create New Listing</h4>

              <form onSubmit={handleCreateListing}>
                <div className="form-group">
                  <label>Listing Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Security Vulnerability Scanner Agent"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    rows="3" 
                    required 
                    placeholder="Describe what your tool or live agent does..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Listing Type</label>
                    <select value={listingType} onChange={(e) => setListingType(e.target.value)}>
                      <option value="static">Static Asset / Package</option>
                      <option value="live">Live A2A Agent (Microservice)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Price (USD Cents)</label>
                    <input 
                      type="number" 
                      required 
                      placeholder="0 for Free, 999 for $9.99"
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
                      placeholder="https://my-live-agent.ngrok.app/a2a"
                      value={a2aUrl}
                      onChange={(e) => setA2aUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Category</label>
                  <input 
                    type="text" 
                    placeholder="dev-tools, security, analytics, helper"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block">Publish Listing &rarr;</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
