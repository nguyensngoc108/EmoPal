# EmoPal - AI Facial Emotion Recognition Therapy Platform

EmoPal is a therapy platform that integrates real-time facial emotion recognition to enhance the therapeutic experience. It enables users to connect with therapists through video calls while analyzing emotional responses to provide insights.

## Features

- **Facial Emotion Recognition**: Real-time analysis of 7 emotional states (happy, sad, angry, fear, disgust, surprise, neutral)
- **Therapy Session Management**: Schedule and join video therapy sessions
- **Emotional Analytics**: Track emotional patterns and responses over time
- **Secure Video Conferencing**: Integrated Agora.io video calls
- **User Authentication**: JWT-based authentication system

## Technology Stack

- **Backend**: Django, Django REST Framework
- **Frontend**: React, Material-UI
- **Database**: MongoDB
- **AI Model**: Custom ResEmoteNet model (PyTorch)
- **Video Streaming**: Agora SDK
- **Containerization**: Docker

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 14+ (for frontend development)
- Python 3.9+ (for backend development without Docker)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/nguyensngoc108/EmoPal.git
cd EmoPal