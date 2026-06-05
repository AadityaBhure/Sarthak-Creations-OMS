export default function AlertModal({ isOpen, title, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <h3 className="modal-title" style={{ marginTop: 0, fontSize: '18px', fontWeight: '600' }}>
          {title || 'Alert'}
        </h3>
        <p className="modal-message" style={{ margin: '16px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {message}
        </p>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
