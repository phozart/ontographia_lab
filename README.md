# Ontographia Lab

A professional visual diagramming workspace for creating diagrams, flowcharts, mind maps, and more. Built with React and Next.js.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)

## Features

- **Multiple Diagram Types**: Flowcharts, mind maps, ERD, UML, CLD, and more
- **Stencil Packs**: Extensible shape libraries for different diagram types
- **Smart Connections**: Auto-routing with orthogonal, curved, and straight lines
- **Real-time Collaboration**: Share and collaborate on diagrams
- **Comments & Annotations**: Add feedback directly on the canvas
- **Keyboard Shortcuts**: Professional workflow with extensive shortcuts
- **Export Options**: SVG, PNG, and JSON export
- **Dark/Light Themes**: Comfortable viewing in any environment

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL database)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ontographia-lab.git
cd ontographia-lab

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings (see Configuration below)
```

### Development

```bash
# Start the database
docker-compose up -d db

# Initialize database and create admin account
npm run db:setup

# Start development server
npm run dev
```

Open [http://localhost:3040](http://localhost:3040) in your browser (or your configured `APP_PORT`).

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Database Credentials (used by docker-compose and app)
DB_USER=diagram_studio
DB_PASSWORD=diagram_studio
DB_NAME=diagram_studio
DB_HOST=localhost
DB_PORT=5434

# Application Port
APP_PORT=3040

# NextAuth.js
NEXTAUTH_URL=http://localhost:3040
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Admin Account
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Administrator
```

**Note:** All database credentials are centralized in `.env` - changing them there updates both docker-compose and the application automatically.

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

## Database Commands

```bash
npm run db:init      # Initialize database tables
npm run db:seed      # Create admin account from .env
npm run db:seed:list # List all admin accounts
npm run db:setup     # Run init + seed together
```

## Authentication

Ontographia Lab supports multiple authentication methods:

- **Email/Password**: Traditional signup with admin approval workflow
- **Google OAuth**: Sign in with Google account
- **GitHub OAuth**: Sign in with GitHub account

### User Roles

| Role | Description |
|------|-------------|
| Admin | Full access, can approve/suspend users, manage all diagrams |
| User | Standard access after admin approval |

### User Status

| Status | Description |
|--------|-------------|
| Pending | Awaiting admin approval (new signups) |
| Active | Full access to the application |
| Suspended | Access revoked by admin |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `C` | Connect tool |
| `H` | Pan tool |
| `K` | Comment mode |
| `M` | Toggle minimap |
| `T` | Connection toolbar (when connection selected) |
| `Delete` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+D` | Duplicate |
| `Ctrl+C/V` | Copy/Paste |
| `F` | Fit all to screen |
| `G` | Toggle grid |
| `?` | Show all shortcuts |

## Supported Diagram Types

- **Core Shapes** - Basic rectangles, circles, diamonds, text
- **Process Flow** - Flowcharts and decision diagrams
- **Mind Map** - Hierarchical brainstorming
- **UML Class** - Object-oriented design
- **ERD** - Entity relationship diagrams
- **CLD** - Causal loop diagrams (system dynamics)
- **TOGAF** - Enterprise architecture
- **Capability Map** - Business capability mapping

## API Endpoints

### Health Check

```
GET /api/health
```

Returns application health status including database connectivity and memory usage.

### Authentication

```
POST /api/auth/signup     # Email/password registration
POST /api/auth/signin     # NextAuth sign in
GET  /api/auth/session    # Get current session
```

### Diagrams

```
GET    /api/diagrams          # List all diagrams
POST   /api/diagrams          # Create new diagram
GET    /api/diagrams/:id      # Get diagram by ID
PUT    /api/diagrams/:id      # Update diagram
DELETE /api/diagrams/:id      # Delete diagram
```

### Admin

```
GET  /api/admin/users     # List all users (admin only)
POST /api/admin/users     # Update user status/role (admin only)
```

## Docker Deployment

### Using Docker Compose

```bash
# Start database only
docker-compose up -d db

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Production Docker Build

```bash
# Build production image
docker build -t ontographia-lab .

# Run container (using environment variables from .env)
docker run -p 3040:3000 --env-file .env ontographia-lab

# Or run with explicit environment variables
docker run -p 3040:3000 \
  -e DB_USER=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_NAME=your-db-name \
  -e NEXTAUTH_SECRET=your-secret \
  -e NEXTAUTH_URL=https://your-domain.com \
  ontographia-lab
```

## Project Structure

```
ontographia-lab/
├── components/
│   └── diagram-studio/
│       ├── DiagramStudio.js      # Main container
│       ├── DiagramCanvas.js      # Canvas rendering
│       ├── DiagramContext.js     # State management
│       ├── connections/          # Connection rendering
│       ├── packs/                # Stencil packs
│       └── ui/                   # UI components
├── pages/
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── admin/                # Admin endpoints
│   │   ├── diagrams/             # Diagram CRUD
│   │   └── health.js             # Health check
│   ├── admin/                    # Admin pages
│   ├── login.js                  # Login page
│   ├── signup.js                 # Signup page
│   └── diagram/[id].js           # Diagram editor
├── lib/
│   ├── db.js                     # Database connection
│   ├── useAuth.js                # Auth hooks/middleware
│   └── rateLimit.js              # Rate limiting
├── scripts/
│   ├── init-db.js                # Database initialization
│   └── seed-admin.js             # Admin account seeding
├── styles/                       # CSS styles
├── public/                       # Static assets
├── docker-compose.yml            # Docker configuration
├── Dockerfile                    # Production Docker image
└── init.sql                      # Database schema
```

## Security Features

- **Rate Limiting**: 5 requests/minute on auth endpoints
- **Password Hashing**: bcrypt with 12 rounds
- **JWT Sessions**: 30-day expiry with secure cookies
- **Admin Approval**: New users require admin approval
- **HTTPS**: Required in production

## Testing

```bash
npm run test           # Run unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:e2e       # End-to-end tests
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_USER` | Database username | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_HOST` | Database host | Yes |
| `DB_PORT` | Database port (default: 5434) | Yes |
| `APP_PORT` | Application port (default: 3040) | No |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | Session encryption key | Yes |
| `ADMIN_EMAIL` | Initial admin email | Yes |
| `ADMIN_PASSWORD` | Initial admin password | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | No |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | No |

**Note:** You can also set `DATABASE_URL` directly instead of individual `DB_*` variables. If both are set, `DATABASE_URL` takes precedence.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with care by the Ontographia Team
