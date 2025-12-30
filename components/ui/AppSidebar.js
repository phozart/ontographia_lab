// components/ui/AppSidebar.js
// Collapsible left sidebar for navigation - used across dashboard and diagram studio

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Logo, { LogoIcon } from './Logo';

// Icons
import HomeIcon from '@mui/icons-material/Home';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';

export default function AppSidebar({ onCreateWorkspace }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [recentSpaces, setRecentSpaces] = useState([]);

  const isAdmin = session?.user?.role === 'admin';

  // Load sidebar state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app-sidebar-expanded');
      if (saved !== null) {
        setIsExpanded(saved === 'true');
      }
    }
  }, []);

  // Load recent spaces
  useEffect(() => {
    if (session?.user?.status === 'active') {
      fetchRecentSpaces();
    }
  }, [session]);

  async function fetchRecentSpaces() {
    try {
      const res = await fetch('/api/diagrams?limit=5&sort=updated_at');
      if (res.ok) {
        const data = await res.json();
        setRecentSpaces(data.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to fetch recent spaces:', err);
    }
  }

  const toggleSidebar = () => {
    setIsExpanded(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('app-sidebar-expanded', String(next));
      }
      return next;
    });
  };

  const isActive = (path) => router.pathname === path;

  return (
    <aside className={`app-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Logo and toggle */}
      <div className="sidebar-header">
        {isExpanded ? (
          <>
            <Link href="/dashboard" className="sidebar-logo">
              <Logo size={32} showText={true} textColor="var(--text)" />
            </Link>
            <button className="sidebar-toggle" onClick={toggleSidebar} title="Collapse sidebar">
              <ChevronLeftIcon fontSize="small" />
            </button>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="sidebar-logo-collapsed" title="Ontographia Lab">
              <LogoIcon size={28} />
            </Link>
            <button className="sidebar-toggle" onClick={toggleSidebar} title="Expand sidebar">
              <ChevronRightIcon fontSize="small" />
            </button>
          </>
        )}
      </div>

      {/* Main navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <HomeIcon fontSize="small" />
            {isExpanded && <span>Home</span>}
          </Link>
        </div>

        {/* Quick create */}
        {onCreateWorkspace && (
          <div className="nav-section">
            <button className="nav-item create-btn" onClick={onCreateWorkspace}>
              <AddIcon fontSize="small" />
              {isExpanded && <span>New Workspace</span>}
            </button>
          </div>
        )}

        {/* Recent spaces */}
        {recentSpaces.length > 0 && (
          <div className="nav-section">
            {isExpanded && <div className="nav-section-title">Recent</div>}
            {recentSpaces.map(space => (
              <Link
                key={space.id}
                href={`/diagram/${space.short_id || space.id}`}
                className={`nav-item ${router.query.id === space.id || router.query.id === space.short_id ? 'active' : ''}`}
                title={space.name}
              >
                <FolderIcon fontSize="small" />
                {isExpanded && <span className="truncate">{space.name}</span>}
              </Link>
            ))}
          </div>
        )}

        {/* Admin section */}
        {isAdmin && (
          <div className="nav-section">
            {isExpanded && <div className="nav-section-title">Admin</div>}
            <Link href="/admin/users" className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}>
              <PeopleIcon fontSize="small" />
              {isExpanded && <span>Manage Users</span>}
            </Link>
            <Link href="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
              <AdminPanelSettingsIcon fontSize="small" />
              {isExpanded && <span>Admin Panel</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="sidebar-footer">
        <Link href="/account" className={`nav-item ${isActive('/account') ? 'active' : ''}`}>
          <AccountCircleIcon fontSize="small" />
          {isExpanded && <span>Account</span>}
        </Link>
        <Link href="/privacy" className={`nav-item ${isActive('/privacy') ? 'active' : ''}`}>
          <SecurityIcon fontSize="small" />
          {isExpanded && <span>Privacy</span>}
        </Link>
      </div>
    </aside>
  );
}
