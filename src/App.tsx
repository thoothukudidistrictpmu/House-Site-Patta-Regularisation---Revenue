/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserAccount } from './types.ts';
import { api } from './services/api.ts';
import { LoginPage } from './components/LoginPage.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar, ActiveNav } from './components/Sidebar.tsx';
import { TahsildarDashboard } from './components/TahsildarDashboard.tsx';
import { CollectorDashboard } from './components/CollectorDashboard.tsx';
import { BeneficiaryManagement } from './components/BeneficiaryManagement.tsx';
import { TalukWiseProgressView } from './components/TalukWiseProgressView.tsx';
import { UserManagementView } from './components/UserManagementView.tsx';
import { DataImportView } from './components/DataImportView.tsx';
import { BeneficiaryProfileModal } from './components/BeneficiaryProfileModal.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeNav, setActiveNav] = useState<ActiveNav>('dashboard');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Selected beneficiary for verification questionnaire modal
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);

  // Search input in header
  const [headerSearch, setHeaderSearch] = useState<string>('');

  // When Collector drills into a specific taluk from progress view
  const [collectorTalukFilter, setCollectorTalukFilter] = useState<string>('ALL');

  // Key to force refresh lists when a verification completes
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    api.checkSession()
      .then(res => {
        if (!isMounted) return;
        if (res.authenticated && res.user) {
          setCurrentUser(res.user);
        }
      })
      .catch(() => {
        // Not authenticated
      })
      .finally(() => {
        if (isMounted) setLoadingAuth(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleLogin = async (credentials: { username: string; password: string }) => {
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const res = await api.login(credentials);
      setCurrentUser(res.user);
      setActiveNav('dashboard');
      setCollectorTalukFilter('ALL');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setSelectedBeneficiaryId(null);
    setActiveNav('dashboard');
    setHeaderSearch('');
  };

  const handleOpenTahsildarModule = (category: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION') => {
    if (category === 'FREE_HOUSE_SITE') {
      setActiveNav('new-house-site');
    } else {
      setActiveNav('patta-reg');
    }
  };

  const handleCollectorDrillTaluk = (taluk: string, category?: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION') => {
    setCollectorTalukFilter(taluk);
    if (category === 'FREE_HOUSE_SITE') {
      setActiveNav('new-house-site');
    } else if (category === 'PATTA_REGULARISATION') {
      setActiveNav('patta-reg');
    } else {
      setActiveNav('new-house-site');
    }
  };

  const handleHeaderSearch = (query: string) => {
    setHeaderSearch(query);
    if (activeNav !== 'new-house-site' && activeNav !== 'patta-reg') {
      setActiveNav('new-house-site');
    }
  };

  // If not logged in, render the clean, confidential login page (no exposed accounts)
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isLoading={loadingAuth}
        error={authError}
      />
    );
  }

  const isDM = currentUser.role === 'District Admin' || currentUser.assigned_taluk === 'All Taluks';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased">
      
      {/* Top Header: Taluk Name | Tahsildar | Logout */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        activeSearchQuery={headerSearch}
        onSearchChange={handleHeaderSearch}
      />

      {/* Main Container: Left Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Minimal Sidebar */}
        <Sidebar
          currentUser={currentUser}
          activeNav={activeNav}
          onSelectNav={(nav) => {
            setActiveNav(nav);
            if (nav === 'taluk-progress' || nav === 'dashboard') {
              setCollectorTalukFilter('ALL');
            }
          }}
          onLogout={handleLogout}
        />

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-3.25rem)] bg-[#F8FAFC]">
          
          {/* Dashboard Tab */}
          {activeNav === 'dashboard' && (
            isDM ? (
              <CollectorDashboard
                onSelectTaluk={handleCollectorDrillTaluk}
              />
            ) : (
              <TahsildarDashboard
                currentUser={currentUser}
                onOpenModule={handleOpenTahsildarModule}
              />
            )
          )}

          {/* Module 1: New Free House Site Patta (Strictly Independent) */}
          {activeNav === 'new-house-site' && (
            <BeneficiaryManagement
              key={`fhs-${currentUser.user_id}-${collectorTalukFilter}-${refreshKey}`}
              currentUser={currentUser}
              category="FREE_HOUSE_SITE"
              talukFilter={collectorTalukFilter}
              searchQuery={headerSearch}
              onSelectBeneficiary={(id) => setSelectedBeneficiaryId(id)}
            />
          )}

          {/* Module 2: Patta Regularisation (Strictly Independent) */}
          {activeNav === 'patta-reg' && (
            <BeneficiaryManagement
              key={`reg-${currentUser.user_id}-${collectorTalukFilter}-${refreshKey}`}
              currentUser={currentUser}
              category="PATTA_REGULARISATION"
              talukFilter={collectorTalukFilter}
              searchQuery={headerSearch}
              onSelectBeneficiary={(id) => setSelectedBeneficiaryId(id)}
            />
          )}

          {/* Taluk-Wise Progress View (Collector only) */}
          {activeNav === 'taluk-progress' && isDM && (
            <TalukWiseProgressView
              onOpenTalukRegister={handleCollectorDrillTaluk}
            />
          )}

          {/* Data Import & Audit View (Collector only) */}
          {activeNav === 'data-import' && isDM && (
            <DataImportView
              currentUser={currentUser}
            />
          )}

          {/* User Management View (Collector only) */}
          {activeNav === 'user-mgmt' && isDM && (
            <UserManagementView
              currentUser={currentUser}
            />
          )}

        </main>

      </div>

      {/* Verification Questionnaire & Beneficiary Profile Modal */}
      {selectedBeneficiaryId && (
        <BeneficiaryProfileModal
          beneficiaryId={selectedBeneficiaryId}
          currentUser={currentUser}
          onClose={() => setSelectedBeneficiaryId(null)}
          onSaved={() => {
            setSelectedBeneficiaryId(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

    </div>
  );
}
