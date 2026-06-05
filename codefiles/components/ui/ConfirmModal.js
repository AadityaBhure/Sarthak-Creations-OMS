'use client';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Confirm', confirmColor = 'danger', onConfirm, onCancel }) {
  if (!isOpen) return null;

  const btnClass = confirmColor === 'danger' ? 'btn btn-primary' : 'btn btn-primary'; 
  // We can add a red button class later if needed, but for now we'll stick to primary or add an inline style for danger.

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ minWidth: '100px', padding: '8px 16px' }}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onConfirm} 
            style={{ 
              minWidth: '100px', 
              padding: '8px 16px',
              backgroundColor: confirmColor === 'danger' ? 'var(--status-red-bg)' : undefined,
              color: confirmColor === 'danger' ? 'var(--status-red-text)' : undefined,
              borderColor: confirmColor === 'danger' ? 'var(--status-red-bg)' : undefined
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
