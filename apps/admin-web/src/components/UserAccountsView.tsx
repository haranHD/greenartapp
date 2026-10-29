import { useState, useEffect } from 'react';
import { api, AdminUserRecord } from '../services/api';

export const UserAccountsView: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers(searchQuery);
      setUsers(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch registered application users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role.toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter !== 'all' && u.accountStatus.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.accountStatus === 'Active').length;
  const verifiedUsers = users.filter((u) => u.isEmailVerified).length;
  const passwordUsers = users.filter((u) => u.hasPassword).length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
            Application User Accounts
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px', margin: 0 }}>
            Verified customer profiles, authentication providers, and account status across mobile and web platforms.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            backgroundColor: '#240046',
            color: '#FFFFFF',
            border: '1px solid #D4AF37',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {loading ? 'Refreshing...' : '↻ Refresh Users'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Users</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#240046', marginTop: '4px' }}>{totalUsers}</div>
          <div style={{ fontSize: '11px', color: '#10B981', marginTop: '4px' }}>Registered in database</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Active Accounts</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>{activeUsers}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>In good standing</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Verified Emails (OTP)</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>{verifiedUsers}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Identity validated</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Password Configured</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>{passwordUsers}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>PBKDF2 encrypted</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: '#240046',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
            }}
          >
            <option value="all">All Roles</option>
            <option value="Customer">Customer</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Administrator">Administrator</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px', marginBottom: '20px', color: '#B91C1C', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Users Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>User Profile</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Role</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Auth Methods</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Email Verified</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Registered</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                  Loading user directory from Greenart backend...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>No users found</div>
                  <div style={{ fontSize: '13px' }}>No application accounts match your current search or filter criteria.</div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const initials = user.fullName
                  ? user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'U';

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {/* User Profile (Avatar, Name, Email, Phone) */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '18px',
                            backgroundColor: '#240046',
                            color: '#D4AF37',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '12px',
                            border: '1.5px solid #D4AF37',
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{user.fullName}</div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>{user.email}</div>
                          {user.phoneNumber && (
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>📞 {user.phoneNumber}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            user.role === 'Administrator' ? '#FEF2F2' : user.role === 'Reviewer' ? '#FEFCE8' : '#FAF5FF',
                          color:
                            user.role === 'Administrator' ? '#B91C1C' : user.role === 'Reviewer' ? '#B45309' : '#581C87',
                          border: `1px solid ${user.role === 'Administrator' ? '#FECACA' : user.role === 'Reviewer' ? '#FDE68A' : '#E9D5FF'
                            }`,
                        }}
                      >
                        {user.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: user.accountStatus === 'Active' ? '#047857' : '#B91C1C',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '4px',
                            backgroundColor: user.accountStatus === 'Active' ? '#10B981' : '#EF4444',
                          }}
                        />
                        {user.accountStatus}
                      </span>
                    </td>

                    {/* Auth Methods */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {user.hasGoogleAuth && (
                          <span style={{ fontSize: '11px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Google
                          </span>
                        )}
                        {user.hasPassword && (
                          <span style={{ fontSize: '11px', backgroundColor: '#F5F3FF', color: '#6D28D9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Password
                          </span>
                        )}
                        {!user.hasGoogleAuth && !user.hasPassword && (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>OTP Pending</span>
                        )}
                      </div>
                    </td>

                    {/* Email Verified */}
                    <td style={{ padding: '14px 18px' }}>
                      {user.isEmailVerified ? (
                        <span style={{ color: '#047857', fontWeight: 700, fontSize: '12px' }}>✓ Verified</span>
                      ) : (
                        <span style={{ color: '#D97706', fontSize: '12px' }}>⏳ Unverified</span>
                      )}
                    </td>

                    {/* Registered Date */}
                    <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>
                      {new Date(user.createdAtUtc).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Last Login */}
                    <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>
                      {user.lastLoginAtUtc
                        ? new Date(user.lastLoginAtUtc).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : 'Never'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
