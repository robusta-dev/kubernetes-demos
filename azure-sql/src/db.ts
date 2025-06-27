import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

export const dbConfig: sql.config = {
  server: process.env.AZURE_SQL_SERVER + '.database.windows.net' || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USERNAME || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: parseInt(process.env.AZURE_SQL_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log('Connected to Azure SQL Database');
  }
  return pool;
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Disconnected from Azure SQL Database');
  }
}