import sql from 'mssql';

export interface User {
  id?: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

export interface Product {
  id?: number;
  name: string;
  description?: string;
  price: number;
  category_id: number;
  stock_quantity: number;
  sku: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

export interface Order {
  id?: number;
  user_id: number;
  total_amount: number;
  status: string;
  shipping_address?: string;
  billing_address?: string;
  created_at?: Date;
  updated_at?: Date;
  items?: OrderItem[];
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export class ShopService {
  constructor(private pool: sql.ConnectionPool) {}

  async getUsers(): Promise<User[]> {
    const result = await this.pool.request()
      .query('SELECT * FROM users ORDER BY created_at DESC');
    return result.recordset;
  }

  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const result = await this.pool.request()
      .input('email', sql.NVarChar, userData.email)
      .input('password_hash', sql.NVarChar, userData.password_hash)
      .input('first_name', sql.NVarChar, userData.first_name)
      .input('last_name', sql.NVarChar, userData.last_name)
      .input('is_active', sql.Bit, userData.is_active || true)
      .query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active)
        OUTPUT INSERTED.*
        VALUES (@email, @password_hash, @first_name, @last_name, @is_active)
      `);
    return result.recordset[0];
  }

  async getProducts(): Promise<Product[]> {
    const result = await this.pool.request()
      .query('SELECT * FROM products WHERE is_active = 1 ORDER BY name');
    return result.recordset;
  }

  async createOrder(orderData: {
    user_id: number;
    items: { product_id: number; quantity: number }[];
    shipping_address?: string;
    billing_address?: string;
  }): Promise<Order> {
    const transaction = new sql.Transaction(this.pool);
    
    try {
      await transaction.begin();
      
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];
      
      for (const item of orderData.items) {
        const productResult = await transaction.request()
          .input('product_id', sql.Int, item.product_id)
          .query('SELECT price FROM products WHERE id = @product_id');
        
        if (productResult.recordset.length === 0) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }
        
        const unitPrice = productResult.recordset[0].price;
        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;
        
        orderItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        });
      }
      
      const orderResult = await transaction.request()
        .input('user_id', sql.Int, orderData.user_id)
        .input('total_amount', sql.Decimal(10, 2), totalAmount)
        .input('status', sql.NVarChar, 'pending')
        .input('shipping_address', sql.NVarChar, orderData.shipping_address)
        .input('billing_address', sql.NVarChar, orderData.billing_address)
        .query(`
          INSERT INTO orders (user_id, total_amount, status, shipping_address, billing_address)
          OUTPUT INSERTED.*
          VALUES (@user_id, @total_amount, @status, @shipping_address, @billing_address)
        `);
      
      const order = orderResult.recordset[0];
      
      for (const item of orderItems) {
        await transaction.request()
          .input('order_id', sql.Int, order.id)
          .input('product_id', sql.Int, item.product_id)
          .input('quantity', sql.Int, item.quantity)
          .input('unit_price', sql.Decimal(10, 2), item.unit_price)
          .input('total_price', sql.Decimal(10, 2), item.total_price)
          .query(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
            VALUES (@order_id, @product_id, @quantity, @unit_price, @total_price)
          `);
      }
      
      await transaction.commit();
      return { ...order, items: orderItems };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    const result = await this.pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT o.*, oi.product_id, oi.quantity, oi.unit_price, oi.total_price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = @user_id
        ORDER BY o.created_at DESC
      `);
    
    const ordersMap: { [key: number]: Order } = {};
    
    result.recordset.forEach(row => {
      if (!ordersMap[row.id]) {
        ordersMap[row.id] = {
          id: row.id,
          user_id: row.user_id,
          total_amount: row.total_amount,
          status: row.status,
          shipping_address: row.shipping_address,
          billing_address: row.billing_address,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        };
      }
      
      if (row.product_id) {
        ordersMap[row.id].items!.push({
          product_id: row.product_id,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });
    
    return Object.values(ordersMap);
  }

  async seedDatabase(): Promise<void> {
    try {
      const categoriesResult = await this.pool.request()
        .query('SELECT COUNT(*) as count FROM categories');
      
      if (categoriesResult.recordset[0].count === 0) {
        console.log('Seeding database with initial data...');
        
        await this.pool.request()
          .query(`
            INSERT INTO categories (name, description) VALUES
            ('Electronics', 'Electronic devices and gadgets'),
            ('Clothing', 'Apparel and accessories'),
            ('Books', 'Books and literature'),
            ('Home & Garden', 'Home improvement and gardening'),
            ('Sports', 'Sports equipment and gear')
          `);
        
        await this.pool.request()
          .query(`
            INSERT INTO products (name, description, price, category_id, stock_quantity, sku) VALUES
            ('Smartphone', 'Latest model smartphone', 699.99, 1, 50, 'PHONE-001'),
            ('Laptop', 'High-performance laptop', 1299.99, 1, 30, 'LAPTOP-001'),
            ('T-Shirt', 'Cotton t-shirt', 19.99, 2, 100, 'SHIRT-001'),
            ('Jeans', 'Denim jeans', 49.99, 2, 75, 'JEANS-001'),
            ('Programming Book', 'Learn programming', 39.99, 3, 200, 'BOOK-001'),
            ('Garden Tool Set', 'Complete garden tools', 89.99, 4, 25, 'GARDEN-001'),
            ('Tennis Racket', 'Professional tennis racket', 129.99, 5, 40, 'TENNIS-001')
          `);
        
        for (let i = 1; i <= 100; i++) {
          await this.pool.request()
            .input('email', sql.NVarChar, `user${i}@example.com`)
            .input('password_hash', sql.NVarChar, 'hashed_password_placeholder')
            .input('first_name', sql.NVarChar, `User${i}`)
            .input('last_name', sql.NVarChar, `LastName${i}`)
            .query(`
              INSERT INTO users (email, password_hash, first_name, last_name)
              VALUES (@email, @password_hash, @first_name, @last_name)
            `);
        }
        
        console.log('Database seeded successfully');
      }
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
}