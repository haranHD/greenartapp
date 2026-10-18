export const App = () => {
  return (
    <div className="admin-layout">
      <header className="admin-header">
        <h1>Greenart Properties</h1>
        <p className="subtitle">Land Market Rate Analyst — Administration & Data Quality</p>
      </header>

      <main className="admin-main">
        <div className="card">
          <h2>Administrative Dashboard Overview</h2>
          <p>
            Welcome to the internal data curation and verification portal for <strong>greenart.group</strong>.
          </p>
          <div className="status-grid">
            <div className="status-pill status-ready">
              <span className="dot"></span> Architecture: Ready
            </div>
            <div className="status-pill status-pending">
              <span className="dot"></span> Domain & Prod: Pending Approval
            </div>
            <div className="status-pill status-isolated">
              <span className="dot"></span> Database: Isolated via Backend API
            </div>
          </div>
        </div>

        <section className="features-preview">
          <div className="card feature-card">
            <h3>📍 Spatial Record Management</h3>
            <p>Inspect, filter, and audit land price records across Coimbatore pilot localities.</p>
          </div>
          <div className="card feature-card">
            <h3>📑 Data Ingestion & Validation</h3>
            <p>Upload CSV/Excel spreadsheets with row-level error reporting and duplicate checks.</p>
          </div>
          <div className="card feature-card">
            <h3>🛡️ Verification Workflow</h3>
            <p>Review unverified research notes and assign verified status to official transactions.</p>
          </div>
        </section>
      </main>

      <footer className="admin-footer">
        <p>Greenart Properties &copy; 2026. Internal Administrative Console.</p>
      </footer>
    </div>
  );
};

export default App;

