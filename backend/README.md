# Linear Integration Backend

A Go backend service that integrates with Linear to automatically create and manage vulnerability tickets when secrets are detected in code.

## Prerequisites

- Go 1.22+
- Docker & Docker Compose
- PostgreSQL (or use Docker Compose)
- Linear API key and team ID

## Environment Setup

Create a `.env` file in the backend directory:

```env
LINEAR_API_KEY=your_linear_api_key_here
LINEAR_TEAM_ID=your_linear_team_uuid_here


POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=secrets
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

## Running Locally

```bash
docker compose up --build
```

## API Endpoints

- `GET /ping` - Health check
- `POST /scan` - Scan content for secrets
- `POST /scan/file` - Scan uploaded file for secrets
- `GET /tickets` - List all tickets
- `POST /resolve/:id` - Resolve a ticket

## Example Usage

```bash
#scan content

curl -X POST http://localhost:8080/scan \
  -H "Content-Type: application/json" \
  -d '{
    "content": "AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF",
  }'

# List tickets
curl http://localhost:8080/tickets
```

## Secret Detection Patterns

The scanner detects various types of secrets:

- AWS Access Keys (`AKIA...`)
- AWS Secret Keys
- JWT Tokens
- GitHub Personal Access Tokens
- Slack Bot/User Tokens
- Google API Keys
- Stripe Secret Keys
- Generic API Keys

## Development

```bash
# Build binary
go build -o server cmd/server/main.go
```
