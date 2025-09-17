# Linear Integration

A full-stack application that automatically creates Linear tickets when secrets are detected in code, with a modern web interface for ticket management.

## Steps to start

### Backend Setup

```bash
cd backend

# Create a .env file with neccessary credentials

# Start with Docker Compose
docker compose up --build
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the dashboard.

## 🔧 Tech Stack

**Backend:**

- Go 1.22
- Fiber v2
- PostgreSQL + GORM
- Linear GraphQL API

**Frontend:**

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Shadcn UI

## 📖 Documentation

- [Backend README](./backend/README.md) - API documentation and setup
- [Frontend README](./frontend/README.md) - Info on how to setup locally

## 🔑 Environment Variables

### Backend (.env)

```env
LINEAR_API_KEY=your_linear_api_key
LINEAR_TEAM_ID=your_linear_team_uuid
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=secrets
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Frontend (.env.local)

````env
NEXT_PUBLIC_API_URL=http://localhost:8080```
````
