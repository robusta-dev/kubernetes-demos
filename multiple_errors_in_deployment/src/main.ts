#!/usr/bin/env node

const SHOW_LOGIN_ERRORS = process.env.SHOW_LOGIN_ERRORS == "true"
const LOGIN_ERRORS_FREQUENCY = parseInt(process.env.LOGIN_ERRORS_FREQUENCY, 10) || 100 // every 100 lines by default

const SHOW_DB_ERRORS = process.env.SHOW_DB_ERRORS == "true"
const DB_ERRORS_FREQUENCY = parseInt(process.env.DB_ERRORS_FREQUENCY, 10) || 100 // every 100 lines by default

// Sample data for realistic logs
const services = ['auth-service', 'user-service', 'payment-service', 'order-service', 'inventory-service', 'notification-service'];
const endpoints = ['/api/v1/users', '/api/v1/orders', '/api/v1/payments', '/api/v1/inventory', '/api/v1/auth/login', '/api/v1/auth/logout'];
const userIds = Array.from({length: 100}, (_, i) => `user_${1000 + i}`);
const ipAddresses = Array.from({length: 50}, () => `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`);
const logLevels = ['INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'DEBUG', 'TRACE'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const statusCodes = [200, 201]

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTimestamp(): string {
  return new Date().toISOString();
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}
function generateInteger(max:number = 1000000): number {
  return Math.round(Math.random() * max)
}

function generateLogEntry(): string {
  const timestamp = generateTimestamp();
  const level = getRandomElement(logLevels);
  const service = getRandomElement(services);
  const requestId = generateRequestId();
  
  const logTypes = [
    // HTTP requests
    () => {
      const method = getRandomElement(httpMethods);
      const endpoint = getRandomElement(endpoints);
      const statusCode = getRandomElement(statusCodes);
      const responseTime = Math.floor(Math.random() * 2000) + 10;
      const ip = getRandomElement(ipAddresses);
      const userId = getRandomElement(userIds);
      return `${timestamp} [${level}] ${service} - ${method} ${endpoint} - Status: ${statusCode} - Response time: ${responseTime}ms - IP: ${ip} - User: ${userId} - RequestID: ${requestId}`;
    },
    
    // Database operations
    () => {
      const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
      const tables = ['users', 'orders', 'payments', 'products', 'sessions', 'audit_logs'];
      const operation = getRandomElement(operations);
      const table = getRandomElement(tables);
      const executionTime = Math.floor(Math.random() * 500) + 1;
      const rowsAffected = Math.floor(Math.random() * 100);
      return `${timestamp} [${level}] ${service} - Database ${operation} on ${table} - Execution time: ${executionTime}ms - Rows affected: ${rowsAffected} - RequestID: ${requestId}`;
    },
    
    // Authentication events
    () => {
      const events = ['login_attempt', 'login_success', 'login_failed', 'logout', 'token_refresh', 'password_change'];
      const event = getRandomElement(events);
      const userId = getRandomElement(userIds);
      const ip = getRandomElement(ipAddresses);
      return `${timestamp} [${level}] ${service} - Auth event: ${event} - User: ${userId} - IP: ${ip} - RequestID: ${requestId}`;
    },
    
    // Business logic operations
    () => {
      const operations = [
        'order_created', 'payment_processed', 'inventory_updated', 'email_sent', 
        'cache_miss', 'cache_hit', 'webhook_sent', 'notification_queued'
      ];
      const operation = getRandomElement(operations);
      const processingTime = Math.floor(Math.random() * 1000) + 50;
      return `${timestamp} [${level}] ${service} - Operation: ${operation} - Processing time: ${processingTime}ms - RequestID: ${requestId}`;
    },

  ];
  
  const logGenerator = getRandomElement(logTypes);
  return logGenerator();
}

function generateLoginFailureError(): string {
  const timestamp = generateTimestamp();
  const requestId = generateRequestId();
  const service = 'auth-service';
  const userId = getRandomElement(userIds);
  const ip = getRandomElement(ipAddresses);
  const systemErrors = [
    'Identity provider certificate expired',
    'Failed to retrieve sessions from redis: TimeoutError',
  ];
  const error = getRandomElement(systemErrors);
  return `${timestamp} [ERROR] ${service} - Authentication system error for user ${userId} from ${ip} - Error: ${error} - RequestID: ${requestId}`;
}

function generatePostgreSQLQueryError(): string {
  const timestamp = generateTimestamp();
  const requestId = generateRequestId();
  const keyId = generateInteger();
  const service = getRandomElement(services);
  const userId = getRandomElement(userIds);
  const sqlErrors = [
    `syntax error at or near "SELCT" - Query: SELCT * FROM users WHERE id = ${keyId}`,
    `duplicate key value violates unique constraint "auth_permission_pkey" DETAIL: Key (id)=(${keyId}) already exists - Query: INSERT INTO auth_permission (id, user) VALUES (${keyId}, '${userId}')`,
  ];
  const error = getRandomElement(sqlErrors);
  return `${timestamp} [ERROR] ${service} - PostgreSQL query failed: ${error} - RequestID: ${requestId}`;
}


const loginErrorOffset = generateInteger(Math.max(LOGIN_ERRORS_FREQUENCY/2))
const dbErrorOffset = generateInteger(Math.max(DB_ERRORS_FREQUENCY/2))

async function generateLogs() {
  let iterationCount = 0;
  
  while (true) {
    let logEntry: string;
    
    if (SHOW_LOGIN_ERRORS && iterationCount > 0 && (iterationCount + loginErrorOffset) % LOGIN_ERRORS_FREQUENCY === 0) {
      console.log(generateLoginFailureError());
    }
    
    if (SHOW_DB_ERRORS && iterationCount > 0 && (iterationCount + dbErrorOffset) % DB_ERRORS_FREQUENCY === 0) {
      console.log(generatePostgreSQLQueryError());
    }

    console.log(generateLogEntry())
    
    iterationCount++;
    
    // Wait 10ms before next log
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nApplication interrupted by user. Shutting down now.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nApplication terminated. Shutting down now.');
  process.exit(0);
});

// Start continuous log generation
generateLogs().catch(error => {
  console.error(error);
  process.exit(1);
});