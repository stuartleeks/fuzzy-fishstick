# fuzzy-fishstick

A To-Do List application with a React frontend and Go backend API.

## Features

- ✅ Add, edit, and delete to-do items
- 👤 Assign items to people
- 🔄 Support for one-off and recurring items
- ✓ Mark items as completed
- 🔀 Drag and drop to reorder items
- 📱 Responsive design

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

## Prerequisites

- Go 1.24 or higher
- Node.js 24.x or higher
- npm 11.x or higher

**Or use the Dev Container:**
- Docker
- VS Code with Remote - Containers extension

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

2. Install Go dependencies:
   ```bash
   go mod tidy
   ```

3. Run the API server:
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

## License

MIT
