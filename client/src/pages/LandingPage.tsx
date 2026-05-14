import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [showNoun, setShowNoun] = useState(true);
  const [countUp, setCountUp] = useState({ interns: 0, companies: 0, rate: 0 });
  const statsRef = useRef<HTMLDivElement>(null);
  const countStarted = useRef(false);

  useEffect(() => {
    const logoInterval = setInterval(() => setShowNoun(p => !p), 2800);
    const onScroll = () => setNavScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => { clearInterval(logoInterval); window.removeEventListener('scroll', onScroll); };
  }, []);

  // Count-up animation when stats enter viewport
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !countStarted.current) {
        countStarted.current = true;
        const duration = 1800;
        const steps = 60;
        const interval = duration / steps;
        let step = 0;
        const timer = setInterval(() => {
          step++;
          const t = step / steps;
          const ease = 1 - Math.pow(1 - t, 3);
          setCountUp({
            interns: Math.round(ease * 1200),
            companies: Math.round(ease * 340),
            rate: Math.round(ease * 98),
          });
          if (step >= steps) clearInterval(timer);
        }, interval);
      }
    }, { threshold: 0.4 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const features = [
    { icon: '📋', title: 'Digital Logbook System', desc: 'Interns submit daily and weekly activity logs with supervisor review workflows, automated reminders, and instant approval tracking — all paperless.' },
    { icon: '📍', title: 'Smart Attendance Tracking', desc: 'Geo-verified biometric check-in integrated with a live map dashboard showing all active placements and attendance patterns at a glance.' },
    { icon: '🤝', title: 'Integrated Communication', desc: 'Real-time messaging between interns, academic supervisors, and industry mentors. Built-in WhatsApp alerts and institutional email broadcasts.' },
    { icon: '📊', title: 'Analytics Dashboards', desc: 'High-level programme analytics for coordinators to monitor cohort progress, attendance trends, and performance bottlenecks across all placements.' },
    { icon: '🏢', title: 'Company Management', desc: 'Centralized registry of partner organizations, industry supervisors, and placement allocations — with capacity and performance metrics.' },
    { icon: '🔐', title: 'Academic Audit Trail', desc: 'A complete immutable log of every internship interaction ensuring institutional accountability and accreditation compliance at every level.' },
  ];

  const portals = [
    { icon: '🎓', role: 'Intern', name: 'Student Intern', desc: 'Submit logbooks, mark attendance, receive supervisor feedback, and track your virtual internship progress end-to-end.' },
    { icon: '👤', role: 'Academic', name: 'Academic Supervisor', desc: 'Review intern logbooks, conduct weekly evaluations, and coordinate with industry mentors on student performance.' },
    { icon: '🏭', role: 'Industry', name: 'Industry Supervisor', desc: 'Monitor intern activities at your organization, approve logbooks, and provide structured real-world feedback.' },
    { icon: '⚙️', role: 'System', name: 'Administrator', desc: 'Full system control — manage users, placements, companies, analytics, security, and all institutional settings.' },
  ];

  return (
    <div className="landing-root">

      {/* ══ NAV ══ */}
      <nav className={`landing-nav${navScrolled ? ' landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-brand">
          <div className="landing-nav-logobox">
            <img src="/assets/noun-logo.png" alt="NOUN" className="landing-nav-logo-img" style={{ opacity: showNoun ? 1 : 0 }} />
            <img src="/assets/acetel-logo.png" alt="ACETEL" className="landing-nav-logo-img" style={{ opacity: showNoun ? 0 : 1 }} />
          </div>
          <div>
            <div className="landing-nav-name">ACETEL VIMS</div>
            <div className="landing-nav-sub">Virtual Internship Platform</div>
          </div>
        </div>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Core Features</a>
          <a href="#portals" className="landing-nav-link">Role Access</a>
          <Link to="/login" className="landing-nav-btn">Sign In</Link>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className="landing-hero">
        <div className="landing-hero-live-feed">
          <div className="landing-live-label">
            <span className="landing-live-dot" />
            Internship Feed — Live
          </div>
          <div className="landing-feed-item">✦ Portal Access Active</div>
          <div className="landing-feed-item">✦ Digital Logbook System Online</div>
          <div className="landing-feed-item">✦ Supervisor Sync Enabled</div>
        </div>

        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            <span className="landing-live-dot" />
            Virtual Internship Management Portal Active
          </div>
          <div className="landing-hero-eyebrow">
            ACETEL · National Open University of Nigeria
          </div>
          <h1 className="landing-hero-title">
            Internship<br />
            <span className="landing-title-green">Reimagined.</span>{' '}
            <span className="landing-title-gold">Redefined.</span>
          </h1>
          <p className="landing-hero-desc">
            ACETEL's next-generation platform for virtual internship monitoring — where academic
            mentorship meets real-world industry practice in a seamless digital experience.
          </p>
          <div className="landing-hero-cta">
            <Link to="/login" className="landing-btn-primary">Enter Intern Portal</Link>
            <a href="#features" className="landing-btn-ghost">Explore Features</a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="landing-stats-bar" ref={statsRef}>
          <div className="landing-stat-item">
            <div className="landing-stat-num">{countUp.interns.toLocaleString()}+</div>
            <div className="landing-stat-label">Active Interns</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-num">{countUp.companies}+</div>
            <div className="landing-stat-label">Partner Companies</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-num">{countUp.rate}%</div>
            <div className="landing-stat-label">Completion Rate</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-num landing-stat-live">Live</div>
            <div className="landing-stat-label">System Status</div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-eyebrow">Platform Engine</div>
          <h2 className="landing-section-title">
            Built for <span className="landing-title-green">Scale</span> &amp; Transparency.
          </h2>
          <p className="landing-section-desc">
            Engineered to handle the full lifecycle of virtual internship programs — from placement
            to final assessment — with institutional precision.
          </p>
          <div className="landing-features-grid">
            {features.map((f, i) => (
              <div className="landing-feature-card" key={i}>
                <div className="landing-feature-icon">{f.icon}</div>
                <div className="landing-feature-title">{f.title}</div>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PORTALS ══ */}
      <section id="portals" className="landing-section landing-section-pale">
        <div className="landing-container">
          <div className="landing-section-eyebrow">Role-Based Access</div>
          <h2 className="landing-section-title">
            Access Your <span className="landing-title-green">Workspace.</span>
          </h2>
          <p className="landing-section-desc">
            Select your institutional role to enter your dedicated virtual internship management portal.
          </p>
          <div className="landing-portals-grid">
            {portals.map((p, i) => (
              <Link to="/login" className="landing-portal-card" key={i}>
                <div className="landing-portal-icon">{p.icon}</div>
                <div className="landing-portal-role">{p.role}</div>
                <div className="landing-portal-name">{p.name}</div>
                <p className="landing-portal-desc">{p.desc}</p>
                <div className="landing-portal-link">Enter Portal →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA STRIP ══ */}
      <section className="landing-cta-strip">
        <div className="landing-cta-strip-inner">
          <div>
            <h2 className="landing-cta-title">
              Ready to <span className="landing-title-gold">Launch</span> Your Internship?
            </h2>
            <p className="landing-cta-desc">Join thousands of ACETEL students managing their virtual placements with precision.</p>
          </div>
          <Link to="/login" className="landing-btn-primary">Enter Platform Portal</Link>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div>
              <div className="landing-footer-name">ACETEL VIMS</div>
              <div className="landing-footer-sub">Virtual Internship Management System</div>
              <p className="landing-footer-desc">
                Africa Centre of Excellence for Technology Enhanced Learning — redefining institutional
                internship standards through digital innovation and academic transparency.
              </p>
            </div>
            <div>
              <div className="landing-footer-col-title">Navigation</div>
              <a href="#features" className="landing-footer-link">Core Features</a>
              <a href="#portals" className="landing-footer-link">Role Portals</a>
              <Link to="/login" className="landing-footer-link">Sign In</Link>
            </div>
            <div>
              <div className="landing-footer-col-title">Account</div>
              <Link to="/login" className="landing-footer-link">Student Sign In</Link>
              <Link to="/login" className="landing-footer-link">Supervisor Sign In</Link>
              <Link to="/login" className="landing-footer-link">Admin Portal</Link>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <div className="landing-footer-copy">
              © 2026 ACETEL Virtual Internship Management System. All Rights Reserved.
            </div>
            <div className="landing-footer-status">
              <span className="landing-live-dot" />
              Internship Hub Online
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
