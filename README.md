
🎓 Alumni Connect Platform
MCA Mini Group Project – Alumni Connect Platform

An Intelligent Alumni–Student Interconnect Platform developed as a Mini Group Project for the Master of Computer Applications (MCA) program at Presidency University, Bengaluru.

This platform bridges the communication gap between students and alumni by providing a centralized, secure, and scalable system for networking, mentorship, job opportunities, events, and AI-based career guidance.

📌 Problem Statement

In many educational institutions, there is no structured and centralized system to connect students with alumni. Communication is scattered across informal channels, mentorship is untracked, and students lack timely career guidance. Institutions also face difficulty in monitoring alumni engagement and contribution.

🎯 Project Objectives

To design a centralized platform for alumni–student interaction

To enable secure and role-based communication

To support mentorship, job postings, and event management

To provide AI-based career guidance and query assistance

To ensure scalability, security, and maintainability

🚀 Key Features

User Authentication (Student / Alumni / Admin)

Profile Management

Alumni Directory & Search

Connection Requests

One-to-One Messaging System

Job Posting & Applications

Event Creation & RSVP

Mentorship Requests

AI Chat Assistant (Ollama)

Role-Based Access Control

🛠️ Tech Stack
Frontend

React.js (Vite)

JavaScript (ES6)

HTML5, CSS3

Axios

React Router

Context API

Backend

Node.js

Express.js

RESTful APIs

JWT Authentication

Database

MongoDB Atlas

Mongoose ODM

AI Integration

Ollama (Local LLM)

🧱 System Architecture
Frontend (React)
   ↓
Backend (Node + Express)
   ↓
MongoDB Atlas
   ↓
Ollama AI

⚙️ Installation & Setup
Clone the Repository
git clone https://github.com/shivam-karma/alumni-connect-platform.git
cd alumni-connect-platform

Backend Setup
cd backend
npm install
node src/server.js

Frontend Setup
cd frontend
npm install
npm run dev

👥 Team Members & Contributions
Name	Role	Contribution
Shivam Vishwakarma	Team Lead & Full Stack Developer	Complete frontend & backend development, system architecture, API design, database integration, AI integration
Abhishek N	Documentation Lead	Project documentation, report preparation, formatting
Jagdesh	Research Analyst	Literature survey, research paper analysis, references
Shivank Jadli	Support & Coordination	Documentation assistance, research support, communication
🔐 Security Considerations

Password hashing

JWT-based authentication

Role-based access control

Environment variables protected using .env

Sensitive files excluded via .gitignore

🔮 Future Enhancements

Real-time chat using Socket.IO

Video-based mentorship sessions

AI-based alumni & job recommendations

Mobile application

Resume analyzer with AI feedback

Email & notification services

📜 License

This project is developed strictly for academic purposes as part of the MCA curriculum at Presidency University, Bengaluru.

🙌 Acknowledgements

We would like to thank our project guide and the faculty of the Presidency School of Information Science for their guidance and support throughout the development of this project.
