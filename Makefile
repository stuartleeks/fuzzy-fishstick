.PHONY: frontend backend install-frontend install-backend install-playwright install-deps run test test-ui test-headed docker-build-backend docker-build-frontend docker-build-all docker-run-backend docker-run-frontend

help: ## show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%s\033[0m|%s\n", $$1, $$2}' \
	| column -t -s '|'

install-frontend: ## Install front-end dependencies	
	cd src/front-end && npm install

install-backend: ## Install back-end dependencies
	cd src/back-end && go mod tidy

install-playwright: ## Install Playwright browsers
	cd src/front-end && npx playwright install --with-deps

install-deps: install-backend install-frontend install-playwright ## Install all dependencies (Go modules, npm packages, and Playwright browsers)


frontend: ## Run the front-end dev server
	cd src/front-end && npm run dev

backend: ## Run the back-end server
	cd src/back-end && go run main.go


run: ## Run both front-end and back-end concurrently
	$(MAKE) backend & $(MAKE) frontend

test: ## Run Playwright tests
	cd src/front-end && npm test

test-ui: ## Run Playwright tests in interactive UI mode
	cd src/front-end && npm run test:ui

test-headed: ## Run Playwright tests in headed mode (visible browser)
	cd src/front-end && npm run test:headed

docker-build-backend: ## Build backend Docker image
	docker build -t fuzzy-fishstick-backend:latest src/back-end

docker-build-frontend: ## Build frontend Docker image
	docker build -t fuzzy-fishstick-frontend:latest src/front-end

docker-build-all: ## Build all Docker images
	$(MAKE) docker-build-backend
	$(MAKE) docker-build-frontend

docker-run-backend: ## Run backend Docker container
	docker run -p 8080:8080 --name fuzzy-fishstick-backend fuzzy-fishstick-backend:latest

docker-run-frontend: ## Run frontend Docker container
	docker run -p 80:80 --name fuzzy-fishstick-frontend --link fuzzy-fishstick-backend:backend fuzzy-fishstick-frontend:latest

