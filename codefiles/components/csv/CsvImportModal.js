'use client';

import { useState } from 'react';
import Papa from 'papaparse';

export default function CsvImportModal({ isOpen, onClose, entityName, importEndpoint, onSuccess, columnMap, uniqueColumnDisplay }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const expectedCsvHeaders = Object.keys(columnMap);

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }

  function parseFile(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors.length > 0) {
          setError('Error parsing CSV file. Please ensure it has a header row.');
          return;
        }

        // Validate headers loosely (case-insensitive)
        const headers = results.meta.fields;
        const missingCols = expectedCsvHeaders.filter(col => 
          !headers.some(h => h.toLowerCase() === col.toLowerCase())
        );

        if (missingCols.length > 0) {
          setError(`Missing required columns: ${missingCols.join(', ')}`);
          return;
        }

        // Map data consistently to DB keys
        const mappedData = results.data.map(row => {
          const newRow = {};
          expectedCsvHeaders.forEach(csvCol => {
            const matchedKey = Object.keys(row).find(k => k.toLowerCase() === csvCol.toLowerCase());
            const dbCol = columnMap[csvCol];
            newRow[dbCol] = matchedKey ? row[matchedKey] : '';
          });
          return newRow;
        });

        // Add displayData just for the preview table (using expected CSV headers)
        const displayData = results.data.map(row => {
          const newRow = {};
          expectedCsvHeaders.forEach(csvCol => {
            const matchedKey = Object.keys(row).find(k => k.toLowerCase() === csvCol.toLowerCase());
            newRow[csvCol] = matchedKey ? row[matchedKey] : '';
          });
          return newRow;
        });

        setPreviewData({ mapped: mappedData, display: displayData });
        setError('');
      }
    });
  }

  async function handleImport() {
    if (!previewData) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(importEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewData.mapped })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import records');
      }

      setResult(data);
      if (data.inserted > 0) {
        onSuccess();
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
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Import {entityName}
        </h3>

        {!result ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
              Upload a .csv file. The first row must be headers (e.g. {expectedCsvHeaders.map(c => `"${c}"`).join(', ')}). 
              Duplicate "{uniqueColumnDisplay}"s will be automatically skipped.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <input 
                type="file" 
                accept=".csv" 
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
                        {expectedCsvHeaders.map(c => <th key={c} style={{ padding: '6px 12px' }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.display.slice(0, 50).map((row, i) => (
                        <tr key={i}>
                          {expectedCsvHeaders.map(c => <td key={c} style={{ padding: '6px 12px' }}>{row[c]}</td>)}
                        </tr>
                      ))}
                      {previewData.display.length > 50 && (
                        <tr>
                          <td colSpan={expectedCsvHeaders.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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
                onClick={handleImport} 
                disabled={loading || !previewData}
              >
                {loading ? 'Importing...' : 'Import Valid Records'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Success Results View */}
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {result.inserted > 0 ? '✅' : '⚠️'}
              </div>
              <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Import Complete</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <strong>{result.inserted}</strong> records imported successfully.
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                <strong>{result.skipped}</strong> records skipped (duplicates or empty).
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={reset}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
