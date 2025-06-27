
# Azure SQL Stress Testing Application

This Node.js TypeScript application simulates a shop/e-commerce system and provides stress testing capabilities for Azure SQL Database. It's designed to generate various database load patterns that will trigger alerts and monitoring in the Azure SQL portal.

## Features

- **Shop Application**: Complete e-commerce simulation with users, products, categories, and orders
- **Database Migrations**: Automated schema management using Postgrator
- **Stress Testing**: Multiple scenarios to test different aspects of Azure SQL performance
- **REST API**: Full CRUD operations for shop entities
- **TypeScript**: Type-safe development with modern ES modules

## Prerequisites

- Node.js 18+ 
- Azure SQL Database instance
- npm or yarn package manager

## Setup

1. **Clone and Install Dependencies**
   ```bash
   cd azure-sql
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Azure SQL Database credentials:
   ```
   AZURE_SQL_SERVER=your-server.database.windows.net
   AZURE_SQL_DATABASE=your-database
   AZURE_SQL_USERNAME=your-username
   AZURE_SQL_PASSWORD=your-password
   AZURE_SQL_PORT=1433
   NODE_ENV=development
   PORT=3000
   ```

3. **Run Database Migrations**
   ```bash
   npm run build
   npm run migrate
   ```

4. **Start the Application**
   ```bash
   npm run dev
   ```

## API Endpoints

### Shop Operations
- `GET /health` - Health check
- `GET /api/users` - List all users
- `POST /api/users` - Create a new user
- `GET /api/products` - List all products
- `POST /api/orders` - Create a new order
- `GET /api/orders/:userId` - Get orders for a specific user

### Stress Testing
- `GET /stress-test/scenarios` - List available stress test scenarios
- `POST /stress-test/start` - Start a stress test
- `POST /stress-test/stop` - Stop running stress test

## Stress Test Scenarios

The application includes several stress testing scenarios designed to trigger Azure SQL alerts:

### 1. High CPU (`high-cpu`)
- Executes complex mathematical computations
- Generates recursive queries with calculations
- **Triggers**: High CPU utilization alerts

### 2. High I/O (`high-io`)
- Performs large data insert/select/delete operations
- Creates and manipulates large temporary tables
- **Triggers**: High I/O utilization alerts

### 3. Deadlock (`deadlock`)
- Creates intentional deadlock scenarios
- Multiple transactions accessing resources in different orders
- **Triggers**: Deadlock detection alerts

### 4. Blocking (`blocking`)
- Long-running transactions that block other operations
- Simulates real-world blocking scenarios
- **Triggers**: Blocking query alerts

### 5. Memory Pressure (`memory-pressure`)
- Executes queries that consume large amounts of memory
- Cross joins and large result sets
- **Triggers**: Memory utilization alerts

### 6. Connection Flood (`connection-flood`)
- Creates many concurrent database connections
- Tests connection pool limits
- **Triggers**: Connection count alerts

### 7. Slow Queries (`slow-queries`)
- Intentionally inefficient queries
- Complex joins without proper indexing
- **Triggers**: Slow query performance alerts

### 8. Frequent Writes (`frequent-writes`)
- High-frequency insert/update/delete operations
- Simulates heavy transactional workload
- **Triggers**: Transaction log growth alerts

## Usage Examples

### Start a stress test:
```bash
curl -X POST http://localhost:3000/stress-test/start \
  -H "Content-Type: application/json" \
  -d '{"scenario": "high-cpu", "duration": 300}'
```

### Create a user:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password_hash": "hashed_password",
    "first_name": "Test",
    "last_name": "User"
  }'
```

### Create an order:
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ],
    "shipping_address": "123 Main St, City, State, ZIP"
  }'
```

## Database Schema

The application creates the following tables:
- `users` - User accounts
- `categories` - Product categories
- `products` - Product catalog
- `orders` - Customer orders
- `order_items` - Order line items

## Docker Support

Build and run with Docker:
```bash
docker build -t azure-sql-stress-test .
docker run -p 3000:3000 --env-file .env azure-sql-stress-test
```

## Monitoring

The stress tests are designed to trigger various Azure SQL Database alerts:
- CPU utilization
- I/O utilization
- Memory usage
- Connection count
- Deadlocks
- Blocking queries
- Slow query performance
- Transaction log growth

Monitor these metrics in the Azure portal during stress testing to observe the impact.

## Kubernetes Deployment

```bash
kubectl apply -f ./manifest.yaml
```

## Development

### Build the application:
```bash
npm run build
```

### Run in development mode:
```bash
npm run dev
```

### Add new migrations:
Create new migration files in the `migrations/` directory following the naming convention:
- `XXX.do.migration-name.sql` - Forward migration
- `XXX.undo.migration-name.sql` - Rollback migration

Where XXX is a sequential number (001, 002, etc.).
