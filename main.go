package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// RecurrencePattern defines how a to-do item recurs
type RecurrencePattern struct {
	Frequency string `json:"frequency"` // "daily", "weekly", "monthly"
	Interval  int    `json:"interval"`  // Every N days/weeks/months
}

// TodoItem represents a to-do item
type TodoItem struct {
	ID              int                `json:"id"`
	Title           string             `json:"title"`
	Description     string             `json:"description"`
	AssignedTo      string             `json:"assignedTo"`
	Completed       bool               `json:"completed"`
	Position        int                `json:"position"`
	IsRecurring     bool               `json:"isRecurring"`
	RecurrenceID    *int               `json:"recurrenceId,omitempty"`
	DueDate         *time.Time         `json:"dueDate,omitempty"`
	CompletedAt     *time.Time         `json:"completedAt,omitempty"`
	CreatedAt       time.Time          `json:"createdAt"`
}

// RecurringItemDefinition represents a recurring to-do item definition
type RecurringItemDefinition struct {
	ID          int                `json:"id"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	AssignedTo  string             `json:"assignedTo"`
	Pattern     RecurrencePattern  `json:"pattern"`
	StartDate   time.Time          `json:"startDate"`
	CreatedAt   time.Time          `json:"createdAt"`
}

// Store holds all data
type Store struct {
	mu                  sync.RWMutex
	todos               map[int]*TodoItem
	recurringDefs       map[int]*RecurringItemDefinition
	nextTodoID          int
	nextRecurringDefID  int
}

var store = &Store{
	todos:         make(map[int]*TodoItem),
	recurringDefs: make(map[int]*RecurringItemDefinition),
	nextTodoID:    1,
	nextRecurringDefID: 1,
}

func main() {
	r := mux.NewRouter()

	// Enable CORS
	r.Use(corsMiddleware)

	// Todo routes
	r.HandleFunc("/api/todos", getTodos).Methods("GET")
	r.HandleFunc("/api/todos", createTodo).Methods("POST")
	r.HandleFunc("/api/todos/{id}", updateTodo).Methods("PUT")
	r.HandleFunc("/api/todos/{id}", deleteTodo).Methods("DELETE")
	r.HandleFunc("/api/todos/reorder", reorderTodos).Methods("POST")

	// Recurring item routes
	r.HandleFunc("/api/recurring", getRecurringDefs).Methods("GET")
	r.HandleFunc("/api/recurring", createRecurringDef).Methods("POST")
	r.HandleFunc("/api/recurring/{id}", updateRecurringDef).Methods("PUT")
	r.HandleFunc("/api/recurring/{id}", deleteRecurringDef).Methods("DELETE")

	port := 8080
	log.Printf("Starting server on port %d...", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), r))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getTodos returns all to-do items sorted by position
func getTodos(w http.ResponseWriter, r *http.Request) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	todos := make([]*TodoItem, 0, len(store.todos))
	for _, todo := range store.todos {
		todos = append(todos, todo)
	}

	// Sort by position
	for i := 0; i < len(todos)-1; i++ {
		for j := i + 1; j < len(todos); j++ {
			if todos[i].Position > todos[j].Position {
				todos[i], todos[j] = todos[j], todos[i]
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(todos)
}

// createTodo creates a new to-do item
func createTodo(w http.ResponseWriter, r *http.Request) {
	var todo TodoItem
	if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	todo.ID = store.nextTodoID
	store.nextTodoID++
	todo.CreatedAt = time.Now()

	// Set position to end if not specified
	if todo.Position == 0 {
		todo.Position = len(store.todos)
	}

	store.todos[todo.ID] = &todo

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(todo)
}

// updateTodo updates an existing to-do item
func updateTodo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var updates TodoItem
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	todo, exists := store.todos[id]
	if !exists {
		http.Error(w, "Todo not found", http.StatusNotFound)
		return
	}

	// Update fields
	todo.Title = updates.Title
	todo.Description = updates.Description
	todo.AssignedTo = updates.AssignedTo
	todo.Completed = updates.Completed
	if updates.Completed && todo.CompletedAt == nil {
		now := time.Now()
		todo.CompletedAt = &now
	}
	if updates.DueDate != nil {
		todo.DueDate = updates.DueDate
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(todo)
}

// deleteTodo deletes a to-do item
func deleteTodo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	if _, exists := store.todos[id]; !exists {
		http.Error(w, "Todo not found", http.StatusNotFound)
		return
	}

	delete(store.todos, id)
	w.WriteHeader(http.StatusNoContent)
}

// reorderTodos updates the position of multiple to-do items
func reorderTodos(w http.ResponseWriter, r *http.Request) {
	var order []struct {
		ID       int `json:"id"`
		Position int `json:"position"`
	}

	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	for _, item := range order {
		if todo, exists := store.todos[item.ID]; exists {
			todo.Position = item.Position
		}
	}

	w.WriteHeader(http.StatusOK)
}

// getRecurringDefs returns all recurring item definitions
func getRecurringDefs(w http.ResponseWriter, r *http.Request) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	defs := make([]*RecurringItemDefinition, 0, len(store.recurringDefs))
	for _, def := range store.recurringDefs {
		defs = append(defs, def)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(defs)
}

// createRecurringDef creates a new recurring item definition and its first instance
func createRecurringDef(w http.ResponseWriter, r *http.Request) {
	var def RecurringItemDefinition
	if err := json.NewDecoder(r.Body).Decode(&def); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	def.ID = store.nextRecurringDefID
	store.nextRecurringDefID++
	def.CreatedAt = time.Now()

	store.recurringDefs[def.ID] = &def

	// Create the first instance of this recurring item
	nextDueDate := calculateNextDueDate(def.StartDate, def.Pattern)
	todo := &TodoItem{
		ID:           store.nextTodoID,
		Title:        def.Title,
		Description:  def.Description,
		AssignedTo:   def.AssignedTo,
		IsRecurring:  true,
		RecurrenceID: &def.ID,
		DueDate:      &nextDueDate,
		Position:     len(store.todos),
		CreatedAt:    time.Now(),
	}
	store.nextTodoID++
	store.todos[todo.ID] = todo

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(def)
}

// updateRecurringDef updates a recurring item definition
func updateRecurringDef(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var updates RecurringItemDefinition
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	def, exists := store.recurringDefs[id]
	if !exists {
		http.Error(w, "Recurring definition not found", http.StatusNotFound)
		return
	}

	def.Title = updates.Title
	def.Description = updates.Description
	def.AssignedTo = updates.AssignedTo
	def.Pattern = updates.Pattern

	// Update all related todo items that haven't been completed
	for _, todo := range store.todos {
		if todo.RecurrenceID != nil && *todo.RecurrenceID == id && !todo.Completed {
			todo.Title = def.Title
			todo.Description = def.Description
			todo.AssignedTo = def.AssignedTo
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(def)
}

// deleteRecurringDef deletes a recurring item definition
func deleteRecurringDef(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	if _, exists := store.recurringDefs[id]; !exists {
		http.Error(w, "Recurring definition not found", http.StatusNotFound)
		return
	}

	delete(store.recurringDefs, id)

	// Remove recurrence link from related todos
	for _, todo := range store.todos {
		if todo.RecurrenceID != nil && *todo.RecurrenceID == id {
			todo.RecurrenceID = nil
			todo.IsRecurring = false
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// calculateNextDueDate calculates the next due date based on a pattern
func calculateNextDueDate(startDate time.Time, pattern RecurrencePattern) time.Time {
	now := time.Now()
	nextDate := startDate

	for nextDate.Before(now) {
		switch pattern.Frequency {
		case "daily":
			nextDate = nextDate.AddDate(0, 0, pattern.Interval)
		case "weekly":
			nextDate = nextDate.AddDate(0, 0, 7*pattern.Interval)
		case "monthly":
			nextDate = nextDate.AddDate(0, pattern.Interval, 0)
		}
	}

	return nextDate
}
