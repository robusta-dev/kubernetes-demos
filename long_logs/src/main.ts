#!/usr/bin/env node

import { Command } from 'commander';
import { encoding_for_model } from 'tiktoken';

interface Config {
  model: string;
  targetTokens: number;
  logInterval: number;
}

const program = new Command();

program
  .name('long-logs-generator')
  .description('Generates extensive logs with PostgreSQL connection error for LLM testing')
  .version('1.0.0')
  .option('-m, --model <model>', 'Target LLM model (affects token estimation)', 'gpt-4')
  .option('-t, --tokens <tokens>', 'Target number of tokens to generate before error', '100000')
  .option('-i, --interval <ms>', 'Log interval in milliseconds', '100')
  .parse();

const options = program.opts();
const config: Config = {
  model: options.model,
  targetTokens: parseInt(options.tokens),
  logInterval: parseInt(options.interval)
};

// Initialize tiktoken encoder based on model
function getEncoder(model: string) {
  try {
    return encoding_for_model(model as any);
  } catch (error) {
    throw new Error(`Model '${model}' not supported by tiktoken, using gpt-4o encoding`)
  }
}

// Sample data for realistic logs
const services = ['auth-service', 'user-service', 'payment-service', 'order-service', 'inventory-service', 'notification-service'];
const endpoints = ['/api/v1/users', '/api/v1/orders', '/api/v1/payments', '/api/v1/inventory', '/api/v1/auth/login', '/api/v1/auth/logout'];
const userIds = Array.from({length: 100}, (_, i) => `user_${1000 + i}`);
const ipAddresses = Array.from({length: 50}, () => `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`);
const logLevels = ['INFO', 'DEBUG', 'TRACE'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTimestamp(syntheticTime: Date): string {
  return syntheticTime.toISOString();
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateLogEntry(syntheticTime: Date): string {
  const timestamp = generateTimestamp(syntheticTime);
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

let connectionAttempts = 0

function generatePostgreSQLError(syntheticTime: Date): string {
  const timestamp = generateTimestamp(syntheticTime);
  const requestId = generateRequestId();
  const service = getRandomElement(services);
  connectionAttempts ++
  
  const errorMessages = [
    `${timestamp} [ERROR] ${service} - Connection attempt ${connectionAttempts} failed - RequestID: ${requestId}`,
    `${timestamp} [ERROR] ${service} - PostgreSQL connection pool exhausted - Active connections: 100/100 - RequestID: ${requestId}`,
    `${timestamp} [ERROR] ${service} - Database connection timeout after 30s - Host: postgresql-primary.database.svc.cluster.local:5432 - RequestID: ${requestId}`,
    `${timestamp} [ERROR] ${service} - FATAL: sorry, too many clients already - Max connections: 100 - Current: 100 - RequestID: ${requestId}`,
    `${timestamp} [ERROR] ${service} - Connection refused by PostgreSQL server - Check if server is running and accepting connections - RequestID: ${requestId}`,
    `${timestamp} [ERROR] ${service} - Database query failed: connection to server at "postgresql-primary.database.svc.cluster.local" (10.96.0.15), port 5432 failed: FATAL: remaining connection slots are reserved for non-replication superuser connections - RequestID: ${requestId}`,
    `${timestamp} [CRITICAL] ${service} - Application shutting down due to database connectivity issues - Unable to establish connection after multiple retries - RequestID: ${requestId}`
  ];
  
  return errorMessages.join('\n');
}

async function generateLogs() {
  
  const encoder = getEncoder(config.model);
  const startTime = Date.now();
  
  let totalTokens = 0;
  let logCount = 0;
  let syntheticTime = new Date();
  
  console.log(`Generating logs until ${config.targetTokens} tokens...`);
  
  while (totalTokens < config.targetTokens) {
    // Generate a new log entry dynamically
    const logEntry = generateLogEntry(syntheticTime);
    console.log(logEntry);
    
    // Count tokens for this individual log entry + newline
    const entryTokens = encoder.encode(logEntry + '\n').length;
    totalTokens += entryTokens;
    logCount++;
    
    // Advance synthetic time by the interval
    syntheticTime = new Date(syntheticTime.getTime() + config.logInterval);
    
    if (logCount % 100 === 0) {
      const progress = (totalTokens / config.targetTokens * 100).toFixed(1);
      process.stderr.write(`\rProgress: ${progress}% - Log lines: ${logCount} - Tokens: ${totalTokens}`);
    }
  }
  
  process.stderr.write(`\nFinal: Log lines: ${logCount} - Tokens: ${totalTokens}\n`);
  encoder.free();
  
  // Clear progress line

  let finalErrorTime = new Date(syntheticTime.getTime() + (logCount * config.logInterval));
  console.log(generatePostgreSQLError(finalErrorTime));

  logCount ++;
  setInterval(() => {
  
    // Generate final PostgreSQL connection error with current synthetic time
    finalErrorTime = new Date(syntheticTime.getTime() + (logCount * config.logInterval));
  
    console.log(generatePostgreSQLError(finalErrorTime));

    logCount ++;
  }, 10_000)
  
  
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nLog generation interrupted by user.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nLog generation terminated.');
  process.exit(0);
});

// Start log generation
generateLogs().catch(error => {
  console.error('Error during log generation:', error);
  process.exit(1);
});