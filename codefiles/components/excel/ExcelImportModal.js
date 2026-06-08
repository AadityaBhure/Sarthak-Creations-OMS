'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ExcelImportModal({ isOpen, onClose, entityName, importEndpoint, onSuccess, columnMap, uniqueColumnDisplay }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

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
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Import {entityName} from Excel</h3>
            
        <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Upload an Excel (.xlsx, .xls) or CSV file. It must contain the following columns:
          <br/>
          <strong>{expectedHeaders.join(', ')}</strong>
        </div>

        {!result ? (
          <>
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
