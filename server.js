const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI ;

mongoose.connect(MONGODB_URI)
  .then(() => console.log("Pinged your deployment. You successfully connected to MongoDB!"))
  .catch(err => console.error("MongoDB connection error:", err));


// Define Schemas based on the provided JSON schema
const superadminSchema = new mongoose.Schema({ email: String, password: String }, { collection: 'superadmins' });
const waiterSchema = new mongoose.Schema({ name: { type: String, default: 'Waiter' }, email: String, password: String }, { collection: 'waiters' });
const subItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  type: String,
  image: String
});
const menuSchema = new mongoose.Schema({
  universal_items: {
    type: Map,
    of: [subItemSchema],
    default: () => new Map()
  },
  todays_items: {
    type: Map,
    of: [subItemSchema],
    default: () => new Map()
  }
}, { collection: 'menu' });
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  otp: String,
  wallet: { type: Number, default: 0 },
  orders: [{
    order_id: String,
    status: String,
    tableno: String,
    ordertype: String,
    totalBill: Number,
    date: String,
    time: String,
    paymentMethod: String,
    otp: String,
    waiterEmail: { type: String, default: null },
    waiterName: { type: String, default: null },
    items: [{
      itemName: String,
      rate: Number,
      qty: Number,
      total: Number
    }]
  }],
  cart: [{
    itemName: String,
    rate: Number,
    qty: Number,
    total: Number
  }]
}, { collection: 'users' });
const waiterOrderSchema = new mongoose.Schema({
  orderId: String,
  username: String,
  data: String,
  time: String,
  date: String,
  verified: Boolean
}, { collection: 'waiterOrders' });

const canteenSettingsSchema = new mongoose.Schema({
  acceptingOrders: { type: Boolean, default: true }
}, { collection: 'canteenSettings' });

const bannerSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  tag: { type: String, default: "SPECIAL COMBO" },
  image: String,
  price: Number,
  comboItems: [{
    itemName: String,
    rate: Number,
    qty: { type: Number, default: 1 }
  }],
  active: { type: Boolean, default: true }
}, { collection: 'banners' });

// Models
const Superadmin = mongoose.model('Superadmin', superadminSchema);
const Waiter = mongoose.model('Waiter', waiterSchema);
const Menu = mongoose.model('Menu', menuSchema);
const User = mongoose.model('User', userSchema);
const WaiterOrder = mongoose.model('WaiterOrder', waiterOrderSchema);
const CanteenSettings = mongoose.model('CanteenSettings', canteenSettingsSchema);
const Banner = mongoose.model('Banner', bannerSchema);

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, 'secretkey');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Seed data function (run this once to insert the provided schema data into MongoDB)
async function seedData() {
  try {
    // Clear existing data (optional, for resetting)
    await Superadmin.deleteMany({});
    await Waiter.deleteMany({});
    await Menu.deleteMany({});
    await User.deleteMany({});
    await WaiterOrder.deleteMany({});

    // Insert superadmins
    await Superadmin.insertMany([
      { email: "admin@cafe.com", password: "hashedpass123" },
      { email: "superadmin@cafe.com", password: "superpassword123" }
    ]);

    // Insert waiters
    await Waiter.insertMany([
      { email: "waiter@cafe.com", password: "waiterpass123" },
      { email: "waiter1@cafe.com", password: "waiter1pass" },
      { email: "waiter2@cafe.com", password: "waiter2pass" }
    ]);

    // Insert menu
    const universal = {
      Breakfast: [
        { name: "Idli & Sambar", price: 40, type: "veg", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80" },
        { name: "Masala Dosa", price: 50, type: "veg", image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80" },
        { name: "Poha", price: 35, type: "veg", image: "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=500&q=80" },
        { name: "Upma", price: 30, type: "veg", image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=500&q=80" },
        { name: "Bread Omelette", price: 45, type: "veg", image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80" },
        { name: "Tea / Coffee", price: 20, type: "veg", image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=500&q=80" },
      ],
      LunchSpecials: [
        { name: "Veg Thali", price: 80, type: "veg", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=500&q=80" },
        { name: "Paneer Butter Masala with Roti", price: 90, type: "veg", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=500&q=80" },
        { name: "Veg Fried Rice", price: 70, type: "veg", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=500&q=80" },
        { name: "Chole Bhature", price: 75, type: "veg", image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=500&q=80" },
        { name: "Lemon Rice with Curd", price: 60, type: "veg", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=500&q=80" },
        { name: "Rajma Chawal", price: 65, type: "veg", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80" },
      ],
      SnacksFastFood: [
        { name: "Veg Burger", price: 60, type: "veg", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80" },
        { name: "French Fries", price: 45, type: "veg", image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=500&q=80" },
        { name: "Maggi", price: 40, type: "veg", image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=500&q=80" },
        { name: "Samosa (2 pcs)", price: 30, type: "veg", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80" },
        { name: "Sandwich (Grilled)", price: 55, type: "veg", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=500&q=80" },
        { name: "Momos (Veg/Paneer)", price: 65, type: "veg", image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&w=500&q=80" },
      ],
      Beverages: [
        { name: "Cold Coffee", price: 50, type: "veg", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=500&q=80" },
        { name: "Fresh Lime Soda", price: 35, type: "veg", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80" },
        { name: "Mango Shake", price: 60, type: "veg", image: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=500&q=80" },
        { name: "Iced Tea", price: 40, type: "veg", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=500&q=80" },
        { name: "Buttermilk", price: 25, type: "veg", image: "https://images.unsplash.com/photo-1626078436896-1c099351d386?auto=format&fit=crop&w=500&q=80" },
        { name: "Water Bottle (500ml)", price: 20, type: "veg", image: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=500&q=80" },
      ],
      Desserts: [
        { name: "Gulab Jamun (2 pcs)", price: 30, type: "veg", image: "https://images.unsplash.com/photo-1605197586558-8683e3518177?auto=format&fit=crop&w=500&q=80" },
        { name: "Ice Cream Cup", price: 40, type: "veg", image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=500&q=80" },
        { name: "Chocolate Brownie", price: 60, type: "veg", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80" },
        { name: "Fruit Salad", price: 50, type: "veg", image: "https://images.unsplash.com/photo-1564093497595-593b96d80180?auto=format&fit=crop&w=500&q=80" },
        { name: "Muffin (Chocolate/Vanilla)", price: 35, type: "veg", image: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=500&q=80" },
        { name: "Kheer / Payasam", price: 45, type: "veg", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80" },
      ]
    };
    await Menu.create({ universal_items: universal, todays_items: {} });

    // Insert users
    await User.insertMany([
      {
        name: "Bhushan",
        email: "bhushan@example.com",
        password: "hashedpassword",
        phone: "9876543210",
        otp: "728190",
        wallet: 300,
        orders: [
          {
            order_id: "ORD2025",
            status: "completed",
            tableno: "T4",
            ordertype: "on table",
            totalBill: 270,
            date: "2025-10-11",
            time: "8:45 PM",
            paymentMethod: "UPI",
            otp: "123456",
            items: [
              { itemName: "Paneer Tikka", rate: 180, qty: 1, total: 180 },
              { itemName: "Cold Coffee", rate: 90, qty: 1, total: 90 }
            ]
          }
        ],
        cart: []
      },
      {
        name: "Aarav Sharma",
        email: "aarav@example.com",
        password: "password123",
        phone: "9123456789",
        otp: "123456",
        wallet: 500,
        orders: [],
        cart: []
      },
      {
        name: "Priya Patel",
        email: "priya@example.com",
        password: "password123",
        phone: "9876123456",
        otp: "654321",
        wallet: 250,
        orders: [],
        cart: []
      }
    ]);

    // Insert waiterOrders
    await WaiterOrder.insertMany([
      {
        orderId: "ORD2025",
        username: "Bhushan",
        data: "Served Paneer Tikka & Cold Coffee",
        time: "8:50 PM",
        date: "2025-10-11",
        verified: true
      }
    ]);

    console.log('Data seeded successfully');
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

async function autoSeedIfEmpty() {
  try {
    const adminCount = await Superadmin.countDocuments();
    const waiterCount = await Waiter.countDocuments();
    const menuCount = await Menu.countDocuments();
    const userCount = await User.countDocuments();

    if (adminCount === 0 || waiterCount === 0 || menuCount === 0 || userCount === 0) {
      console.log('Detected missing initial seed data. Running seedData()...');
      await seedData();
    }
  } catch (err) {
    console.error("Error auto-seeding data:", err);
  }
}

mongoose.connection.once('open', () => {
  autoSeedIfEmpty();
});

// Routes for universal items
app.get('/api/items', async (req, res) => {
  try {
    let menu = await Menu.findOne();
    if (!menu) {
      menu = new Menu();
      await menu.save();
    }
    const items = [];
    for (const [category, catItems] of menu.universal_items.entries()) {
      catItems.forEach(item => {
        items.push({
          _id: item._id.toString(),
          category,
          name: item.name,
          price: item.price,
          itemType: item.type,
          image: item.image
        });
      });
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const getInternetFoodImage = (name = '', category = '') => {
  const text = (name + " " + category).toLowerCase();
  if (text.includes('dosa')) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80';
  if (text.includes('samosa') || text.includes('chai') || text.includes('tea')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80';
  if (text.includes('thali') || text.includes('meal') || text.includes('rice') || text.includes('paneer') || text.includes('curry')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';
  if (text.includes('burger') || text.includes('fries')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80';
  if (text.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80';
  if (text.includes('coffee')) return 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80';
  if (text.includes('biryani') || text.includes('pulao')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80';
  if (text.includes('sandwich') || text.includes('toast')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80';
  if (text.includes('brownie') || text.includes('cake') || text.includes('pastry')) return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80';
  if (text.includes('ice cream') || text.includes('kulfi')) return 'https://images.unsplash.com/photo-1560008511-11c63416e52d?w=600&q=80';
  if (text.includes('pasta') || text.includes('noodle')) return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80';
  if (text.includes('juice') || text.includes('shake') || text.includes('drink') || text.includes('lassi')) return 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&q=80';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';
};

app.post('/api/items', async (req, res) => {
  const { name, price, category, image } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ message: 'Name, price, and category are required' });
  }

  const itemImg = image || getInternetFoodImage(name, category);

  try {
    let menu = await Menu.findOne();
    if (!menu) {
      menu = new Menu();
      await menu.save();
    }
    if (!menu.universal_items.has(category)) {
      menu.universal_items.set(category, []);
    }
    const newItem = {
      name,
      price,
      type: "veg",
      image: itemImg
    };
    menu.universal_items.get(category).push(newItem);
    await menu.save();
    res.json({
      _id: newItem._id.toString(),
      category,
      name,
      price,
      itemType: "veg",
      image: itemImg
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { name, price, image, category } = req.body;
  try {
    let menu = await Menu.findOne();
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    let foundItem = null;
    let currentCategory = null;
    for (const [cat, catItems] of menu.universal_items.entries()) {
      const item = catItems.find(it => it._id.toString() === req.params.id);
      if (item) {
        foundItem = item;
        currentCategory = cat;
        break;
      }
    }
    if (!foundItem) return res.status(404).json({ message: 'Item not found' });
    if (name) foundItem.name = name;
    if (price !== undefined) foundItem.price = price;
    if (image) foundItem.image = image;
    if (category && category !== currentCategory) {
      const index = menu.universal_items.get(currentCategory).findIndex(it => it._id.toString() === req.params.id);
      menu.universal_items.get(currentCategory).splice(index, 1);
      if (menu.universal_items.get(currentCategory).length === 0) menu.universal_items.delete(currentCategory);
      if (!menu.universal_items.has(category)) menu.universal_items.set(category, []);
      menu.universal_items.get(category).push(foundItem);
    }
    await menu.save();
    res.json({
      _id: foundItem._id.toString(),
      category: category || currentCategory,
      name: foundItem.name,
      price: foundItem.price,
      itemType: foundItem.type,
      image: foundItem.image
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    let menu = await Menu.findOne();
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    let found = false;
    for (const [cat, catItems] of menu.universal_items.entries()) {
      const index = catItems.findIndex(it => it._id.toString() === req.params.id);
      if (index !== -1) {
        catItems.splice(index, 1);
        if (catItems.length === 0) menu.universal_items.delete(cat);
        found = true;
        break;
      }
    }
    if (!found) return res.status(404).json({ message: 'Item not found' });
    await menu.save();
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Routes for today's items
app.get('/api/daily-items', async (req, res) => {
  try {
    let menu = await Menu.findOne();
    if (!menu) {
      menu = new Menu();
      await menu.save();
    }
    const items = [];
    for (const [category, catItems] of menu.todays_items.entries()) {
      catItems.forEach(item => {
        items.push({
          _id: item._id.toString(),
          category,
          name: item.name,
          price: item.price,
          itemType: item.type,
          image: item.image
        });
      });
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/set-daily-items', async (req, res) => {
  const { selectedIds } = req.body;
  try {
    let menu = await Menu.findOne();
    if (!menu) {
      menu = new Menu();
      await menu.save();
    }
    menu.todays_items = new Map();
    for (const id of selectedIds) {
      let foundItem = null;
      let category = null;
      for (const [cat, catItems] of menu.universal_items.entries()) {
        const item = catItems.find(it => it._id.toString() === id);
        if (item) {
          foundItem = { ...item.toObject() };
          delete foundItem._id;
          category = cat;
          break;
        }
      }
      if (foundItem && category) {
        if (!menu.todays_items.has(category)) {
          menu.todays_items.set(category, []);
        }
        menu.todays_items.get(category).push(foundItem);
      }
    }
    await menu.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/daily-items/:id', async (req, res) => {
  const { name, price, image, category } = req.body;
  try {
    let menu = await Menu.findOne();
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    let foundItem = null;
    let currentCategory = null;
    for (const [cat, catItems] of menu.todays_items.entries()) {
      const item = catItems.find(it => it._id.toString() === req.params.id);
      if (item) {
        foundItem = item;
        currentCategory = cat;
        break;
      }
    }
    if (!foundItem) return res.status(404).json({ message: 'Item not found' });
    if (name) foundItem.name = name;
    if (price !== undefined) foundItem.price = price;
    if (image) foundItem.image = image;
    if (category && category !== currentCategory) {
      const index = menu.todays_items.get(currentCategory).findIndex(it => it._id.toString() === req.params.id);
      menu.todays_items.get(currentCategory).splice(index, 1);
      if (menu.todays_items.get(currentCategory).length === 0) menu.todays_items.delete(currentCategory);
      if (!menu.todays_items.has(category)) menu.todays_items.set(category, []);
      menu.todays_items.get(category).push(foundItem);
    }
    await menu.save();
    res.json({
      _id: foundItem._id.toString(),
      category: category || currentCategory,
      name: foundItem.name,
      price: foundItem.price,
      itemType: foundItem.type,
      image: foundItem.image
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/daily-items/:id', async (req, res) => {
  try {
    let menu = await Menu.findOne();
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    let found = false;
    for (const [cat, catItems] of menu.todays_items.entries()) {
      const index = catItems.findIndex(it => it._id.toString() === req.params.id);
      if (index !== -1) {
        catItems.splice(index, 1);
        if (catItems.length === 0) menu.todays_items.delete(cat);
        found = true;
        break;
      }
    }
    if (!found) return res.status(404).json({ message: 'Item not found' });
    await menu.save();
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Routes for login and signup (using plain text passwords as per schema)
app.post('/api/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({
      name,
      email,
      password, // Plain text as per schema
      phone,
      otp: '', // Default or generate if needed
      wallet: 0,
      orders: [],
      cart: []
    });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id, role: 'user' }, 'secretkey', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login/user', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: 'user' }, 'secretkey', { expiresIn: '1h' });
    res.json({ token, email: user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login/waiter', async (req, res) => {
  const { email, password } = req.body;
  try {
    const waiter = await Waiter.findOne({ email });
    if (!waiter || waiter.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: waiter._id, role: 'waiter' }, 'secretkey', { expiresIn: '1h' });
    res.json({ token, email: waiter.email, name: waiter.name || 'Waiter' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login/superadmin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Superadmin.findOne({ email });
    if (!admin || admin.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: admin._id, role: 'superadmin' }, 'secretkey', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// New routes for superadmins and waiters
app.get('/api/superadmins', async (req, res) => {
  try {
    const admins = await Superadmin.find({});
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/superadmins', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await Superadmin.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Superadmin already exists' });
    const newAdmin = new Superadmin({ email, password });
    await newAdmin.save();
    res.json(newAdmin);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/waiters', async (req, res) => {
  try {
    const waiters = await Waiter.find({});
    res.json(waiters);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/waiters', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await Waiter.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Waiter already exists' });
    const newWaiter = new Waiter({ name: name || 'Waiter', email, password });
    await newWaiter.save();
    res.json(newWaiter);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Superadmin
app.delete('/api/superadmins/:id', async (req, res) => {
  try {
    await Superadmin.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Superadmin
app.put('/api/superadmins/:id', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Superadmin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (email) admin.email = email;
    if (password) admin.password = password;
    await admin.save();
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Waiter
app.delete('/api/waiters/:id', async (req, res) => {
  try {
    await Waiter.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Waiter
app.put('/api/waiters/:id', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const waiter = await Waiter.findById(req.params.id);
    if (!waiter) return res.status(404).json({ message: 'Waiter not found' });
    if (name) waiter.name = name;
    if (email) waiter.email = email;
    if (password) waiter.password = password;
    await waiter.save();
    res.json(waiter);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User cart routes (modified to use email)
app.get('/api/user/cart', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/user/cart', async (req, res) => {
  const { email, cart } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.cart = cart;
    await user.save();
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User order route
app.post('/api/user/order', async (req, res) => {
  const { email, ordertype, tableno, paymentMethod } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const settings = await CanteenSettings.findOne({});
    if (settings && !settings.acceptingOrders) {
      return res.status(400).json({ message: 'The canteen is currently closed and not accepting new orders.' });
    }

    const subtotal = user.cart.reduce((sum, item) => sum + item.total, 0);
    const gst = subtotal * 0.05;
    const waiterCharge = ordertype === 'on table' ? 20 : 0;
    const totalBill = Number((subtotal + gst + waiterCharge).toFixed(2));
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    const order_id = 'ORD' + now.getFullYear() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const otp = ordertype === 'on table' ? Math.floor(100000 + Math.random() * 900000).toString() : '';
    const order = {
      order_id,
      status: 'pending',
      tableno,
      ordertype,
      totalBill,
      date,
      time,
      paymentMethod,
      otp,
      items: user.cart
    };
    user.orders.push(order);
    user.cart = [];
    await user.save();
    res.json({ order_id, otp });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper to map waiters
const getWaitersMap = async () => {
  const waiters = await Waiter.find({});
  const map = {};
  waiters.forEach(w => { map[w.email] = w.name || 'Waiter'; });
  return map;
};

// Get user order history
app.get('/api/user/orders', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const waitersMap = await getWaitersMap();
    const sorted = [...user.orders].reverse().map(o => {
      const obj = o.toObject();
      if (obj.waiterEmail && !obj.waiterName) {
        obj.waiterName = waitersMap[obj.waiterEmail] || 'Waiter';
      }
      return obj;
    });
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ name: user.name, email: user.email, phone: user.phone, wallet: user.wallet });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Pending orders route
app.get('/api/pending-orders', async (req, res) => {
  try {
    const users = await User.find({});
    const waitersMap = await getWaitersMap();
    const pending = [];
    users.forEach(user => {
      user.orders.forEach(order => {
        if (order.status === 'pending') {
          const obj = order.toObject();
          if (obj.waiterEmail && !obj.waiterName) {
            obj.waiterName = waitersMap[obj.waiterEmail] || 'Waiter';
          }
          pending.push({
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone || '',
            ...obj
          });
        }
      });
    });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All orders route
app.get('/api/orders', async (req, res) => {
  try {
    const users = await User.find({});
    const waitersMap = await getWaitersMap();
    const allOrders = [];
    users.forEach(user => {
      user.orders.forEach(order => {
        const obj = order.toObject();
        if (obj.waiterEmail && !obj.waiterName) {
          obj.waiterName = waitersMap[obj.waiterEmail] || 'Waiter';
        }
        allOrders.push({
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone || '',
          ...obj
        });
      });
    });
    res.json(allOrders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign waiter to order
app.post('/api/assign-order', async (req, res) => {
  const { order_id, waiterEmail } = req.body;
  try {
    const user = await User.findOne({ 'orders.order_id': order_id });
    if (!user) return res.status(404).json({ message: 'Order not found' });
    const order = user.orders.find(o => o.order_id === order_id);
    if (order) {
      order.waiterEmail = waiterEmail;
      const waiter = await Waiter.findOne({ email: waiterEmail });
      if (waiter) {
        order.waiterName = waiter.name || 'Waiter';
      }
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel Order endpoint (Superadmin)
app.post('/api/cancel-order', async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ message: 'order_id required' });
  try {
    const user = await User.findOne({ 'orders.order_id': order_id });
    if (!user) return res.status(404).json({ message: 'Order not found' });
    const order = user.orders.find(o => o.order_id === order_id);
    if (order) {
      order.status = 'cancelled';
      await user.save();
    }
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Canteen receiving orders status
app.get('/api/canteen-status', async (req, res) => {
  try {
    let settings = await CanteenSettings.findOne({});
    if (!settings) {
      settings = await CanteenSettings.create({ acceptingOrders: true });
    }
    res.json({ acceptingOrders: settings.acceptingOrders });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle Canteen receiving orders status (Superadmin)
app.post('/api/canteen-status', async (req, res) => {
  const { acceptingOrders } = req.body;
  try {
    let settings = await CanteenSettings.findOne({});
    if (!settings) {
      settings = new CanteenSettings({ acceptingOrders });
    } else {
      settings.acceptingOrders = acceptingOrders;
    }
    await settings.save();
    res.json({ success: true, acceptingOrders: settings.acceptingOrders });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Banner & Combo Slider Routes ─────────────────────────────
app.get('/api/banners', async (req, res) => {
  try {
    let banners = await Banner.find({});
    if (banners.length === 0) {
      // Seed default Zomato-style promotional combo banners
      banners = await Banner.insertMany([
        {
          title: "Crispy Dosa + Cold Coffee",
          subtitle: "Today's Special Combo Offer @ ₹120",
          tag: "🔥 TODAY'S COMBO",
          image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80",
          active: true
        },
        {
          title: "Snacks Combo Pack",
          subtitle: "2 Samosa + Hot Chai + Brownie @ ₹99",
          tag: "⚡ BESTSELLER",
          image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
          active: true
        },
        {
          title: "Special Thali Deluxe",
          subtitle: "Get Flat 20% OFF on all Lunch Thalis",
          tag: "🎉 20% OFF",
          image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
          active: true
        }
      ]);
    }
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching banners' });
  }
});

app.post('/api/banners', async (req, res) => {
  const { title, subtitle, tag, image, price, comboItems } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  const bannerImage = image || getInternetFoodImage(title, tag || '');
  try {
    const banner = new Banner({
      title,
      subtitle,
      tag: tag || "SPECIAL COMBO",
      image: bannerImage,
      price: price || undefined,
      comboItems: comboItems || [],
      active: true
    });
    await banner.save();
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating banner' });
  }
});

app.put('/api/banners/:id', async (req, res) => {
  const { title, subtitle, tag, image, price, comboItems, active } = req.body;
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (tag !== undefined) banner.tag = tag;
    if (image !== undefined) banner.image = image;
    if (price !== undefined) banner.price = price;
    if (comboItems !== undefined) banner.comboItems = comboItems;
    if (active !== undefined) banner.active = active;
    await banner.save();
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating banner' });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting banner' });
  }
});

// Update order status route
app.put('/api/update-order-status', async (req, res) => {
  const { order_id, status } = req.body;
  try {
    const user = await User.findOne({ 'orders.order_id': order_id });
    if (!user) return res.status(404).json({ message: 'Order not found' });
    const order = user.orders.find(o => o.order_id === order_id);
    order.status = status;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign order route
app.put('/api/assign-order', async (req, res) => {
  const { order_id, waiterEmail } = req.body;
  try {
    const user = await User.findOne({ 'orders.order_id': order_id });
    if (!user) return res.status(404).json({ message: 'Order not found' });
    const order = user.orders.find(o => o.order_id === order_id);
    order.waiterEmail = waiterEmail;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


//aniket stuff

const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

if (!SARVAM_API_KEY) {
  console.warn("⚠️  SARVAM_API_KEY not set in .env — voice orders will fail.");
}

app.post("/api/voiceorder", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Empty query" });
    }
    console.log("Received voice order query:", query);

    // Dynamically fetch menu items from database
    let menuDoc = await Menu.findOne();
    let itemList = [];
    if (menuDoc) {
      const itemsMap = (menuDoc.todays_items && menuDoc.todays_items.size > 0)
        ? menuDoc.todays_items
        : menuDoc.universal_items;
      for (const [_, items] of itemsMap.entries()) {
        items.forEach(it => itemList.push(it.name));
      }
    }

    // Fallback if DB menu is not populated yet
    if (itemList.length === 0) {
      itemList = [
        "Idli & Sambar", "Masala Dosa", "Poha", "Upma", "Bread Omelette", "Tea / Coffee",
        "Veg Thali", "Paneer Butter Masala with Roti", "Veg Fried Rice", "Chole Bhature", "Lemon Rice with Curd", "Rajma Chawal",
        "Veg Burger", "French Fries", "Maggi", "Samosa (2 pcs)", "Sandwich (Grilled)", "Momos (Veg/Paneer)",
        "Cold Coffee", "Fresh Lime Soda", "Mango Shake", "Iced Tea", "Buttermilk", "Water Bottle (500ml)",
        "Gulab Jamun (2 pcs)", "Ice Cream Cup", "Chocolate Brownie", "Fruit Salad", "Muffin (Chocolate/Vanilla)", "Kheer / Payasam"
      ];
    }

    const availableItemsStr = itemList.join(", ");

    const sarvamResponse = await fetch(SARVAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: "sarvam-105b-conversations",
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content: `Available Canteen Menu Items: [${availableItemsStr}].\nParse the user query to match items from this list only. Output ONLY raw JSON: {"items": [{"name": "exact item name", "quantity": 1}]}. If no menu items match, output: {"items": []}.`
          },
          { role: "user", content: query }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
    });

    if (!sarvamResponse.ok) {
      const errorText = await sarvamResponse.text();
      console.error("Sarvam API error:", errorText);
      return res.status(500).json({ error: "Sarvam API error", details: errorText });
    }

    const sarvamData = await sarvamResponse.json();
    console.log("Sarvam API Response:", JSON.stringify(sarvamData, null, 2));

    let items = [];

    if (sarvamData.choices && sarvamData.choices.length > 0) {
      try {
        const rawContent = sarvamData.choices[0].message?.content;
        if (!rawContent) {
          console.warn("Sarvam response content is empty or null");
          return res.json({ items: [] });
        }

        let content = rawContent.trim();
        console.log("Raw Sarvam content string:", content);

        // Strip markdown code fences if wrapped
        content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

        // Extract first JSON object if there's text surrounding it
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];

        const parsed = JSON.parse(content);
        items = parsed.items || [];
      } catch (parseErr) {
        console.error("Failed to parse Sarvam response:", parseErr, "Content:", sarvamData.choices[0].message?.content);
        return res.status(500).json({
          error: "Failed to parse AI response as JSON.",
          details: sarvamData.choices[0].message?.content || "No content returned"
        });
      }
    }

    console.log("Processed items:", items);
    res.json({ items });
  } catch (error) {
    console.error("Server error:", error.message, error.stack);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});



// ── Razorpay Routes ────────────────────────────────────────

// 1. Create a Razorpay order (call before opening checkout modal)
app.post('/api/razorpay/create-order', async (req, res) => {
  const { amount } = req.body; // amount in rupees from client
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paise
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
      payment_capture: 1,
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ message: 'Failed to create Razorpay order', details: err.message });
  }
});

// 2. Verify payment signature + place canteen order
app.post('/api/razorpay/verify', async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    email,
    ordertype,
    tableno,
    appliedWallet
  } = req.body;

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ message: 'Payment signature verification failed' });
  }

  // Signature valid — now place the canteen order
  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
    const subtotal = user.cart.reduce((sum, item) => sum + item.total, 0);
    const gst = subtotal * 0.05;
    const waiterCharge = ordertype === 'on table' ? 20 : 0;
    const totalBill = Number((subtotal + gst + waiterCharge).toFixed(2));
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-IN', { hour12: true });
    const order_id = 'ORD' + now.getFullYear() + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const otp = ordertype === 'on table' ? Math.floor(100000 + Math.random() * 900000).toString() : '';

    if (appliedWallet && Number(appliedWallet) > 0) {
      const walletToDeduct = Math.min(Number(appliedWallet), Number(user.wallet) || 0);
      user.wallet = Math.max(0, (Number(user.wallet) || 0) - walletToDeduct);
    }

    const order = {
      order_id,
      status: 'pending',
      tableno: tableno || '',
      ordertype,
      totalBill,
      date,
      time,
      paymentMethod: appliedWallet > 0 ? 'Razorpay + Wallet Credits' : 'Razorpay',
      razorpay_payment_id,
      otp,
      items: user.cart,
    };

    user.orders.push(order);
    user.cart = [];
    await user.save();

    res.json({ success: true, order_id, otp, remainingWallet: user.wallet });
  } catch (err) {
    console.error('Razorpay verify/order error:', err);
    res.status(500).json({ message: 'Order placement failed after payment', details: err.message });
  }
});

// Universal Order Placement endpoint (supports Cash, Wallet, and Direct Order Creation)
app.post('/api/user/order', async (req, res) => {
  const { email, ordertype = 'take away', tableno = '', paymentMethod = 'Cash', appliedWallet = 0 } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.cart || user.cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    const subtotal = user.cart.reduce((sum, item) => sum + item.total, 0);
    const gst = subtotal * 0.05;
    const waiterCharge = ordertype === 'on table' ? 20 : 0;
    const totalBill = Number((subtotal + gst + waiterCharge).toFixed(2));

    let finalPaymentMethod = paymentMethod;

    if (appliedWallet && Number(appliedWallet) > 0) {
      const walletToDeduct = Math.min(Number(appliedWallet), Number(user.wallet) || 0);
      user.wallet = Math.max(0, (Number(user.wallet) || 0) - walletToDeduct);
      finalPaymentMethod = `${paymentMethod} + Wallet Credits`;
    }

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-IN', { hour12: true });
    const order_id = 'ORD' + now.getFullYear() + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const otp = ordertype === 'on table' ? Math.floor(100000 + Math.random() * 900000).toString() : '';

    const order = {
      order_id,
      status: 'pending',
      tableno: tableno || '',
      ordertype,
      totalBill,
      date,
      time,
      paymentMethod: finalPaymentMethod,
      otp,
      items: user.cart,
    };

    user.orders.push(order);
    user.cart = [];
    await user.save();

    res.json({ success: true, order_id, otp, remainingWallet: user.wallet });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ message: 'Failed to place order', details: err.message });
  }
});

// 3. Pay using Wallet Credits
app.post('/api/wallet/pay', async (req, res) => {
  const { email, ordertype, tableno, appliedWallet } = req.body;
  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.cart || user.cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    const subtotal = user.cart.reduce((sum, item) => sum + item.total, 0);
    const gst = subtotal * 0.05;
    const waiterCharge = ordertype === 'on table' ? 20 : 0;
    const totalBill = Number((subtotal + gst + waiterCharge).toFixed(2));

    const currentWallet = Number(user.wallet) || 0;
    const walletToDeduct = appliedWallet ? Math.min(Number(appliedWallet), totalBill) : totalBill;

    if (currentWallet < walletToDeduct) {
      return res.status(400).json({ message: `Insufficient Wallet Balance! Available: ₹${currentWallet.toFixed(2)}` });
    }

    user.wallet = Math.max(0, currentWallet - walletToDeduct);

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-IN', { hour12: true });
    const order_id = 'ORD' + now.getFullYear() + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const otp = ordertype === 'on table' ? Math.floor(100000 + Math.random() * 900000).toString() : '';

    const order = {
      order_id,
      status: 'pending',
      tableno: tableno || '',
      ordertype,
      totalBill,
      date,
      time,
      paymentMethod: 'Wallet Credits',
      otp,
      items: user.cart,
    };

    user.orders.push(order);
    user.cart = [];
    await user.save();

    res.json({ success: true, order_id, otp, remainingWallet: user.wallet });
  } catch (err) {
    res.status(500).json({ message: 'Wallet payment failed', details: err.message });
  }
});

// 4. Customer Order Cancellation + Automatic Refund to Wallet Credits
app.post('/api/user/cancel-order', async (req, res) => {
  const { email, order_id } = req.body;
  if (!order_id) return res.status(400).json({ message: 'order_id is required' });

  try {
    const cleanId = order_id.trim();
    const allUsers = await User.find({});
    let targetUser = null;
    let targetOrderIndex = -1;

    for (const u of allUsers) {
      if (email && u.email && u.email.toLowerCase() === email.trim().toLowerCase()) {
        const idx = u.orders.findIndex(o => o.order_id && o.order_id.trim() === cleanId);
        if (idx !== -1) {
          targetUser = u;
          targetOrderIndex = idx;
          break;
        }
      }
      const idx = u.orders.findIndex(o => o.order_id && o.order_id.trim() === cleanId);
      if (idx !== -1) {
        targetUser = u;
        targetOrderIndex = idx;
        break;
      }
    }

    if (!targetUser || targetOrderIndex === -1) {
      return res.status(404).json({ message: 'Order or user not found' });
    }

    const order = targetUser.orders[targetOrderIndex];

    if (order.waiterName || order.waiterEmail) {
      return res.status(400).json({ message: 'Cannot cancel order because a waiter has already been assigned!' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Completed orders cannot be cancelled' });
    }

    const refundAmount = (typeof order.totalBill === 'number' && !isNaN(order.totalBill)) ? order.totalBill : 0;
    const currentWallet = (typeof targetUser.wallet === 'number' && !isNaN(targetUser.wallet)) ? targetUser.wallet : 0;
    const newWallet = Number((currentWallet + refundAmount).toFixed(2));

    targetUser.orders[targetOrderIndex].status = 'cancelled';
    targetUser.wallet = newWallet;
    targetUser.markModified('orders');
    targetUser.markModified('wallet');
    await targetUser.save();

    await User.collection.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          [`orders.${targetOrderIndex}.status`]: 'cancelled',
          wallet: newWallet
        }
      }
    );

    res.json({
      success: true,
      message: `Order #${cleanId} cancelled! ₹${refundAmount} has been refunded to your Wallet Credits!`,
      wallet: newWallet
    });
  } catch (err) {
    console.error('Customer cancel order error:', err);
    res.status(500).json({ message: 'Server error cancelling order' });
  }
});

// 5. Superadmin Order Cancellation + Automatic Refund to User Wallet
app.post('/api/cancel-order', async (req, res) => {
  const { order_id, userEmail } = req.body;
  if (!order_id) return res.status(400).json({ message: 'order_id required' });

  try {
    const cleanId = order_id.trim();
    const allUsers = await User.find({});
    let targetUser = null;
    let targetOrderIndex = -1;

    for (const u of allUsers) {
      if (userEmail && u.email && u.email.toLowerCase() === userEmail.trim().toLowerCase()) {
        const idx = u.orders.findIndex(o => o.order_id && o.order_id.trim() === cleanId);
        if (idx !== -1) {
          targetUser = u;
          targetOrderIndex = idx;
          break;
        }
      }
      const idx = u.orders.findIndex(o => o.order_id && o.order_id.trim() === cleanId);
      if (idx !== -1) {
        targetUser = u;
        targetOrderIndex = idx;
        break;
      }
    }

    if (!targetUser || targetOrderIndex === -1) {
      return res.status(404).json({ message: 'Order or user not found' });
    }

    const order = targetUser.orders[targetOrderIndex];
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    const refundAmount = (typeof order.totalBill === 'number' && !isNaN(order.totalBill)) ? order.totalBill : 0;
    const currentWallet = (typeof targetUser.wallet === 'number' && !isNaN(targetUser.wallet)) ? targetUser.wallet : 0;
    const newWallet = Number((currentWallet + refundAmount).toFixed(2));

    targetUser.orders[targetOrderIndex].status = 'cancelled';
    targetUser.wallet = newWallet;
    targetUser.markModified('orders');
    targetUser.markModified('wallet');
    await targetUser.save();

    await User.collection.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          [`orders.${targetOrderIndex}.status`]: 'cancelled',
          wallet: newWallet
        }
      }
    );

    res.json({
      success: true,
      message: `Order #${cleanId} cancelled! ₹${refundAmount} refunded to ${targetUser.email}'s wallet. New Balance: ₹${newWallet}`,
      wallet: newWallet
    });
  } catch (err) {
    console.error('Superadmin cancel order error:', err);
    res.status(500).json({ message: 'Server error cancelling order', details: err.message });
  }
});

// 6. Get User Wallet Credits Balance
app.get('/api/user/wallet', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email required' });
  try {
    const user = await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ wallet: Number(user.wallet) || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Health check route for cloud deployment
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'DineGo Backend API', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));