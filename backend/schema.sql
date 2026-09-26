CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,phone TEXT,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN('customer','rider','admin')),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS categories(id BIGSERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL,icon TEXT,description TEXT,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS products(id BIGSERIAL PRIMARY KEY,category_id BIGINT NOT NULL REFERENCES categories(id),name TEXT NOT NULL,description TEXT,image_url TEXT,base_price NUMERIC(12,2) NOT NULL CHECK(base_price>=0),unit_type TEXT NOT NULL CHECK(unit_type IN('kg','liter','dozen')),stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS products_cat ON products(category_id); CREATE INDEX IF NOT EXISTS products_active ON products(is_active);
CREATE TABLE IF NOT EXISTS addresses(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,label TEXT NOT NULL,address_line TEXT NOT NULL,city TEXT NOT NULL DEFAULT 'City',latitude DOUBLE PRECISION NOT NULL,longitude DOUBLE PRECISION NOT NULL,is_default BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS addresses_user ON addresses(user_id);
CREATE TABLE IF NOT EXISTS shipping_settings(id BIGINT PRIMARY KEY CHECK(id=1),minimum_order_amount NUMERIC(12,2) NOT NULL CHECK(minimum_order_amount>=0),shipping_fee NUMERIC(12,2) NOT NULL CHECK(shipping_fee>=0),shipping_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,free_shipping_threshold NUMERIC(12,2) NOT NULL CHECK(free_shipping_threshold>=0),currency TEXT NOT NULL DEFAULT 'PKR',free_shipping_enabled BOOLEAN NOT NULL DEFAULT FALSE,updated_by BIGINT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE shipping_settings ADD COLUMN IF NOT EXISTS shipping_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shipping_settings ALTER COLUMN free_shipping_enabled SET DEFAULT FALSE;
UPDATE shipping_settings SET shipping_tiers='[{"min_amount":250,"max_amount":500,"fee":70},{"min_amount":500,"max_amount":700,"fee":60},{"min_amount":700,"max_amount":1000,"fee":50},{"min_amount":1000,"max_amount":0,"fee":30}]'::jsonb WHERE shipping_tiers='[]'::jsonb;
INSERT INTO shipping_settings(id,minimum_order_amount,shipping_fee,shipping_tiers,free_shipping_threshold,currency,free_shipping_enabled) VALUES(1,250,70,'[{"min_amount":250,"max_amount":500,"fee":70},{"min_amount":500,"max_amount":700,"fee":60},{"min_amount":700,"max_amount":1000,"fee":50},{"min_amount":1000,"max_amount":0,"fee":30}]'::jsonb,1500,'PKR',false) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- Existing installs had the previous implementation enabled by default. Switch it
-- off exactly once; future admin changes are never overwritten on application boot.
WITH newly_applied AS (INSERT INTO app_migrations(name) VALUES('free_shipping_default_off_v1') ON CONFLICT DO NOTHING RETURNING name)
UPDATE shipping_settings SET free_shipping_enabled=FALSE WHERE EXISTS (SELECT 1 FROM newly_applied);
CREATE TABLE IF NOT EXISTS time_slots(id BIGSERIAL PRIMARY KEY,slot_date DATE NOT NULL,start_time TIME NOT NULL,end_time TIME NOT NULL,max_orders INT NOT NULL DEFAULT 10 CHECK(max_orders>0),booked_orders INT NOT NULL DEFAULT 0 CHECK(booked_orders>=0),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(slot_date,start_time,end_time));
ALTER TABLE time_slots DROP CONSTRAINT IF EXISTS time_slots_time_order_check;
ALTER TABLE time_slots ADD CONSTRAINT time_slots_time_order_check CHECK(end_time>start_time);
ALTER TABLE time_slots DROP CONSTRAINT IF EXISTS time_slots_duration_check;
CREATE INDEX IF NOT EXISTS slots_date ON time_slots(slot_date);
CREATE INDEX IF NOT EXISTS slots_availability ON time_slots(slot_date,is_active,start_time);
CREATE TABLE IF NOT EXISTS orders(id BIGSERIAL PRIMARY KEY,order_number TEXT UNIQUE NOT NULL,user_id BIGINT NOT NULL REFERENCES users(id),rider_id BIGINT REFERENCES users(id),address_id BIGINT REFERENCES addresses(id),delivery_address TEXT NOT NULL,delivery_latitude DOUBLE PRECISION NOT NULL,delivery_longitude DOUBLE PRECISION NOT NULL,delivery_date DATE NOT NULL,time_slot_id BIGINT NOT NULL REFERENCES time_slots(id),payment_method TEXT NOT NULL CHECK(payment_method IN('cod','jazzcash','pos')),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','preparing','assigned','out_for_delivery','delivered','cancelled')),subtotal NUMERIC(12,2) NOT NULL,shipping NUMERIC(12,2) NOT NULL,total NUMERIC(12,2) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id); CREATE INDEX IF NOT EXISTS orders_status ON orders(status); CREATE INDEX IF NOT EXISTS orders_rider ON orders(rider_id);
CREATE TABLE IF NOT EXISTS order_items(id BIGSERIAL PRIMARY KEY,order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id BIGINT NOT NULL REFERENCES products(id),product_name TEXT NOT NULL,image_url TEXT,unit_type TEXT NOT NULL,size_ml INT NOT NULL CHECK(size_ml>0),size_label TEXT,quantity INT NOT NULL CHECK(quantity>0),unit_price NUMERIC(12,2) NOT NULL,item_total NUMERIC(12,2) NOT NULL);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_label TEXT;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_size_ml_check;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_size_ml_positive;
ALTER TABLE order_items ADD CONSTRAINT order_items_size_ml_positive CHECK(size_ml>0);
CREATE INDEX IF NOT EXISTS items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS riders(id BIGSERIAL PRIMARY KEY,user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,vehicle TEXT,vehicle_type TEXT,vehicle_number TEXT,is_available BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE riders ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
CREATE TABLE IF NOT EXISTS rider_time_slots(id BIGSERIAL PRIMARY KEY,rider_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,time_slot_id BIGINT NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(rider_id,time_slot_id));
DELETE FROM rider_time_slots older USING rider_time_slots newer WHERE older.time_slot_id=newer.time_slot_id AND older.id>newer.id;
CREATE UNIQUE INDEX IF NOT EXISTS rider_time_slots_one_rider_per_slot ON rider_time_slots(time_slot_id);
CREATE INDEX IF NOT EXISTS rider_time_slots_rider ON rider_time_slots(rider_id);
CREATE INDEX IF NOT EXISTS rider_time_slots_slot ON rider_time_slots(time_slot_id);
CREATE INDEX IF NOT EXISTS orders_delivery_filter ON orders(delivery_date,time_slot_id,rider_id,status);
CREATE TABLE IF NOT EXISTS payments(id BIGSERIAL PRIMARY KEY,order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,txn_ref TEXT UNIQUE NOT NULL,gateway TEXT NOT NULL DEFAULT 'jazzcash',amount NUMERIC(12,2) NOT NULL,status TEXT NOT NULL DEFAULT 'initiated' CHECK(status IN('initiated','pending','paid','failed','cancelled')),response_code TEXT,response_message TEXT,retrieval_reference TEXT,raw_response JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS payments_order ON payments(order_id);
CREATE TABLE IF NOT EXISTS coupons(id BIGSERIAL PRIMARY KEY,code TEXT UNIQUE NOT NULL,discount_type TEXT NOT NULL CHECK(discount_type IN('percentage','fixed')),discount_value NUMERIC(12,2) NOT NULL CHECK(discount_value>0),min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(min_order_amount>=0),max_discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(max_discount>=0),usage_limit INT NOT NULL DEFAULT 0 CHECK(usage_limit>=0),used_count INT NOT NULL DEFAULT 0 CHECK(used_count>=0),starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),expires_at TIMESTAMPTZ NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS coupons_active_expiry ON coupons(is_active,expires_at);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS delivery_proofs(id BIGSERIAL PRIMARY KEY,order_id BIGINT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,rider_id BIGINT NOT NULL REFERENCES users(id),file_url TEXT NOT NULL,captured_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN('pending','confirmed','preparing','assigned','accepted','out_for_delivery','delivered','failed','cancelled'));
INSERT INTO categories(name,icon,description) VALUES('Vegetables','🥬','Fresh & Organic'),('Fruits','🍎','Farm Fresh'),('Meat','🥩','Halal & Fresh'),('Milk & Dairy','🥛','Pure & Healthy') ON CONFLICT(name) DO NOTHING;
INSERT INTO products(category_id,name,description,image_url,base_price,unit_type,stock_quantity) SELECT c.id,v.name,v.description,v.image_url,v.price,v.unit_type,v.stock FROM (VALUES
('Vegetables','Tomato','Fresh red tomatoes','https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85',200.00,'kg',50),('Vegetables','Potato','Farm fresh potatoes','https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=85',120.00,'kg',70),('Fruits','Apple','Crisp red apples','https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=900&q=85',350.00,'kg',40),('Fruits','Banana','Sweet fresh bananas','https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=85',180.00,'kg',45),('Meat','Beef','Fresh halal beef','https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=900&q=85',1200.00,'kg',25),('Meat','Chicken','Fresh halal chicken','https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=900&q=85',650.00,'kg',35),('Milk & Dairy','Fresh Milk','Pure fresh milk','https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=85',220.00,'liter',50),('Milk & Dairy','Yogurt','Creamy plain yogurt','https://images.unsplash.com/photo-1571212515416-fef01fc436e1?auto=format&fit=crop&w=900&q=85',280.00,'liter',30)) v(cat,name,description,image_url,price,unit_type,stock) JOIN categories c ON c.name=v.cat WHERE NOT EXISTS(SELECT 1 FROM products p WHERE p.name=v.name);

INSERT INTO coupons(code,discount_type,discount_value,min_order_amount,max_discount,usage_limit,starts_at,expires_at,is_active) VALUES
('FRESH10','percentage',10,1000,500,1000,now(),now()+interval '30 days',true),
('SAVE50','fixed',50,800,0,1000,now(),now()+interval '20 days',true),
('FRESH20','percentage',20,1500,600,500,now(),now()+interval '45 days',true),
('MEAT15','percentage',15,1000,400,300,now(),now()+interval '25 days',true)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS notifications(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'general',
 data JSONB NOT NULL DEFAULT '{}'::jsonb,
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread ON notifications(user_id,is_read);

CREATE TABLE IF NOT EXISTS push_tokens(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token TEXT UNIQUE NOT NULL,
 platform TEXT NOT NULL DEFAULT 'unknown',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens(user_id);


-- Delivery cities and areas
CREATE TABLE IF NOT EXISTS shipping_cities(
 id BIGSERIAL PRIMARY KEY,
 name TEXT UNIQUE NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shipping_areas(
 id BIGSERIAL PRIMARY KEY,
 city_id BIGINT NOT NULL REFERENCES shipping_cities(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(city_id,name)
);
CREATE INDEX IF NOT EXISTS shipping_areas_city ON shipping_areas(city_id,is_active);

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES shipping_cities(id);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES shipping_areas(id);
CREATE INDEX IF NOT EXISTS addresses_city_area ON addresses(city_id,area_id);

-- Password reset OTPs. OTPs are stored hashed and expire quickly.
CREATE TABLE IF NOT EXISTS password_reset_tokens(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_lookup ON password_reset_tokens(token_hash,expires_at);

-- Product size/weight migration: existing kg/liter products get standard choices; dozen uses one dozen.
UPDATE products SET size_options = CASE WHEN unit_type='dozen' THEN '[{"value":1,"label":"1 dozen"}]'::jsonb ELSE '[{"value":250,"label":"250 g"},{"value":500,"label":"500 g"},{"value":1000,"label":"1 kg"}]'::jsonb END WHERE size_options='[]'::jsonb;
UPDATE products SET unit_type='dozen', size_options='[{"value":1,"label":"1 dozen"}]'::jsonb WHERE name='Banana';
INSERT INTO products(category_id,name,description,image_url,base_price,unit_type,stock_quantity,is_active,size_options) SELECT c.id,'Green Chilli','Fresh green chillies','',300.00,'kg',30,true,'[{"value":250,"label":"1 pao"},{"value":500,"label":"500 g"},{"value":1000,"label":"1 kg"}]'::jsonb FROM categories c WHERE c.name='Vegetables' AND NOT EXISTS(SELECT 1 FROM products p WHERE p.name='Green Chilli');
