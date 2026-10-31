import Link from 'next/link';
import styles from './support.module.css';

import { email, emailLink, whatsappLink } from '@/lib/support-contact';

export default function ContactSupportPage() {
  return (
    <div className={styles.page}>
      <header>
        <h1 className="page-title">Contact Support</h1>
        <p className={styles.muted}>Need help with Sarthak Creations OMS? Get in touch using the option that suits you.</p>
      </header>

      <section className={styles.card} aria-labelledby="support-contact">
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">AB</span>
          <div>
            <h2 id="support-contact">Aaditya Bhure</h2>
            <p className={styles.role}>Software Developer</p>
            <p className={styles.muted}>Your contact for application support</p>
          </div>
        </div>
        <dl className={styles.details}>
          <div><dt>Phone</dt><dd><a href="tel:+917758031767">+91 7758031767</a></dd></div>
          <div><dt>Email</dt><dd><a href={emailLink} target="_blank" rel="noopener noreferrer">{email}</a></dd></div>
          <div><dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/in/aaditya-bhure-275742284/" target="_blank" rel="noopener noreferrer">View Aaditya’s profile <span className={styles.newTab}>(opens in a new tab)</span></a></dd></div>
        </dl>
        <div className={styles.actions}>
          <a className="btn btn-primary" href={whatsappLink} target="_blank" rel="noopener noreferrer">Message on WhatsApp ↗</a>
          <a className="btn btn-secondary" href={emailLink} target="_blank" rel="noopener noreferrer">Email Support ↗</a>
          <a className="btn btn-secondary" href="tel:+917758031767">Call Support</a>
        </div>
        <p className={styles.hint}>WhatsApp and Gmail open in a new tab with a draft message filled in for you. You may need to sign in to Gmail. Review the message and send when ready.</p>
      </section>

      <section className={styles.card} aria-labelledby="report-issue">
        <h2 id="report-issue">What to include when reporting an issue</h2>
        <ol className={styles.steps}>
          <li>The page you were using, such as Order List or Active Jobs.</li>
          <li>The relevant order or job card number, if applicable.</li>
          <li>What you were trying to do, what happened, and any error message you saw.</li>
          <li>A screenshot, if it helps explain the problem. Hide any sensitive information first.</li>
        </ol>
        <p className={styles.hint}>Please do not share passwords, login codes or secret keys.</p>
      </section>

      <p className={styles.muted}>Looking for step-by-step instructions? <Link href="/help-desk" className={styles.helpLink}>Visit the Help Desk</Link>.</p>
    </div>
  );
}
