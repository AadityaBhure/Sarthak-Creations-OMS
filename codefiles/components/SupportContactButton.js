'use client';

import { useRef, useState } from 'react';
import { email, emailLink, whatsappLink } from '@/lib/support-contact';
import styles from './SupportContactButton.module.css';

export default function SupportContactButton() {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [preview, setPreview] = useState(false);

  function open() {
    setPreview(false);
    dialog.current.showModal();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.anchor} onMouseEnter={() => { if (!dialog.current?.open) setPreview(true); }} onMouseLeave={() => setPreview(false)}>
        <button ref={trigger} type="button" className={styles.pill} aria-haspopup="dialog" aria-controls="login-support-dialog" aria-describedby={preview ? 'support-preview' : undefined} onClick={open} onFocus={() => setPreview(true)} onBlur={() => setPreview(false)} onKeyDown={event => { if (event.key === 'Escape') setPreview(false); }}>
          Contact Support
        </button>
        {preview && <div id="support-preview" role="tooltip" className={styles.preview}>
          <strong>Aaditya Bhure</strong>
          <span className={styles.role}>Software Developer</span>
          <span>+91 7758031767 · Phone &amp; WhatsApp</span>
          <span>{email}</span>
          <span>LinkedIn: Aaditya Bhure</span>
          <small>Click Contact Support for contact links.</small>
        </div>}
      </div>

      <dialog ref={dialog} id="login-support-dialog" className={styles.dialog} aria-labelledby="login-support-title" onClose={() => { trigger.current?.focus(); setPreview(false); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close(); } }}>
        <div className={styles.heading}>
          <h2 id="login-support-title">Contact Support</h2>
          <button type="button" className={styles.close} aria-label="Close support dialog" onClick={() => dialog.current.close()} autoFocus>×</button>
        </div>
        <h3>Aaditya Bhure</h3>
        <p className={styles.role}>Software Developer</p>
        <p className={styles.muted}>Need help signing in, registering or using the application?</p>
        <dl className={styles.details}>
          <div><dt>Phone</dt><dd><a href="tel:+917758031767">+91 7758031767</a></dd></div>
          <div><dt>Email</dt><dd><a href={emailLink} target="_blank" rel="noopener noreferrer">{email}</a></dd></div>
          <div><dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/in/aaditya-bhure-275742284/" target="_blank" rel="noopener noreferrer">View Aaditya’s profile ↗</a></dd></div>
        </dl>
        <div className={styles.actions}>
          <a className="btn btn-primary" href={whatsappLink} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
          <a className="btn btn-secondary" href={emailLink} target="_blank" rel="noopener noreferrer">Email Support ↗</a>
          <a className="btn btn-secondary" href="tel:+917758031767">Call Support</a>
        </div>
        <p className={styles.note}>WhatsApp and Gmail open in a new tab with a draft message. You may need to sign in to Gmail. Nothing is sent automatically.</p>
        <p className={styles.note}>Include the page name, any order or job card number, and what went wrong. A screenshot can help. Never share passwords or login codes.</p>
      </dialog>
    </div>
  );
}
