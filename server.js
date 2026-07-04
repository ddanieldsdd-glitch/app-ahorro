const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const defaultData = {
  transactions: [],
  categories: ['Comida', 'Bebida', 'Salidas', 'Caprichos', 'Transporte', 'Vivienda', 'Salud', 'Educación', 'Imprevisto', 'Otros'],
  types: ['Ingreso', 'Gasto'],
  paymentMethods: ['Efectivo', 'Tarjeta', 'Bizum', 'Transferencia'],
  currentMonth: null,
  archives: {},
  budgetConfig: { weeklyIncome: 70, monthlyExtra: 100, categoryLimits: {} },
  savingGoals: [],
  roundUpEnabled: true,
  roundUpGoalId: null,
  totalRoundUpSavings: 0,
  foodBudget: 200,
  imprevistosBudget: 0,
  imprevistosSavings: 0,
  plannedExpenses: [],
  plannedExpensesReserved: 0,
  lastSavingsWeek: null,
  lastPEReserveWeek: null,
  savingsDay: 1,
  debts: [],
  checkingBalance: null,
  checkingBaseBalance: 0,
  savingsBalance: 0,
  transfers: [],
  pinCode: null,
  _lastModified: 0,
};

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.budgetConfig) data.budgetConfig = { weeklyIncome: 70, monthlyExtra: 100, categoryLimits: {} };
    if (!data.savingGoals) data.savingGoals = [];
    if (data.roundUpEnabled === undefined) data.roundUpEnabled = true;
    if (!data.totalRoundUpSavings) data.totalRoundUpSavings = 0;
    if (!data.plannedExpenses) data.plannedExpenses = [];
    if (!data.plannedExpensesReserved && data.plannedExpensesReserved !== 0) data.plannedExpensesReserved = 0;
    if (!data.imprevistosBudget && data.imprevistosBudget !== 0) data.imprevistosBudget = 0;
    if (data.categories.indexOf('Imprevisto') === -1) data.categories.push('Imprevisto');
    if (!data.checkingBaseBalance && data.checkingBaseBalance !== 0) data.checkingBaseBalance = 0;
    if (!data.imprevistosSavings && data.imprevistosSavings !== 0) data.imprevistosSavings = 0;
    if (data.lastSavingsWeek === undefined) data.lastSavingsWeek = null;
    if (data.lastPEReserveWeek === undefined) data.lastPEReserveWeek = null;
    if (data.savingsDay === undefined) data.savingsDay = 1;
    if (!data.debts) data.debts = [];
    return data;
  } catch {
    const now = new Date();
    defaultData.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    defaultData._lastModified = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return { ...defaultData };
  }
}

function writeData(data) {
  data._lastModified = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/data', (req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/data', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }
    writeData(data);
    res.json({ ok: true, lastModified: data._lastModified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n  App corriendo en:\n`);
  console.log(`    Local:    http://localhost:${PORT}`);
  console.log(`    Red:      http://${localIP}:${PORT}`);
  console.log(`\n  Abre la URL de Red desde tu móvil (misma red WiFi)\n`);
});
