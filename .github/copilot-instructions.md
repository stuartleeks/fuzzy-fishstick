# Copilot Instructions for fuzzy-fishstick

## Project Overview

fuzzy-fishstick is a To-Do List application with a React frontend and Go backend API.

### Key Features
- Add, edit, and delete to-do items
- Assign items to multiple people
- Support for one-off and recurring items
- Mark items as completed
- Drag and drop to reorder items
- Responsive design

## Architecture

### Backend
- **Language**: Go 1.24+
- **Framework**: Gorilla Mux for HTTP routing
- **Storage**: In-memory (data resets on server restart)
- **Port**: 8080
- **Location**: `src/back-end/`

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **UI Libraries**: @hello-pangea/dnd for drag and drop
- **HTTP Client**: Axios
- **Port**: 5173 (dev), 80 (production/Docker)
- **Location**: `src/front-end/`

## Development Commands

### Backend (Go)
```bash
cd src/back-end

# Install dependencies
go mod tidy

# Run development server
go run main.go

# Build for production
go build -o todo-api main.go

# Run linters (if you add any, follow Go community standards)
```

### Frontend (React/TypeScript)
```bash
cd src/front-end

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Docker
```bash
# Build all images
make docker-build-all

# Or use docker-compose
docker-compose up -d
```

## Code Style and Conventions

### TypeScript/React Frontend
- **Strict mode enabled**: TypeScript compiler is configured with `strict: true`
- **Type safety**: 
  - Use `noUncheckedIndexedAccess: true` - always check array bounds
  - No implicit any types
  - Define types in `src/front-end/src/types.ts`
- **React patterns**:
  - Functional components with hooks
  - Use TypeScript interfaces for props and state
  - Follow React Hooks rules (enforced by ESLint)
- **Linting**: ESLint with React Hooks plugin
  - Run `npm run lint` before committing
  - Unused variables starting with capital letters or underscore are ignored
- **File organization**:
  - Components in `src/front-end/src/`
  - Types in `src/front-end/src/types.ts`
  - Styles in `src/front-end/src/App.css`

### Go Backend
- **Go version**: 1.24.12
- **Package**: `github.com/stuartleeks/fuzzy-fishstick`
- **Code style**: Follow standard Go conventions (gofmt)
- **Error handling**: Always return and handle errors explicitly
- **Concurrency**: Use mutexes for thread-safe data access (see Store struct)
- **Validation**: 
  - Validate all input data in API handlers
  - Return HTTP 400 with clear error messages for validation failures
  - Check required fields (title is required)
  - Validate intervals (must be >= 1)
  - Validate frequency values (must be "daily", "weekly", or "monthly")
  - Validate daysOfWeek for weekly recurring items

## API Design Patterns

### RESTful Endpoints
All API endpoints are prefixed with `/api/`

**To-Do Items:**
- `GET /api/todos` - List all to-do items
- `POST /api/todos` - Create a new to-do item
- `PUT /api/todos/{id}` - Update a to-do item
- `DELETE /api/todos/{id}` - Delete a to-do item
- `POST /api/todos/reorder` - Reorder to-do items
- `POST /api/todos/{id}/convert-recurring` - Convert to/from recurring

**Recurring Item Definitions:**
- `GET /api/recurring` - List all recurring item definitions
- `POST /api/recurring` - Create a recurring item definition
- `PUT /api/recurring/{id}` - Update a recurring item definition
- `DELETE /api/recurring/{id}` - Delete a recurring item definition

### Data Models

**TodoItem:**
```go
type TodoItem struct {
    ID              int                `json:"id"`
    Title           string             `json:"title"`
    Description     string             `json:"description"`
    AssignedTo      []string           `json:"assignedTo"`      // Array of assignee names
    Completed       bool               `json:"completed"`
    Position        int                `json:"position"`
    IsRecurring     bool               `json:"isRecurring"`
    RecurrenceID    *int               `json:"recurrenceId,omitempty"`
    DueDate         *time.Time         `json:"dueDate,omitempty"`
    CompletedAt     *time.Time         `json:"completedAt,omitempty"`
    CreatedAt       time.Time          `json:"createdAt"`
}
```

**RecurringItemDefinition:**
```go
type RecurringItemDefinition struct {
    ID          int                `json:"id"`
    Title       string             `json:"title"`
    Description string             `json:"description"`
    AssignedTo  []string           `json:"assignedTo"`      // Array of assignee names
    Pattern     RecurrencePattern  `json:"pattern"`
    StartDate   time.Time          `json:"startDate"`
    CreatedAt   time.Time          `json:"createdAt"`
}
```

**RecurrencePattern:**
```go
type RecurrencePattern struct {
    Frequency  string   `json:"frequency"`  // "daily", "weekly", "monthly"
    Interval   int      `json:"interval"`   // Every N days/weeks/months (must be >= 1)
    DaysOfWeek []string `json:"daysOfWeek"` // For weekly: ["Monday", "Wednesday", ...]
}
```

### CORS Configuration
- All origins allowed (`Access-Control-Allow-Origin: *`)
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type

## Important Conventions

### Multiple Assignees
- The `AssignedTo` field is an **array of strings** (`[]string`), not a single string
- Support multiple people assigned to the same item
- Display assignees as blue badges in the UI
- Allow inline editing to add/remove assignees

### Recurring Items
- Recurring items have a separate definition (RecurringItemDefinition)
- Individual instances are TodoItems with `IsRecurring: true` and a `RecurrenceID`
- Editing an instance edits only that instance
- Editing the definition affects all future instances
- Recurring badge (🔄) displays in the due date column

### Inline Editing
- Table fields support inline editing: title, description, assignedTo, dueDate
- Click field to edit, Enter/blur to save, Escape to cancel
- Editable cells use `display: block` and `width: 100%` for full click targets
- Minimum height of 2rem ensures clickability even with empty content

### Date Handling
- Backend uses Go's `time.Time`
- Frontend stores dates in YYYY-MM-DD format
- Converted to ISO 8601 for API communication
- Optional due dates for non-recurring items

## Files and Directories

### Do Not Modify
- `node_modules/` - Frontend dependencies (auto-generated)
- `dist/` - Frontend build output (auto-generated)
- `go.sum` - Go dependencies checksum (managed by go mod)
- `.devcontainer/` - Dev container configuration (modify only if changing dev environment)
- Docker-related files unless explicitly requested

### Key Files to Understand
- `src/back-end/main.go` - All backend logic in a single file
- `src/front-end/src/App.tsx` - Main React component
- `src/front-end/src/types.ts` - TypeScript type definitions
- `src/front-end/src/App.css` - UI styles
- `Makefile` - Common development commands
- `docker-compose.yml` - Container orchestration

## Testing Guidelines

Currently, this project does not have automated tests. When adding tests:

### Backend Testing
- Use Go's built-in testing framework (`testing` package)
- Test files should be named `*_test.go`
- Place tests alongside the code they test
- Test API handlers, validation logic, and data operations

### Frontend Testing
- If adding tests, use a framework compatible with React 19 and Vite
- Consider Vitest for unit tests (integrates well with Vite)
- Test components, hooks, and utility functions
- Mock API calls using axios-mock-adapter or similar

## CI/CD

The project uses GitHub Actions:

- **Pull Requests**: Build and validate Docker images (`.github/workflows/docker-pr.yml`)
- **Main Branch**: Build, tag, and push images to GHCR (`.github/workflows/docker-main.yml`)
- **Dev Container**: Build devcontainer image (`.github/workflows/devcontainer.yml`)

Published images are available at:
- `ghcr.io/stuartleeks/fuzzy-fishstick/backend:latest`
- `ghcr.io/stuartleeks/fuzzy-fishstick/frontend:latest`
- `ghcr.io/stuartleeks/fuzzy-fishstick/devcontainer:latest`

## Development Workflow

1. Open the project in VS Code
2. Use the Dev Container (recommended) or set up local environment
3. Make changes in focused branches
4. Test locally using development servers
5. Lint your code before committing
6. Create pull requests for review
7. CI will validate Docker builds

## Security Considerations

- **Do not commit secrets** or credentials
- **Validate all user input** on the backend before processing
- **Sanitize data** when displaying in the UI to prevent XSS
- The in-memory storage means no persistence - acceptable for this demo app
- CORS is wide open (`*`) - suitable for development, but consider restrictions for production

## Getting Help

- Read the `README.md` for setup instructions
- Check the `Makefile` for available commands
- Review existing code patterns in `main.go` and `App.tsx`
- API documentation is in the README under "API Endpoints"

## Summary for Copilot

When working on this repository:
- **Always run linters** before finalizing changes (`npm run lint` for frontend)
- **Test locally** using `make backend` and `make frontend` or `npm run dev` and `go run main.go`
- **Follow TypeScript strict mode** - no implicit any, check array bounds
- **Use array for AssignedTo** field, not a single string
- **Validate input on backend** with clear error messages
- **Follow existing patterns** - look at similar code before adding new features
- **Keep it simple** - this is a demo app, avoid over-engineering
- **Docker builds must pass** - CI will validate
