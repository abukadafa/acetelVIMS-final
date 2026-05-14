# ACETEL Postgraduate IMS — Global SaaS Architecture

## 🚀 Institutional Production Standard (Virtual Lab Model)

This repository contains the **National-Grade SaaS Platform** for the Africa Centre of Excellence on Technology Enhanced Learning (ACETEL). This build is optimized for professional postgraduate academic monitoring (MSc/PhD) and global cloud deployment, modeled after the **Virtual Laboratory** architecture.

### 🛠 Technology Stack (SaaS Grade)
- **Frontend**: React (Vite) + Tailwind (Premium UI) + PWA + Socket.io Client
- **Backend**: Node.js + Express + TypeScript + **Morgan** (Auditing) + **Winston** (Logging)
- **Database**: MongoDB (Multi-tenant schema ready)
- **Infrastructure**: Docker + Nginx (Reverse Proxy) + **GitHub Actions (CI/CD)**

## 📦 SaaS Features

### 1. Intelligent Student Registration (SDMS Integrated)
The system connects to the existing ACETEL Student Database Management System. New students simply enter their **Matric Number** to auto-fetch their official records, ensuring 100% data integrity.

### 2. Autonomous Placement Allocation
Using the **Intelligent Allocation Engine**, the system automatically matches students to the nearest industry placement partners based on:
- Geographic proximity (GPS coordinates).
- Academic specialization match (e.g., MSc Cybersecurity matches Tech firms).
- Real-time partner capacity.

### 3. Postgraduate Research & Monitoring
Tailored specifically for **PG research candidates**:
- **Thesis Phase Tracking**: Monitor progress from *Coursework* to *Defense*.
- **Biometric Presence**: Real-time Socket.io pings for live student tracking on the national map.

## 🐳 Launch Instructions

### Development Mode (Local)
1. **Initialize Backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
2. **Initialize Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```

### Production Mode (Docker SaaS)
1. Configure your `.env` in both folders.
2. Build and launch the cluster:
   ```bash
   docker-compose up --build -d
   ```

## 🛰️ Access Points
- **Client Interface**: `http://localhost:80`
- **Backend API**: `http://localhost:5000/api/health`
- **Socket.io Pipeline**: Active on port `5000`

---
*Developed for ACETEL (Africa Centre of Excellence on Technology Enhanced Learning)*
