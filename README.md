# fuzzy-fishstick

A To-Do List application with a React frontend and Go backend API.

## Features

- ✅ Add, edit, and delete to-do items
- 👤 Assign items to people
- 🔄 Support for one-off and recurring items
- ✓ Mark items as completed
- 🔀 Drag and drop to reorder items
- 📱 Responsive design
- 🔐 **Authentication with Microsoft Entra ID or local dev mode**

## Project Structure

```
.
├── src/
│   ├── back-end/      # Go API backend
│   └── front-end/     # React frontend
└── .devcontainer/     # Dev container configuration
```

## Architecture

- **Backend**: Go API with RESTful endpoints
- **Frontend**: React with Vite
- **Storage**: In-memory (data resets on server restart)
- **Authentication**: Microsoft Entra ID (production) or mock OAuth server (development)

## Prerequisites

- Go 1.24 or higher
- Node.js 24.x or higher
- npm 11.x or higher

**Or use the Dev Container:**
- Docker
- VS Code with Remote - Containers extension

## Authentication

The application supports two authentication modes:

### Development Mode (Default)
- Uses an embedded mock OAuth2 server in the backend
- Provides test users: Alice, Bob, and Charlie
- Perfect for local development without internet connectivity
- No external configuration required

### Production Mode
- Uses Microsoft Entra ID (Azure AD) for authentication
- Requires Entra ID app registration
- Validates JWT tokens with OIDC
- Configurable allowed users list

See [Authentication Setup](#authentication-setup) for detailed configuration.

## Getting Started

### Option 1: Using Dev Container (Recommended)

1. Open the project in VS Code
2. Click "Reopen in Container" when prompted (or use Command Palette: "Remote-Containers: Reopen in Container")
3. The container will automatically install dependencies
4. Run the backend and frontend as described below

### Option 2: Local Development

#### Running the Backend API

1. Navigate to the backend directory:
   ```bash
   cd src/back-end
   ```

2. (Optional) Create a `.env` file for configuration:
   ```bash
   # Copy the example file to get started
   cp ../../.env.example .env
   # Edit .env with your preferred settings
   ```
   
   Note: The backend will automatically load variables from `.env` if it exists. You can also use system environment variables, which take precedence.

3. Install Go dependencies:
   ```bash
   go mod tidy
   ```

4. Run the API server:
   ```bash
   go run main.go
   ```

   The API will start on `http://localhost:8080`

#### Running the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd src/front-end
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173`

4. Open your browser and navigate to `http://localhost:5173`

## API Endpoints

### To-Do Items

- `GET /api/todos` - Get all to-do items
- `POST /api/todos` - Create a new to-do item
- `PUT /api/todos/{id}` - Update a to-do item
- `DELETE /api/todos/{id}` - Delete a to-do item
- `POST /api/todos/reorder` - Reorder to-do items

### Recurring Items

- `GET /api/recurring` - Get all recurring item definitions
- `POST /api/recurring` - Create a new recurring item definition
- `PUT /api/recurring/{id}` - Update a recurring item definition
- `DELETE /api/recurring/{id}` - Delete a recurring item definition

## Development

### Testing

The project includes end-to-end tests using Playwright to validate application behavior.

#### Running Tests

```bash
cd src/front-end

# Install Playwright browsers (first time only)
npx playwright install

# Run all tests
npm test

# Run tests in headed mode (see the browser)
npm run test:headed

# Run tests with UI mode (interactive)
npm run test:ui

# Show test report
npm run test:report
```

**Using Makefile** (from project root):

```bash
# Run all tests
make test

# Run tests with UI mode (interactive)
make test-ui

# Run tests in headed mode (see the browser)
make test-headed
```

**Note**: Tests require both the backend and frontend servers to be running. The test configuration will automatically start them, or you can start them manually first.

#### Test Coverage

The test suite covers:
- **CRUD Operations**: Adding, editing, and deleting to-do items
- **Completion**: Marking items as complete/incomplete
- **Assignees**: Assigning items to people
- **Reordering**: Drag and drop to reorder items
- **One-off Items**: Creating items with optional due dates
- **Recurring Items**: Creating and managing recurring tasks

### Building for Production

#### Backend
```bash
cd src/back-end
go build -o todo-api main.go
./todo-api
```

#### Frontend
```bash
cd src/front-end
npm run build
```

The production build will be in the `src/front-end/dist` directory.

## Usage

### Creating a To-Do Item

1. Click "Add New Item"
2. Fill in the title, description (optional), and assignee (optional)
3. Check "Make this a recurring item" if you want it to repeat
4. For recurring items, select frequency (daily/weekly/monthly) and interval
5. Click "Add"

### Editing a To-Do Item

1. Click the edit button (✏️) on any item
2. Modify the fields as needed
3. Click "Update"

### Completing a To-Do Item

- Click the checkbox next to any item to mark it as complete

### Reordering Items

- Drag and drop items to reorder them

### Deleting Items

- Click the delete button (🗑️) on any item

### Managing Recurring Items

- Recurring items appear with a 🔄 badge
- View all recurring definitions in the "Recurring Item Definitions" section
- Delete a recurring definition to unlink it from existing items
- Edit a recurring definition to update all future instances

## Docker Deployment

### Using Docker Compose (Recommended)

The easiest way to run the application with Docker:

```bash
# Build and start both services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost
- Backend API: http://localhost:8080

### Using Makefile

```bash
# Build Docker images
make docker-build-all

# Or build individually
make docker-build-backend
make docker-build-frontend

# Run containers
make docker-run-backend
make docker-run-frontend
```

### Manual Docker Commands

```bash
# Build images
docker build -t fuzzy-fishstick-backend:latest src/back-end
docker build -t fuzzy-fishstick-frontend:latest src/front-end

# Run backend
docker run -d -p 8080:8080 --name backend fuzzy-fishstick-backend:latest

# Run frontend (linked to backend)
docker run -d -p 80:80 --name frontend --link backend:backend fuzzy-fishstick-frontend:latest
```

## Authentication Setup

### Development Mode (Default)

No configuration required! Simply run the application and it will use the embedded mock OAuth server.

**Test Users:**
- Alice Smith (alice@example.com)
- Bob Jones (bob@example.com)
- Charlie Brown (charlie@example.com)

When you click "Sign In", you'll be prompted to select a test user.

### Production Mode with Microsoft Entra ID

#### 1. Register Your Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Microsoft Entra ID" > "App registrations"
3. Click "New registration"
4. Configure:
   - **Name**: fuzzy-fishstick (or your preferred name)
   - **Supported account types**: Choose based on your needs (e.g., "Accounts in this organizational directory only")
   - **Redirect URI**: Select "Single-page application (SPA)" and enter your application URL (e.g., `https://yourdomain.com`)
5. Click "Register"

#### 2. Configure the Application

After registration:
1. Note the **Application (client) ID** and **Directory (tenant) ID** from the Overview page
2. Go to "Authentication" and ensure:
   - Platform: Single-page application
   - Redirect URIs are correctly set
   - Implicit grant: ID tokens (optional, for hybrid flows)
3. Go to "Token configuration" and add optional claims if needed:
   - email
   - preferred_username

#### 3. Configure Environment Variables

Create a `.env` file (or set environment variables) with:

```bash
# Set to production mode
AUTH_MODE=prod

# Your Entra ID configuration
ENTRA_TENANT_ID=your-tenant-id-here
ENTRA_CLIENT_ID=your-client-id-here

# Comma-separated list of allowed user emails
ALLOWED_USERS=user1@yourdomain.com,user2@yourdomain.com
```

#### 4. Run the Application

```bash
# Backend
cd src/back-end
export AUTH_MODE=prod
export ENTRA_TENANT_ID=your-tenant-id
export ENTRA_CLIENT_ID=your-client-id
export ALLOWED_USERS=user1@yourdomain.com,user2@yourdomain.com
go run main.go

# Frontend
cd src/front-end
npm run dev
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_MODE` | No | `dev` | Authentication mode: `dev` or `prod` |
| `ALLOWED_USERS` | No | `alice@example.com,bob@example.com,charlie@example.com` | Comma-separated list of allowed user emails |
| `ENTRA_TENANT_ID` | Yes (prod) | - | Microsoft Entra ID tenant ID |
| `ENTRA_CLIENT_ID` | Yes (prod) | - | Microsoft Entra ID application (client) ID |
| `DEV_AUTH_SECRET` | No | Auto-generated | Secret for JWT signing in dev mode |

### Docker Deployment with Authentication

Update your `docker-compose.yml` or set environment variables:

```bash
# Development mode (default)
docker-compose up -d

# Production mode
AUTH_MODE=prod \
ENTRA_TENANT_ID=your-tenant-id \
ENTRA_CLIENT_ID=your-client-id \
ALLOWED_USERS=user1@yourdomain.com,user2@yourdomain.com \
docker-compose up -d
```

## CI/CD

The project includes GitHub Actions workflows for:

- **Pull Requests**: Build and validate Docker images
- **Main Branch**: Build, tag, and push images to GitHub Container Registry (GHCR)
- **Dev Container**: Build and push devcontainer image for consistent development environments

Published images:
- `ghcr.io/stuartleeks/fuzzy-fishstick/backend:latest`
- `ghcr.io/stuartleeks/fuzzy-fishstick/frontend:latest`
- `ghcr.io/stuartleeks/fuzzy-fishstick/devcontainer:latest`

## Security

- All API endpoints require valid authentication tokens
- JWT tokens are validated on every request
- User authorization is checked against an allowed users list
- CORS is configured to allow cross-origin requests (configure appropriately for production)
- In development mode, tokens are signed with a secure random key
- In production mode, tokens are validated using Microsoft Entra ID's public keys

## License

MIT
