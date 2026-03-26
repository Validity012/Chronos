#!/usr/bin/env node
'use strict';
require('dotenv').config();

console.log('\n🧙 Finley Finance Coach — Setup Wizard\n');
console.log('Before we begin, you need TWO free API keys.\n');

const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const hasTelegram = envConfig.TELEGRAM_BOT_TOKEN && envConfig.TELEGRAM_BOT_TOKEN !== 'placeholder_replace_me';
const hasGroq = envConfig.GROQ_API_KEY && envConfig.GROQ_API_KEY !== 'placeholder_replace_me';

if (hasTelegram && hasGroq) {
  console.log('✅ Both API keys are configured!');
  console.log('\n🚀 Run the bot with: npm start\n');
  return;
}

console.log('═══════════════════════════════════════════');
console.log('STEP 1: Get your Telegram Bot Token (free)');
console.log('═══════════════════════════════════════════');
console.log('1. Open Telegram and search for @BotFather');
console.log('2. Send /newbot');
console.log('3. Follow the prompts — give it a name and username');
console.log('4. Copy the token it gives you (looks like: 123456789:ABCdef...)');
console.log();

if (!hasTelegram) {
  console.log('Paste your Telegram bot token here:');
  process.stdin.setEncoding('utf8');
  let token = '';
  process.stdin.on('data', (chunk) => { token += chunk; });
  process.stdin.on('end', () => {
    token = token.trim();
    if (token) {
      updateEnv('TELEGRAM_BOT_TOKEN', token);
      console.log('\n✅ Telegram token saved!');
      if (!hasGroq) askGroq();
      else finish();
    }
  });
  return;
}

if (!hasGroq) askGroq();
else finish();

function askGroq() {
  console.log('═══════════════════════════════════════════');
  console.log('STEP 2: Get your Groq API Key (FREE — no credit card)');
  console.log('═══════════════════════════════════════════');
  console.log('1. Go to https://console.groq.com/');
  console.log('2. Click "Sign Up" — use Google or email');
  console.log('3. Go to API Keys → Create new key');
  console.log('4. Copy it (starts with gsk_)');
  console.log('\n⚡ Groq gives you Llama 3.3 70B — completely FREE,');
  console.log('   no credit card, ~300 tokens/second!');
  console.log('\nPaste your Groq API key here:');
  
  process.stdin.setEncoding('utf8');
  let key = '';
  process.stdin.on('data', (chunk) => { key += chunk; });
  process.stdin.on('end', () => {
    key = key.trim();
    if (key) {
      updateEnv('GROQ_API_KEY', key);
      console.log('\n✅ Groq key saved!');
      finish();
    }
  });
}

function updateEnv(key, value) {
  let content = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, content);
}

function finish() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🎉 All set! Run: npm start');
  console.log('═══════════════════════════════════════════\n');
  console.log('Then open Telegram and message your bot.\n');
  console.log('Quick examples to try:');
  console.log('  "spent $45 on groceries"');
  console.log('  "coffee $3.50"');
  console.log('  "got paid $500 freelance"');
  console.log('  "how much did I spend this month?"');
  console.log('  "show my business expenses"');
  console.log();
}
