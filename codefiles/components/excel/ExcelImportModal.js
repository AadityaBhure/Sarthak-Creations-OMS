'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ExcelImportModal({ isOpen, onClose, entityName, importEndpoint, onSuccess, columnMap, uniqueColumnDisplay }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeView, setActiveView] = useState('summary'); // 'summary', 'inserted', 'skipped'
  const [confirmationRequest, setConfirmationRequest] = useState(null);

  if (!isOpen) return null;

  const expectedHeaders = Object.keys(columnMap);

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const results = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // read as array of arrays

        if (!results || results.length < 2) {
          setError('Error parsing Excel file. Please ensure it has a header row and data.');
          return;
        }

        const rawHeaders = results[0];
        const dataRows = results.slice(1).filter(row => row.length > 0);

        // Validate headers loosely (case-insensitive)
        const missingCols = expectedHeaders.filter(col => 
          !rawHeaders.some(h => String(h).toLowerCase() === col.toLowerCase())
        );

        if (missingCols.length > 0) {
          setError(`Missing required columns: ${missingCols.join(', ')}`);
          return;
        }

        // Convert array rows to object rows based on headers
        const jsonRows = dataRows.map(rowArray => {
          const rowObj = {};
          rawHeaders.forEach((h, i) => {
            rowObj[h] = rowArray[i];
          });
          return rowObj;
        });

        // Map data consistently to DB keys
        const mappedData = jsonRows.map(row => {
          const newRow = {};
          expectedHeaders.forEach(csvCol => {
            const matchedKey = Object.keys(row).find(k => String(k).toLowerCase() === csvCol.toLowerCase());
            const dbCol = columnMap[csvCol];
            newRow[dbCol] = matchedKey ? String(row[matchedKey] || '') : '';
          });
          return newRow;
        });

        // Add displayData just for the preview table
        const displayData = jsonRows.map(row => {
          const newRow = {};
          expectedHeaders.forEach(csvCol => {
            const matchedKey = Object.keys(row).find(k => String(k).toLowerCase() === csvCol.toLowerCase());
            newRow[csvCol] = matchedKey ? String(row[matchedKey] || '') : '';
          });
          return newRow;
        });

        setPreviewData({ mapped: mappedData, display: displayData });
        setError('');
      } catch (err) {
        setError('Error reading Excel file. Ensure it is a valid .xlsx or .csv format.');
      }
    };
    reader.readAsBinaryString(file);
  }



  async function handleImport(force = false) {
    if (!previewData) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(importEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewData.mapped, force })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import records');
      }

      if (data.requiresConfirmation) {
        setConfirmationRequest(data);
        return;
      }

      setConfirmationRequest(null);
      setResult(data);
      setActiveView('summary');
      if (data.inserted > 0) {
        onSuccess(); // Trigger parent reload
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreviewData(null);
    setError('');
    setResult(null);
    setActiveView('summary');
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Import {entityName} from Excel</h3>
            
        {!result ? (
          confirmationRequest ? (
            <div style={{ padding: '16px', border: '1px solid var(--error)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <h4 style={{ margin: 0, color: 'var(--error)' }}>Missing Clients Detected</h4>
              </div>
              <p style={{ fontSize: '14px', marginBottom: '16px' }}>
                {confirmationRequest.message}
              </p>
              <p style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Do you want to skip these records and import the valid ones?
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmationRequest(null)} disabled={loading}>
                  No, Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleImport(true)} 
                  disabled={loading}
                >
                  {loading ? 'Importing...' : 'Yes, Import Valid Records'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Upload an Excel (.xlsx, .xls) or CSV file. It must contain the following columns:
                <br/>
                <strong>{expectedHeaders.join(', ')}</strong>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileChange}
                  className="form-input"
                  style={{ padding: '8px' }}
                />
              </div>

              {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

              {previewData && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>
                    Preview ({previewData.display.length} rows found)
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          {expectedHeaders.map(c => <th key={c} style={{ padding: '6px 12px' }}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.display.slice(0, 50).map((row, i) => (
                          <tr key={i}>
                            {expectedHeaders.map(c => <td key={c} style={{ padding: '6px 12px' }}>{row[c]}</td>)}
                          </tr>
                        ))}
                        {previewData.display.length > 50 && (
                          <tr>
                            <td colSpan={expectedHeaders.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              ... and {previewData.display.length - 50} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={reset} disabled={loading}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleImport(false)} 
                  disabled={loading || !previewData}
                >
                  {loading ? 'Importing...' : 'Import Valid Records'}
                </button>
              </div>
            </>
          )
        ) : (
          <>
            {/* Success Results View */}
            {activeView === 'summary' && (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                  {result.inserted > 0 ? '✅' : '⚠️'}
                </div>
                <h4 style={{ fontSize: '18px', marginBottom: '12px' }}>Import Complete</h4>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div 
                    onClick={() => { if (result.insertedRows?.length) setActiveView('inserted') }}
                    style={{ 
                      padding: '12px', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      cursor: result.insertedRows?.length ? 'pointer' : 'default',
                      backgroundColor: 'var(--bg-secondary)',
                      flex: 1
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>{result.inserted}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Accepted Records</div>
                    {result.insertedRows?.length > 0 && <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>Click to view</div>}
                  </div>
                  
                  <div 
                    onClick={() => { if (result.skippedRows?.length) setActiveView('skipped') }}
                    style={{ 
                      padding: '12px', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      cursor: result.skippedRows?.length ? 'pointer' : 'default',
                      backgroundColor: 'var(--bg-secondary)',
                      flex: 1
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--error)' }}>{result.skipped}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Skipped/Rejected</div>
                    {result.skippedRows?.length > 0 && <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>Click to view</div>}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={reset}>
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Detailed Views */}
            {activeView !== 'summary' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>
                    {activeView === 'inserted' ? 'Accepted Records' : 'Skipped/Rejected Records'}
                  </h4>
                  <button className="btn btn-secondary" onClick={() => setActiveView('summary')} style={{ padding: '4px 8px', fontSize: '12px' }}>
                    &larr; Back to Summary
                  </button>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        {expectedHeaders.map(c => <th key={c} style={{ padding: '6px 12px' }}>{c}</th>)}
                        {activeView === 'skipped' && (
                          <th style={{ padding: '6px 12px', color: 'var(--error)' }}>Rejection Reason</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(activeView === 'inserted' ? result.insertedRows : result.skippedRows)?.map((row, i) => (
                        <tr key={i}>
                          {/* Map DB columns back to CSV header keys for display if needed, or just display raw values. 
                              For API routes returning standard mapped objects, we can just grab values dynamically. */}
                          {expectedHeaders.map(csvCol => {
                            const dbCol = columnMap[csvCol];
                            // If row has dbCol, use it. If not, try csvCol (in case the API returns raw keys).
                            const val = row[dbCol] !== undefined ? row[dbCol] : row[csvCol];
                            return <td key={csvCol} style={{ padding: '6px 12px' }}>{String(val || '')}</td>;
                          })}
                          {activeView === 'skipped' && (
                            <td style={{ padding: '6px 12px', color: 'var(--error)', fontWeight: 'bold' }}>
                              {row.reason || 'Unknown reason'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
