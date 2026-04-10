# ACETEL PG SaaS — Administrative & Compliance Manual

## 📌 Executive Summary
The **ACETEL Postgraduate PG SaaS** is a national-grade institutional platform designed to enforce academic standards for MSc and PhD internship monitoring. This manual outlines the critical SaaS-grade business logic and compliance workflows.

---

## 🔒 Security & Cloud Sovereignty
- **SaaS Multi-Tenancy**: All postgraduate data is strictly isolated by `tenantId`. 
- **Production Hardening**: The system uses **Morgan** for institutional auditing and a centralized **Error Shield** to protect cloud infrastructure during scaling.
- **Root Auth**: Secure database credentials must be managed via the root `.env` following the [`.env.example`](.env.example) template.

---

## 📡 Real-Time Monitoring & Escalation
The system operates on an automated "no-touch" monitoring principle with live **Socket.IO** feedback:

| Tier | Days of Inactivity | Notification Target | Risk Score Impact |
|------|---------------------|---------------------|-------------------|
| 1    | 3 Days              | Student (Automated) | +6                |
| 2    | 5 Days              | Research Supervisor | +10               |
| 3    | 7 Days              | Programme Coordinator| +14 (Medium Risk)|
| 4    | 10 Days             | National System Alert| +20 (High Risk)  |

---

## 📈 Postgraduate Academic Audit
Administrators should periodically export the **Audit-Ready CSV** to comply with the Africa Centre of Excellence (ACE) benchmarks.

### Audit Trail Columns (Research Grade):
- **Thesis Phase**: Verification of research progress (Coursework, Proposal, etc.).
- **Supervisor Verification**: Identity-assured technical performance rating.
- **Biometric Proof**: GPS-fenced attendance verification for physical presence.

---

## 🛠 Cloud Operations & Health
- **SaaS Logs**: Use `docker-compose logs -f server` to monitor the Morgan audit stream.
- **Monitoring Jobs**: The `monitoring.job.ts` runs automatically at institutional intervals.
- **CI/CD Integration**: Every push to your GitHub repository triggers a build validation via **GitHub Actions**.

---
*Institutional Use Only — (C) 2026 ACETEL / NOUN*
