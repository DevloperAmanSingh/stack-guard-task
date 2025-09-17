# Linear Integration Frontend

A modern React/Next.js frontend for managing vulnerability tickets created by the Linear Integration backend.

## Features

- **Dark Theme UI**: Clean, minimal dark interface using Shadcn components
- **Ticket Management**: View active and resolved vulnerability tickets
- **Scan Interface**: Interactive modal to scan content for secrets
- **Real-time Updates**: Auto-refresh after scanning and resolving tickets
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see backend README)

## Environment Setup

Create a `.env.local` file in the frontend directory:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Running Locally

### Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The app will be available at http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Usage

1. **View Tickets**: The dashboard shows active and resolved tickets in separate tabs
2. **Start Scan**: Click "Start Scan" to open a modal where you can:
   - Enter content to scan for secrets
   - Add optional metadata (repo, commit, channel, file)
   - Submit the scan
3. **Resolve Tickets**: Click "Resolve" on any active ticket to close it in Linear
4. **View Details**: Click the eye icon to see detailed ticket information

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Main dashboard
│   ├── components/         # React components
│   │   ├── ui/            # Shadcn UI components
│   │   ├── SeverityBadge.tsx
│   │   └── TicketsTable.tsx
│   └── lib/
│       └── api.ts         # API client functions
├── public/                # Static assets
├── package.json
└── tailwind.config.js    # Tailwind CSS config
```

## Components

### TicketsTable

- Displays tickets in a responsive table
- Shows ID, type, severity, status, and location
- Action buttons for viewing details and resolving tickets

### SeverityBadge

- Color-coded severity indicators (High, Medium, Low)
- Based on secret type classification

### Scan Modal

- Interactive form for content scanning
- File upload support
- Metadata input fields

## API Integration

The frontend communicates with the backend via:

- `GET /tickets` - Fetch all tickets
- `POST /scan` - Submit content for scanning
- `POST /resolve/:id` - Resolve a ticket

## Styling

- **Framework**: Tailwind CSS
- **Components**: Shadcn UI
- **Theme**: Dark mode with zinc color palette
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type checking
npm run type-check
```

## Environment Variables

| Variable              | Description          | Default                 |
| --------------------- | -------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080` |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
