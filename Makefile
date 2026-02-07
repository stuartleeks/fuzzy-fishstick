.PHONY: frontend backend install-frontend run

help: ## show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%s\033[0m|%s\n", $$1, $$2}' \
	| column -t -s '|'

install-frontend: ## Install front-end dependencies	
	cd src/front-end && npm install


frontend: ## Run the front-end dev server
	cd src/front-end && npm run dev

backend: ## Run the back-end server
	cd src/back-end && go run main.go


run: ## Run both front-end and back-end concurrently
	$(MAKE) backend & $(MAKE) frontend
