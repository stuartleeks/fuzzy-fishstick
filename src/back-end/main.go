package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// AuthConfig holds authentication configuration
type AuthConfig struct {
	Mode             string   // "dev" or "prod"
	AllowedUsers     []string // List of allowed user emails
	TenantID         string   // Entra ID tenant ID (for prod)
	ClientID         string   // Entra ID client ID (for prod)
	DevSecret        string   // Secret for dev mode JWT signing
	oidcVerifier     *oidc.IDTokenVerifier
}

var authConfig *AuthConfig

// MockUser represents a test user for development mode
type MockUser struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Sub   string `json:"sub"`
}

var mockUsers = []MockUser{
	{Email: "alice@example.com", Name: "Alice Smith", Sub: "alice"},
	{Email: "bob@example.com", Name: "Bob Jones", Sub: "bob"},
	{Email: "charlie@example.com", Name: "Charlie Brown", Sub: "charlie"},
}

// RecurrencePattern defines how a to-do item recurs
type RecurrencePattern struct {
	Frequency  string   `json:"frequency"`  // "daily", "weekly", "monthly"
	Interval   int      `json:"interval"`   // Every N days/weeks/months
	DaysOfWeek []string `json:"daysOfWeek"` // For weekly: ["Monday", "Wednesday", etc.]
}

// TodoItem represents a to-do item
type TodoItem struct {
	ID              int                `json:"id"`
	Title           string             `json:"title"`
	Description     string             `json:"description"`
	AssignedTo      []string           `json:"assignedTo"`
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
	AssignedTo  []string           `json:"assignedTo"`
	Pattern     RecurrencePattern  `json:"pattern"`
	StartDate   time.Time          `json:"startDate"`
	CreatedAt   time.Time          `json:"createdAt"`
}

// Store holds all data
type Store struct {
	mu                 sync.RWMutex
	todos              map[int]*TodoItem
	recurringDefs      map[int]*RecurringItemDefinition
	nextTodoID         int
	nextRecurringID    int
}

var store = &Store{
	todos:           make(map[int]*TodoItem),
	recurringDefs:   make(map[int]*RecurringItemDefinition),
	nextTodoID:      1,
	nextRecurringID: 1,
}

func main() {
	// Load .env file if it exists (optional, no error if file doesn't exist)
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found or error loading it (this is fine): %v", err)
	} else {
		log.Println("Loaded environment variables from .env file")
	}

	// Initialize authentication configuration
	if err := initAuthConfig(); err != nil {
		log.Fatalf("Failed to initialize auth config: %v", err)
	}

	r := mux.NewRouter()

	// Enable CORS
	r.Use(corsMiddleware)

	// Auth endpoints (public)
	r.HandleFunc("/api/auth/config", getAuthConfig).Methods("GET")
	r.HandleFunc("/api/auth/me", authMiddleware(getCurrentUser)).Methods("GET")
	
	// Dev mode OAuth2 endpoints
	if authConfig.Mode == "dev" {
		r.HandleFunc("/api/auth/dev/authorize", devAuthorize).Methods("GET")
		r.HandleFunc("/api/auth/dev/token", devToken).Methods("POST")
		r.HandleFunc("/api/auth/dev/userinfo", devUserInfo).Methods("GET")
		r.HandleFunc("/.well-known/openid-configuration", devOpenIDConfig).Methods("GET")
	}

	// Protected Todo routes
	r.HandleFunc("/api/todos", authMiddleware(getTodos)).Methods("GET")
	r.HandleFunc("/api/todos", authMiddleware(createTodo)).Methods("POST")
	r.HandleFunc("/api/todos/{id}", authMiddleware(updateTodo)).Methods("PUT")
	r.HandleFunc("/api/todos/{id}", authMiddleware(deleteTodo)).Methods("DELETE")
	r.HandleFunc("/api/todos/reorder", authMiddleware(reorderTodos)).Methods("POST")
	r.HandleFunc("/api/todos/{id}/convert-recurring", authMiddleware(convertTodoRecurring)).Methods("POST")

	// Protected Recurring item routes
	r.HandleFunc("/api/recurring", authMiddleware(getRecurringDefs)).Methods("GET")
	r.HandleFunc("/api/recurring", authMiddleware(createRecurringDef)).Methods("POST")
	r.HandleFunc("/api/recurring/{id}", authMiddleware(updateRecurringDef)).Methods("PUT")
	r.HandleFunc("/api/recurring/{id}", authMiddleware(deleteRecurringDef)).Methods("DELETE")

	port := 8080
	log.Printf("Starting server on port %d with auth mode: %s", port, authConfig.Mode)
	if authConfig.Mode == "dev" {
		log.Printf("Dev mode users: %v", mockUsers)
	}
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), r))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// initAuthConfig initializes authentication configuration from environment variables
func initAuthConfig() error {
	authConfig = &AuthConfig{
		Mode:      getEnv("AUTH_MODE", "dev"),
		TenantID:  getEnv("ENTRA_TENANT_ID", ""),
		ClientID:  getEnv("ENTRA_CLIENT_ID", ""),
		DevSecret: getEnv("DEV_AUTH_SECRET", generateSecret()),
	}

	// Parse allowed users from environment
	allowedUsersStr := getEnv("ALLOWED_USERS", "alice@example.com,bob@example.com")
	authConfig.AllowedUsers = strings.Split(allowedUsersStr, ",")
	for i := range authConfig.AllowedUsers {
		authConfig.AllowedUsers[i] = strings.TrimSpace(authConfig.AllowedUsers[i])
	}

	// Initialize OIDC verifier for production mode
	if authConfig.Mode == "prod" {
		if authConfig.TenantID == "" || authConfig.ClientID == "" {
			return fmt.Errorf("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required in production mode")
		}

		issuer := fmt.Sprintf("https://login.microsoftonline.com/%s/v2.0", authConfig.TenantID)
		provider, err := oidc.NewProvider(context.Background(), issuer)
		if err != nil {
			return fmt.Errorf("failed to create OIDC provider: %w", err)
		}

		authConfig.oidcVerifier = provider.Verifier(&oidc.Config{
			ClientID: authConfig.ClientID,
		})
	}

	log.Printf("Auth configuration: mode=%s, allowed_users=%v", authConfig.Mode, authConfig.AllowedUsers)
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func generateSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("Failed to generate random secret: %v", err)
	}
	return base64.URLEncoding.EncodeToString(b)
}

// authMiddleware validates JWT tokens and checks user authorization
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		var email string
		var err error

		if authConfig.Mode == "dev" {
			email, err = validateDevToken(tokenString)
		} else {
			email, err = validateProdToken(r.Context(), tokenString)
		}

		if err != nil {
			log.Printf("Token validation failed: %v", err)
			http.Error(w, fmt.Sprintf("Invalid token: %v", err), http.StatusUnauthorized)
			return
		}

		// Check if user is in allowed list
		if !isUserAllowed(email) {
			log.Printf("User not authorized: %s", email)
			http.Error(w, "User not authorized to access this application", http.StatusForbidden)
			return
		}

		// Add user email to context for downstream handlers
		ctx := context.WithValue(r.Context(), "userEmail", email)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func validateDevToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(authConfig.DevSecret), nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if email, ok := claims["email"].(string); ok {
			return email, nil
		}
		return "", fmt.Errorf("email claim not found")
	}

	return "", fmt.Errorf("invalid token")
}

func validateProdToken(ctx context.Context, tokenString string) (string, error) {
	idToken, err := authConfig.oidcVerifier.Verify(ctx, tokenString)
	if err != nil {
		return "", fmt.Errorf("failed to verify token: %w", err)
	}

	var claims struct {
		Email string `json:"email"`
	}

	if err := idToken.Claims(&claims); err != nil {
		return "", fmt.Errorf("failed to parse claims: %w", err)
	}

	if claims.Email == "" {
		return "", fmt.Errorf("email claim not found in token")
	}

	return claims.Email, nil
}

func isUserAllowed(email string) bool {
	for _, allowedEmail := range authConfig.AllowedUsers {
		if strings.EqualFold(email, allowedEmail) {
			return true
		}
	}
	return false
}

// Auth API endpoints

func getAuthConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"mode":         authConfig.Mode,
		"allowedUsers": authConfig.AllowedUsers,
	}

	if authConfig.Mode == "prod" {
		config["tenantId"] = authConfig.TenantID
		config["clientId"] = authConfig.ClientID
	} else {
		config["authority"] = fmt.Sprintf("http://localhost:8080")
		config["clientId"] = "dev-client-id"
		config["users"] = mockUsers
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func getCurrentUser(w http.ResponseWriter, r *http.Request) {
	email := r.Context().Value("userEmail").(string)
	
	response := map[string]string{
		"email": email,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Dev mode OAuth2 endpoints

func devAuthorize(w http.ResponseWriter, r *http.Request) {
	// In a real OAuth2 flow, this would present a login form
	// For dev mode, we'll auto-approve with a mock user
	redirectURI := r.URL.Query().Get("redirect_uri")
	state := r.URL.Query().Get("state")

	if redirectURI == "" {
		http.Error(w, "redirect_uri is required", http.StatusBadRequest)
		return
	}

	// Generate a mock authorization code
	code := base64.URLEncoding.EncodeToString([]byte(fmt.Sprintf("code-%d", time.Now().Unix())))

	// Redirect back with code
	redirectURL := fmt.Sprintf("%s?code=%s&state=%s", redirectURI, code, state)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func devToken(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	grantType := r.FormValue("grant_type")
	if grantType != "authorization_code" {
		http.Error(w, "Unsupported grant_type", http.StatusBadRequest)
		return
	}

	// Use first mock user by default
	user := mockUsers[0]
	
	// Check if a specific user was requested (via username parameter)
	if username := r.FormValue("username"); username != "" {
		for _, u := range mockUsers {
			if u.Sub == username {
				user = u
				break
			}
		}
	}

	// Generate JWT access token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.Sub,
		"email": user.Email,
		"name":  user.Name,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString([]byte(authConfig.DevSecret))
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"access_token": tokenString,
		"token_type":   "Bearer",
		"expires_in":   86400,
		"id_token":     tokenString, // Same as access token for dev mode
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func devUserInfo(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing authorization header", http.StatusUnauthorized)
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		http.Error(w, "Invalid authorization header", http.StatusUnauthorized)
		return
	}

	email, err := validateDevToken(parts[1])
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Find the user
	var user *MockUser
	for _, u := range mockUsers {
		if u.Email == email {
			user = &u
			break
		}
	}

	if user == nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func devOpenIDConfig(w http.ResponseWriter, r *http.Request) {
	baseURL := fmt.Sprintf("http://%s", r.Host)
	
	config := map[string]interface{}{
		"issuer":                 baseURL,
		"authorization_endpoint": baseURL + "/api/auth/dev/authorize",
		"token_endpoint":         baseURL + "/api/auth/dev/token",
		"userinfo_endpoint":      baseURL + "/api/auth/dev/userinfo",
		"jwks_uri":               baseURL + "/api/auth/dev/jwks",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
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
	sort.Slice(todos, func(i, j int) bool {
		return todos[i].Position < todos[j].Position
	})

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

	// Validate todo item
	if err := validateTodoItem(&todo); err != nil {
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

	// Validate todo item
	if err := validateTodoItem(&updates); err != nil {
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

// convertTodoRecurring converts a todo to/from recurring
func convertTodoRecurring(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var request struct {
		ToRecurring bool              `json:"toRecurring"`
		Pattern     RecurrencePattern `json:"pattern"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate pattern if converting to recurring
	if request.ToRecurring {
		if err := validateRecurrencePattern(request.Pattern); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	todo, exists := store.todos[id]
	if !exists {
		http.Error(w, "Todo not found", http.StatusNotFound)
		return
	}

	if request.ToRecurring {
		// Convert to recurring item
		// Create a recurring definition
		def := &RecurringItemDefinition{
			ID:          store.nextRecurringID,
			Title:       todo.Title,
			Description: todo.Description,
			AssignedTo:  todo.AssignedTo,
			Pattern:     request.Pattern,
			StartDate:   time.Now(),
			CreatedAt:   time.Now(),
		}
		store.nextRecurringID++
		store.recurringDefs[def.ID] = def

		// Update the todo to be recurring
		todo.IsRecurring = true
		todo.RecurrenceID = &def.ID
		nextDueDate := calculateNextDueDate(def.StartDate, def.Pattern)
		todo.DueDate = &nextDueDate
	} else {
		// Convert from recurring to one-off
		todo.IsRecurring = false
		if todo.RecurrenceID != nil {
			// Optionally delete the recurring definition if this was the only instance
			// For now, just unlink it
			todo.RecurrenceID = nil
		}
		// Keep the current due date or clear it
		todo.DueDate = nil
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(todo)
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

	// Validate recurring definition
	if err := validateRecurringDefinition(&def); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	def.ID = store.nextRecurringID
	store.nextRecurringID++
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

	// Validate recurring definition
	if err := validateRecurringDefinition(&updates); err != nil {
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

// Validation functions

// validateRecurrencePattern validates a recurrence pattern
func validateRecurrencePattern(pattern RecurrencePattern) error {
	// Validate frequency
	validFrequencies := map[string]bool{
		"daily":   true,
		"weekly":  true,
		"monthly": true,
	}
	if !validFrequencies[pattern.Frequency] {
		return fmt.Errorf("invalid frequency: must be 'daily', 'weekly', or 'monthly'")
	}

	// Validate interval
	if pattern.Interval < 1 {
		return fmt.Errorf("interval must be at least 1")
	}

	// Validate days of week for weekly frequency
	if pattern.Frequency == "weekly" && len(pattern.DaysOfWeek) > 0 {
		validDays := map[string]bool{
			"Sunday": true, "Monday": true, "Tuesday": true, "Wednesday": true,
			"Thursday": true, "Friday": true, "Saturday": true,
		}
		for _, day := range pattern.DaysOfWeek {
			if !validDays[day] {
				return fmt.Errorf("invalid day of week: %s", day)
			}
		}
	}

	return nil
}

// validateTodoItem validates a todo item
func validateTodoItem(todo *TodoItem) error {
	// Validate title
	if todo.Title == "" {
		return fmt.Errorf("title is required")
	}

	return nil
}

// validateRecurringDefinition validates a recurring item definition
func validateRecurringDefinition(def *RecurringItemDefinition) error {
	// Validate title
	if def.Title == "" {
		return fmt.Errorf("title is required")
	}

	// Validate pattern
	if err := validateRecurrencePattern(def.Pattern); err != nil {
		return fmt.Errorf("invalid pattern: %w", err)
	}

	return nil
}

// calculateNextDueDate calculates the next due date based on a pattern
func calculateNextDueDate(startDate time.Time, pattern RecurrencePattern) time.Time {
	now := time.Now()
	nextDate := startDate

	// For weekly recurrence with specific days of week
	if pattern.Frequency == "weekly" && len(pattern.DaysOfWeek) > 0 {
		return calculateNextWeeklyDate(now, pattern.DaysOfWeek, pattern.Interval)
	}

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

// calculateNextWeeklyDate finds the next occurrence based on specific days of week
func calculateNextWeeklyDate(from time.Time, daysOfWeek []string, interval int) time.Time {
	// Map day names to time.Weekday
	dayMap := map[string]time.Weekday{
		"Sunday":    time.Sunday,
		"Monday":    time.Monday,
		"Tuesday":   time.Tuesday,
		"Wednesday": time.Wednesday,
		"Thursday":  time.Thursday,
		"Friday":    time.Friday,
		"Saturday":  time.Saturday,
	}

	// Convert string days to weekday numbers
	targetDays := make(map[time.Weekday]bool)
	for _, day := range daysOfWeek {
		if wd, ok := dayMap[day]; ok {
			targetDays[wd] = true
		}
	}

	if len(targetDays) == 0 {
		// Fallback to regular weekly if no valid days
		return from.AddDate(0, 0, 7*interval)
	}

	// For simplicity with interval=1, just find the next matching day
	// For interval>1, we'd need more complex logic
	nextDate := from.AddDate(0, 0, 1)
	
	for i := 0; i < 14; i++ { // Check up to 2 weeks ahead
		if targetDays[nextDate.Weekday()] {
			return nextDate
		}
		nextDate = nextDate.AddDate(0, 0, 1)
	}

	// Fallback
	return from.AddDate(0, 0, 7*interval)
}
