'use strict';
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const handlers = require('./handlers');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN === 'placeholder_replace_me') {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN. Check your .env file.');
  process.exit(1);
}

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY || GROQ_KEY === 'placeholder_replace_me') {
  console.error('❌ Missing GROQ_API_KEY. Check your .env file.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const H = handlers(bot);

bot.onText(/\/start/,            (msg) => H.cmdStart(msg));
bot.onText(/\/help/,             (msg) => H.cmdHelp(msg));
bot.onText(/\/accounts/,         (msg) => H.cmdAccounts(msg));
bot.onText(/\/balance/,          (msg) => H.cmdBalance(msg));
bot.onText(/\/budgets/,          (msg) => H.cmdBudgets(msg));
bot.onText(/\/spend/,            (msg) => H.cmdSpend(msg));
bot.onText(/\/income/,           (msg) => H.cmdIncome(msg));
bot.onText(/\/insights/,         (msg) => H.cmdInsights(msg));
bot.onText(/\/month/,            (msg) => H.cmdMonth(msg));
bot.onText(/\/recent/,           (msg) => H.cmdRecent(msg));
bot.onText(/\/categories/,       (msg) => H.cmdCategories(msg));
bot.onText(/\/setbudget/,        (msg) => H.cmdSetBudget(msg));
bot.onText(/\/allowance/,        (msg) => H.cmdAllowance(msg));
bot.onText(/\/transfer/,         (msg) => H.cmdTransfer(msg));
bot.onText(/\/search (.+)/,      (msg, m) => H.cmdSearch(msg, m[1]));

bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/') && msg.chat) {
    H.handleMessage(msg);
  }
});

bot.on('polling_error', (err) => {
  console.error('⚠️ Polling error:', err.message);
});

console.log('✅ Finley Finance Coach is running!');
console.log('📱 Send /start to your Telegram bot to begin.');
