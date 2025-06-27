import sql from 'mssql';

export interface StressTestScenario {
  name: string;
  description: string;
}

export class StressTestService {
  private isRunning = false;
  private currentInterval: NodeJS.Timeout | null = null;

  constructor(private pool: sql.ConnectionPool) {}

  get isTestRunning(): boolean {
    return this.isRunning;
  }

  getAvailableScenarios(): StressTestScenario[] {
    return [
      {
        name: 'high-cpu',
        description: 'Generate high CPU usage with complex queries'
      },
      {
        name: 'high-io',
        description: 'Generate high I/O with large data operations'
      },
      {
        name: 'deadlock',
        description: 'Create deadlock situations'
      },
      {
        name: 'blocking',
        description: 'Create blocking queries'
      },
      {
        name: 'memory-pressure',
        description: 'Generate memory pressure with large result sets'
      },
      {
        name: 'connection-flood',
        description: 'Flood with many concurrent connections'
      },
      {
        name: 'slow-queries',
        description: 'Execute intentionally slow queries'
      },
      {
        name: 'frequent-writes',
        description: 'High-frequency write operations'
      }
    ];
  }

  async startStressTest(scenario: string, durationSeconds: number): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stress test is already running');
    }

    this.isRunning = true;
    console.log(`Starting stress test scenario: ${scenario} for ${durationSeconds} seconds`);

    const endTime = Date.now() + (durationSeconds * 1000);

    try {
      switch (scenario) {
        case 'high-cpu':
          await this.runHighCpuTest(endTime);
          break;
        case 'high-io':
          await this.runHighIoTest(endTime);
          break;
        case 'deadlock':
          await this.runDeadlockTest(endTime);
          break;
        case 'blocking':
          await this.runBlockingTest(endTime);
          break;
        case 'memory-pressure':
          await this.runMemoryPressureTest(endTime);
          break;
        case 'connection-flood':
          await this.runConnectionFloodTest(endTime);
          break;
        case 'slow-queries':
          await this.runSlowQueriesTest(endTime);
          break;
        case 'frequent-writes':
          await this.runFrequentWritesTest(endTime);
          break;
        default:
          throw new Error(`Unknown scenario: ${scenario}`);
      }
    } finally {
      this.isRunning = false;
    }
  }

  stopStressTest(): void {
    this.isRunning = false;
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    console.log('Stress test stopped');
  }

  private async runHighCpuTest(endTime: number): Promise<void> {
    while (this.isRunning && Date.now() < endTime) {
      try {
        await this.pool.request().query(`
          WITH NumberSeries AS (
            SELECT 1 as n
            UNION ALL
            SELECT n + 1
            FROM NumberSeries
            WHERE n < 10000
          )
          SELECT 
            n,
            n * n as square,
            SQRT(n) as sqrt_n,
            LOG(n) as log_n,
            SIN(n) as sin_n,
            COS(n) as cos_n
          FROM NumberSeries
          OPTION (MAXRECURSION 10000)
        `);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('High CPU test error:', error);
      }
    }
  }

  private async runHighIoTest(endTime: number): Promise<void> {
    while (this.isRunning && Date.now() < endTime) {
      try {
        if (!this.isRunning) break;
        
        await this.pool.request().query(`
          SELECT COUNT(*) FROM users WHERE id > 0
        `);

        if (!this.isRunning) break;

        await this.pool.request().query(`
          SELECT COUNT(*) FROM products WHERE price > 0
        `);

        if (!this.isRunning) break;

        await this.pool.request().query(`
          SELECT COUNT(*) FROM orders WHERE total_amount > 0
        `);

        if (!this.isRunning) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('High I/O test error:', error);
      }
    }
  }

  private async runDeadlockTest(endTime: number): Promise<void> {
    await this.createTestTables();

    while (this.isRunning && Date.now() < endTime) {
      try {
        if (!this.isRunning) break;
        
        const promises = [];
        
        for (let i = 0; i < 5; i++) {
          promises.push(this.executeDeadlockTransaction('table1', 'table2'));
          promises.push(this.executeDeadlockTransaction('table2', 'table1'));
        }

        await Promise.allSettled(promises);
        
        if (!this.isRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Deadlock test error:', error);
      }
    }
  }

  private async executeDeadlockTransaction(table1: string, table2: string): Promise<void> {
    const transaction = new sql.Transaction(this.pool);
    try {
      await transaction.begin();
      
      await transaction.request().query(`
        UPDATE ${table1} SET value = value + 1 WHERE id = 1
      `);
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      await transaction.request().query(`
        UPDATE ${table2} SET value = value + 1 WHERE id = 1
      `);
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
    }
  }

  private async runBlockingTest(endTime: number): Promise<void> {
    while (this.isRunning && Date.now() < endTime) {
      try {
        const longRunningPromise = this.pool.request().query(`
          BEGIN TRANSACTION
          UPDATE products SET stock_quantity = stock_quantity + 1 WHERE id = 1
          WAITFOR DELAY '00:00:05'
          COMMIT TRANSACTION
        `);

        const blockedPromises = [];
        for (let i = 0; i < 3; i++) {
          blockedPromises.push(
            this.pool.request().query(`
              UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = 1
            `)
          );
        }

        await Promise.allSettled([longRunningPromise, ...blockedPromises]);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Blocking test error:', error);
      }
    }
  }

  private async runMemoryPressureTest(endTime: number): Promise<void> {
    while (this.isRunning && Date.now() < endTime) {
      try {
        if (!this.isRunning) break;
        
        await this.pool.request().query(`
          SELECT 
            u1.id, u1.email, u1.first_name, u1.last_name,
            u2.id, u2.email, u2.first_name, u2.last_name,
            p1.name, p1.description, p1.price,
            p2.name, p2.description, p2.price,
            REPLICATE('X', 1000) as large_data
          FROM users u1
          CROSS JOIN users u2
          CROSS JOIN products p1
          CROSS JOIN products p2
          WHERE u1.id <= 10 AND u2.id <= 10 AND p1.id <= 5 AND p2.id <= 5
        `);
        
        if (!this.isRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Memory pressure test error:', error);
      }
    }
  }

  private async runConnectionFloodTest(endTime: number): Promise<void> {
    const connections: sql.ConnectionPool[] = [];
    
    try {
      while (this.isRunning && Date.now() < endTime) {
        const promises = [];
        
        for (let i = 0; i < 20; i++) {
          promises.push(this.createTemporaryConnection());
        }
        
        const newConnections = await Promise.allSettled(promises);
        newConnections.forEach(result => {
          if (result.status === 'fulfilled') {
            connections.push(result.value);
          }
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await Promise.allSettled(
          connections.splice(0, 10).map(conn => conn.close())
        );
      }
    } finally {
      await Promise.allSettled(
        connections.map(conn => conn.close())
      );
      this.isRunning = false;
    }
  }

  private async createTemporaryConnection(): Promise<sql.ConnectionPool> {
    const pool = new sql.ConnectionPool({
      server: process.env.AZURE_SQL_SERVER || '',
      database: process.env.AZURE_SQL_DATABASE || '',
      user: process.env.AZURE_SQL_USERNAME || '',
      password: process.env.AZURE_SQL_PASSWORD || '',
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
      }
    });
    
    await pool.connect();
    await pool.request().query('SELECT 1');
    return pool;
  }

  private async runSlowQueriesTest(endTime: number): Promise<void> {
    while (this.isRunning && Date.now() < endTime) {
      try {
        await this.pool.request().query(`
          SELECT 
            u.id, u.email, u.first_name, u.last_name,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_spent,
            AVG(o.total_amount) as avg_order
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          CROSS JOIN (SELECT TOP 10 id, name FROM products) p
          GROUP BY u.id, u.email, u.first_name, u.last_name
          ORDER BY total_spent DESC
        `);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('Slow queries test error:', error);
      }
    }
  }

  private async runFrequentWritesTest(endTime: number): Promise<void> {
    let counter = 0;
    
    this.currentInterval = setInterval(async () => {
      if (!this.isRunning || Date.now() >= endTime) {
        this.stopStressTest();
        return;
      }

      try {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            this.pool.request()
              .input('email', sql.NVarChar, `stress_user_${counter}_${i}@test.com`)
              .input('first_name', sql.NVarChar, `StressUser${counter}${i}`)
              .input('last_name', sql.NVarChar, `Test${counter}${i}`)
              .query(`
                INSERT INTO users (email, password_hash, first_name, last_name)
                VALUES (@email, 'temp_hash', @first_name, @last_name)
              `)
          );
        }
        
        await Promise.allSettled(promises);
        counter++;
        
        if (counter % 10 === 0) {
          await this.pool.request().query(`
            DELETE FROM users 
            WHERE email LIKE 'stress_user_%@test.com'
          `);
        }
      } catch (error) {
        console.error('Frequent writes test error:', error);
      }
    }, 100);

    await new Promise(resolve => {
      const checkEnd = setInterval(() => {
        if (!this.isRunning || Date.now() >= endTime) {
          clearInterval(checkEnd);
          resolve(void 0);
        }
      }, 1000);
    });
  }

  private async createTestTable(): Promise<void> {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stress_test_data')
        CREATE TABLE stress_test_data (
          id INT IDENTITY(1,1) PRIMARY KEY,
          data_column NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETUTCDATE()
        )
      `);
    } catch (error) {
      console.error('Error creating test table:', error);
    }
  }

  private async createTestTables(): Promise<void> {
    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'table1')
        CREATE TABLE table1 (
          id INT PRIMARY KEY,
          value INT DEFAULT 0
        )
      `);

      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'table2')
        CREATE TABLE table2 (
          id INT PRIMARY KEY,
          value INT DEFAULT 0
        )
      `);

      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM table1 WHERE id = 1)
        INSERT INTO table1 (id, value) VALUES (1, 0)
      `);

      await this.pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM table2 WHERE id = 1)
        INSERT INTO table2 (id, value) VALUES (1, 0)
      `);
    } catch (error) {
      console.error('Error creating test tables:', error);
    }
  }
}