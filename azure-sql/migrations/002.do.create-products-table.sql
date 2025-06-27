CREATE TABLE categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

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

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_stock ON products(stock_quantity);