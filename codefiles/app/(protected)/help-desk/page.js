'use client';

export default function HelpDeskPage() {
  return (
    <div className="masters-page">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>System Help Desk & Documentation</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '800px', lineHeight: '1.5' }}>
          This Order Management System (OMS) is built with strict internal fail-safes. These rules run automatically in the background to ensure data is never accidentally deleted, duplicated, or overwritten. Below is a layperson's guide to how these protections work.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px' }}>
        
        {/* Section 1: Data Deletion & Recycle Bin */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            1. Data Deletion & Recycle Bin
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Soft Deletions</strong></td>
                <td>
                  When you delete an Order, Client, or Product, it is <strong>never</strong> deleted immediately. Instead, it is safely moved to the <span style={{ fontWeight: '600' }}>Recycle Bin</span>. You can restore it at any time within 10 days.
                </td>
              </tr>
              <tr>
                <td><strong>Active Link Protection</strong></td>
                <td>
                  The system will physically block you from deleting a Client or Product if it is currently tied to any existing Order. You will receive an error. You must delete or reassign the associated orders first before the Client/Product can be deleted.
                </td>
              </tr>
              <tr>
                <td><strong>Partial Bulk Deletions</strong></td>
                <td>
                  If you select 50 Clients and click "Delete", but 5 of them are tied to Active Orders, the system will not crash or fail. It will safely delete the 45 unlinked Clients and skip the 5 linked ones, alerting you of the partial success.
                </td>
              </tr>
              <tr>
                <td><strong>Auto-Purging</strong></td>
                <td>
                  Records sitting in the Recycle Bin for more than 10 days are permanently and automatically purged by the database to save space.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 2: Restoring Records */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            2. Restoring Records from the Recycle Bin
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Missing Master Protection</strong></td>
                <td>
                  You cannot restore a deleted Order if the Client or Product it belonged to is still sitting in the Recycle Bin. The system will prompt you to restore the underlying Client or Product first before the Order can be restored.
                </td>
              </tr>
              <tr>
                <td><strong>Name Collision (Duplicates)</strong></td>
                <td>
                  If you delete a Client named "ABC Corp", then create a new Client named "ABC Corp", the system will not let you restore the original deleted one. You will receive a warning that an active record with that name already exists.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 3: Bulk Uploads (CSV Import) */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            3. Bulk Uploads (Excel/CSV Import)
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Background Batching</strong></td>
                <td>
                  If you upload a massive CSV file (e.g., 5,000 clients), the backend server automatically chops the file into safe chunks of 200 records at a time. This guarantees that large imports will never timeout, freeze, or crash the browser.
                </td>
              </tr>
              <tr>
                <td><strong>Strict Duplicate Prevention</strong></td>
                <td>
                  During an import, the database checks every single row against existing active records. If an exact match (e.g., duplicate Client Name) is found, the system skips it. It will absolutely not create duplicates.
                </td>
              </tr>
              <tr>
                <td><strong>Interactive Summary & Rejection Reasons</strong></td>
                <td>
                  After an import finishes, you receive a detailed summary of Exactly how many rows were <strong>Accepted</strong> and <strong>Rejected</strong>. You can click on the Rejected tab to see a detailed table outlining exactly which rows failed and a specific <strong>Rejection Reason</strong> (e.g., "Duplicate entry", "Missing Required Name") so you know exactly how to fix your spreadsheet.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 4: Data Formatting & UI Rules */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            4. Data Formatting & UI Rules
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Global Date Formatting</strong></td>
                <td>
                  Regardless of what web browser or operating system you use, all dates across the entire application (Tables, PDF exports, Logs) are strictly forced into the standard <strong>DD/MM/YYYY</strong> format.
                </td>
              </tr>
              <tr>
                <td><strong>Indian Number Formatting</strong></td>
                <td>
                  Whenever you type a numeric quantity, the system automatically formats it in real-time using the Indian numbering system (e.g., <code>1,00,000</code>). Non-numeric text is silently stripped to prevent errors, keeping your data perfectly clean.
                </td>
              </tr>
              <tr>
                <td><strong>Adaptive Table Density</strong></td>
                <td>
                  In your Settings, you can switch between <strong>Comfortable</strong> (spacious rows) and <strong>Compact</strong> (highly packed rows). This lets you see more data on smaller laptop screens without needing to zoom out.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 5: Real-time Syncing & Safety */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            5. Live Data & Multi-User Safety
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Manual Refresh Banners</strong></td>
                <td>
                  When multiple employees use the system simultaneously, data updates happen instantly in the database. If someone else edits an Order you are currently looking at, a banner will appear at the top of your screen alerting you that the data is stale. You can click to refresh your view safely without your screen shifting unexpectedly while you are working.
                </td>
              </tr>
              <tr>
                <td><strong>Mass Bulk Action Caps</strong></td>
                <td>
                  To prevent the system from getting overloaded or running out of memory during a single action, bulk operations (like restoring or deleting) are capped at 200 records per click. If you select 250 records, the action buttons will cleanly disable themselves until you deselect some.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 6: System Auditing & Activity Logs */}
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            6. System Auditing & Activity Logs
          </h3>
          <table className="data-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Rule</th>
                <th style={{ width: '75%' }}>How it Works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Comprehensive Tracking</strong></td>
                <td>
                  The system silently logs every Create, Update, Delete, and Restore action across all modules. It tracks exactly who made the change, when it happened, and what specific fields were modified.
                </td>
              </tr>
              <tr>
                <td><strong>Old vs. New Comparison</strong></td>
                <td>
                  When a record is edited, the system doesn't just say "Record Updated". It compares the old data with the new data and generates a human-readable sentence (e.g., <em>"changed Status from 'Design Confirmed' to 'In Progress'"</em>), guaranteeing complete transparency for audits.
                </td>
              </tr>
              <tr>
                <td><strong>Assignment History</strong></td>
                <td>
                  When an order's Assigned Executive is changed, the system automatically injects a permanent historical stamp into the Remarks field (e.g., <code>[Assignment: John -&gt; Jane]</code>) so anyone looking at the order instantly knows its routing history.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}
