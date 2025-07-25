# TekRiders - Empowering Offline Learning for Marginalized Youth

> A modern offline-first e-learning platform designed in Kinyarwanda to teach IT and coding skills to refugee and rural youth in Rwanda.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![CouchDB](https://img.shields.io/badge/CouchDB-Database-red?logo=apache-couchdb)

---

## Project Overview
TekRiders is a full-stack Progressive Web App (PWA) that delivers offline-first digital literacy and coding courses to youth in under-connected refugee and rural communities. It supports multi-role user management (Admin, Tutor, Learner), course creation and approval workflows, multilingual support, gamified achievements, and interactive assessments — all available with or without internet.

---

## Core Features
- **Offline-first learning with PWA and Service Workers**
- **Multilingual content:** Kinyarwanda (primary) and English
- **Gamified assessments:** quizzes, badges, leaderboards, and certificates
- **Secure authentication:** JWT with role-based dashboards
- **Tutor > Course > Admin Approval > Learner Enrollment workflow**
- **In-app real-time notifications**
- **Theme toggling and mobile responsiveness**
- **TTS and STT accessibilities for course pages**

---

## Technology Stack

### Frontend
- React 18 + Vite (Fast UI development)
- TypeScript (type-safe, scalable)
- Tailwind CSS (utility-first styling)
- React Router (routing)

### Backend
- Node.js + Express.js (REST API)
- TypeScript (type safety)
- JWT (Authentication)
- Multer (file upload handling)

### Database and Sync
- CouchDB (document storage & sync)
- PouchDB (offline browser cache)
- IndexedDB (local-first access)

### Cloud & Deployment
- Firebase (PDF storage)
- Cloudinary (profile pictures & thumbnails)
- YouTube (unlisted course videos)
- Render (backend hosting)
- Vercel (frontend hosting)
- IBM Cloudant (CouchDB production instance)

---

## User Roles
### Administrator
- Approves or rejects tutor-created courses
- Manages users and platform settings

### Tutor
- Creates and submits courses (form-based)
- Views and tracks learner progress

### Learner
- Enrolls in approved courses
- Downloads materials for offline access
- Completes lessons and assessments

---

## 📁 Project Structure
```
TekRiderz/
├── client/      → React frontend
├── backend/     → Node.js API
├── docs/        → Project documentation
```

---

## Testing and Validation
### Unit Testing
- Component logic and route tests (e.g., login, role-based redirects)
- Screenshots: `__tests__/auth.test.tsx`

### Integration Testing
- Tutor > Course Creation > Admin Approval > Learner Enrollment flow
- Screenshot: `dashboard/tutor_course_form.png`, `admin/approval_list.png`

### Functional & Validation Testing
- Multiple devices tested (smartphone, tablet, laptop)
- Verified role-based access & multilingual interface
- Screenshot: `screens/login.png`

### Performance Testing
- Measured loading with PWA on 3G / no internet
- Offline access verified using Chrome DevTools

---

## Screenshots

- `Landing page`

- <img width="1920" height="1080" alt="Untitled design (4)" src="https://github.com/user-attachments/assets/453238ea-8412-45ee-83e3-c1169e9598d0" />


- `Login and Role-Based Dashboards`
- 
  <img width="1920" height="1080" alt="Untitled design (3)" src="https://github.com/user-attachments/assets/eecc8db4-2fc5-4eee-8a5a-ed0ea61d2877" />

  
- `Tutor Course Creation Form`
- 
  <img width="1440" height="813" alt="image" src="https://github.com/user-attachments/assets/f3e56669-767b-4633-837b-a26d934f2463" />


- `Admin Course Approval Panel`
- 
  <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/bb6e5e4d-d6d9-45b4-9a8e-798709672510" />


- `Learner Course Enrollment and Offline Module Access`
- 
  <img width="1440" height="813" alt="image" src="https://github.com/user-attachments/assets/70ce4236-96ed-4484-8332-3228f57ed3d9" />

- `Gamified Quiz and Certificate Preview`
- 
  <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/aa724238-237a-4610-98ce-374f7fb952fe" />

---

## Results and Analysis
- **Objective mostly met:** Needed offline-first PWA built in Kinyarwanda
- **Learner feedback:** 90% satisfaction on offline usability
- **Device testing:** Functioned on low-end Android phones
- **Pre/post test:** Improved quiz scores in pilot learners by avg. 35%
- **Storage:** Efficient offline caching of modules (videos & PDFs) via IndexedDB

---

## Supervisor & Milestone Discussion
Throughout development, feedback from the supervisor helped shape:
- **Early ideation** into a culturally relevant solution with PWA
- **Midpoint check-ins** refocused scope on offline-first integrity
- **Final reviews** validated PWA performance, UX, and platform logic/flow

Each milestone — from proposal to prototype to pilot - was guided and adjusted according to real-world usability and research objectives.

---

## Recommendations
- **Use in Refugee Programs:** Partner with UNHCR, Save the Children to deploy TekRiders in camps
- **Incorporate with TVET:** Align with Rwanda’s ICT TVET initiatives
- **Train Local Tutors:** Equip local instructors with platform onboarding

---

## Future Work
- AI-powered in-app tutor (advanced offline NLP Q&A model)
- Real-time discussion forums and peer learning
- Learner activity analytics for tutors
- Tutor revenue system for local monetization
- Enhanced accessibility for visually impaired learners

---

## Ethical Considerations
- **Data Privacy:** All user data is encrypted and stored securely
- **Informed Consent:** Participants were informed of data usage during testing
- **Open Source Access:** MIT License for transparency and contribution

---

## Development Commands
```bash
npm run dev           # Start frontend and backend
npm run dev:client    # Frontend only
npm run dev:backend    # Backend only
npm run build         # Production build
npm run start         # Start production server
```

---

## Final Submission Summary
- ✅ Offline-first full-stack e-learning platform
- ✅ Localized in Kinyarwanda and English
- ✅ Pilot-tested in refugee and rural communities
- ✅ Fully implemented system with real-world validation

---

## License
MIT License — Educational Project

---

**Built with passion for accessible tech education in Rwanda**

*TekRiders — Where learning breaks boundaries.*
