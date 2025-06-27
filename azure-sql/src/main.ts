import dotenv from 'dotenv';
import { getConnection, closeConnection } from './db.js';
import { ShopService } from './shop-service.js';
import { StressTestService } from './stress-test-service.js';

dotenv.config();

let shopService: ShopService;
let stressTestService: StressTestService;
let stressTestInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

async function initializeServices() {
  try {
    const pool = await getConnection();
    shopService = new ShopService(pool);
    stressTestService = new StressTestService(pool);
    
    await shopService.seedDatabase();
    console.log('Services initialized and database seeded');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

async function simulateDbActivity() {
  await initializeServices();
  
  console.log('Starting database activity simulation...');
  console.log('Available stress test scenarios:');
  stressTestService.getAvailableScenarios().forEach(scenario => {
    console.log(`  - ${scenario.name}: ${scenario.description}`);
  });

  const scenarios = ['high-cpu', 'high-io', 'frequent-writes', 'deadlock', 'blocking', 'memory-pressure', 'connection-flood', 'slow-queries'];
  let currentScenarioIndex = 0;

  stressTestInterval = setInterval(async () => {
    try {
      if (stressTestService.isTestRunning) {
        console.log('Skipping stress test - previous test still running');
        return;
      }
      
      const scenario = scenarios[currentScenarioIndex];
      console.log(`\nStarting stress test scenario: ${scenario}`);
      
      await stressTestService.startStressTest(scenario, 25);
      
      setTimeout(() => {
        console.log(`Stopping stress test scenario: ${scenario}`);
        stressTestService.stopStressTest();
      }, 25000);

      currentScenarioIndex = (currentScenarioIndex + 1) % scenarios.length;
    } catch (error) {
      console.error('Error during stress test:', error);
    }
  }, 35000);

  healthCheckInterval = setInterval(async () => {
    try {
      const users = await shopService.getUsers();
      const products = await shopService.getProducts();
      console.log(`Health check - Users: ${users.length}, Products: ${products.length}`);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, 10000);
}

process.on('SIGINT', async () => {
  await shutdownGracefully()
});

async function shutdownGracefully() {
  console.log('\nShutting down gracefully...');
  if (stressTestInterval) {
    clearInterval(stressTestInterval);
    stressTestInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  if (stressTestService) {
    stressTestService.stopStressTest();
  }
  setTimeout(() => {
    process.exit(0);  
  }, 10000)
  await closeConnection();
  process.exit(0);

}

process.on('SIGTERM', async () => {
  await shutdownGracefully()
});

simulateDbActivity().catch(error => {
  console.error('Failed to start database simulation:', error);
  process.exit(1);
});