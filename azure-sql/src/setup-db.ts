import { getConnection, closeConnection } from './db.js';

async function setupDatabase() {
  try {
    const pool = await getConnection();
    console.log('Setting up database tables...');

    // Create users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          email NVARCHAR(255) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          first_name NVARCHAR(100) NOT NULL,
          last_name NVARCHAR(100) NOT NULL,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE(),
          is_active BIT DEFAULT 1
      );
    `);

    // Create categories table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categories' AND xtype='U')
      CREATE TABLE categories (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL,
          description NVARCHAR(500),
          created_at DATETIME2 DEFAULT GETUTCDATE()
      );
    `);

    // Create products table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
      CREATE TABLE products (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX),
          price DECIMAL(10,2) NOT NULL,
          category_id INT NOT NULL,
          stock_quantity INT NOT NULL DEFAULT 0,
          sku NVARCHAR(50) NOT NULL UNIQUE,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE(),
          is_active BIT DEFAULT 1,
          FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);

    // Create orders table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
      CREATE TABLE orders (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          status NVARCHAR(50) NOT NULL DEFAULT 'pending',
          shipping_address NVARCHAR(500),
          billing_address NVARCHAR(500),
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Create order_items table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' AND xtype='U')
      CREATE TABLE order_items (
          id INT IDENTITY(1,1) PRIMARY KEY,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    console.log('Database setup completed successfully!');
    await closeConnection();
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();