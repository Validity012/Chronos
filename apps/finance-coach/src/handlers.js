'use strict';
const groq = require('./groq');
const models = require('./models');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTx(tx, currency = 'USD') {
  const sign = tx.type === 'income' ? '+' : '-';
  const icon = tx.category_icon || (tx.type === 'income' ? '💰' : '💸');
  const cat = tx.category_name || '—';
  return `${icon} ${formatDate(tx.date)}  ${escapeHtml(tx.description || cat)}\n   ${sign}${formatCurrency(tx.amount, currency)}  ${cat}`;
}

module.exports = function(bot) {

  async function sendTyping(chatId) {
    try { bot.sendChatAction(chatId, 'typing'); } catch {}
  }

  async function reply(msg, text, opts = {}) {
    try {
      return await bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        reply_to_message_id: opts.replyTo ? msg.message_id : undefined,
        ...opts,
      });
    } catch (err) {
      console.error('Send error:', err.message);
    }
  }

  function cmdStart(msg) {
    reply(msg, `
👋 <b>Welcome to Finley!</b> Your personal finance coach.

I help you track:
• 💸 Expenses & spending habits
• 💼 Business income & expenses
• 👨‍👩‍👧 Allowances & family finances
• 📊 Budgets & savings goals

<b>Quick start:</b>
Just type naturally — no commands needed!

Examples:
  "spent $45 on groceries"
  "coffee $3.50"
  "got paid $500 freelance"
  "allowance for kids $20"
  "how much did I spend this month?"
  "show my business expenses"

<b>Commands:</b>
/help - Show all commands
/balance - Account balances
/spend [amount] [desc] - Log expense
/income [amount] [desc] - Log income
/budgets - View budgets
/insights - Get AI coaching
/month - Monthly summary
/recent - Recent transactions
/accounts - All accounts
/categories - All categories
/setbudget [cat] [amount] - Set a budget
/allowance [amount] [for] - Log allowance
/transfer [amount] [from] [to] - Transfer
/search [query] - Search transactions
    `.trim());
  }

  function cmdHelp(msg) { cmdStart(msg); }

  async function cmdAccounts(msg) {
    await sendTyping(msg.chat.id);
    const accounts = models.accounts.list();
    const currency = 'USD';
    let text = '🏦 <b>Your Accounts</b>\n\n';
    for (const acc of accounts) {
      const sign = acc.balance >= 0 ? '+' : '';
      const emoji = acc.type === 'business' ? '💼' : acc.type === 'allowance' ? '👨‍👩‍👧' : '🏠';
      text += `${emoji} <b>${escapeHtml(acc.name)}</b>\n   Balance: ${sign}${formatCurrency(acc.balance, currency)}\n\n`;
    }
    reply(msg, text.trim());
  }

  async function cmdBalance(msg) {
    await sendTyping(msg.chat.id);
    const accounts = models.accounts.list();
    const currency = 'USD';
    let totalIncome = 0, totalExpense = 0;
    const summary = models.getMonthlySummary();
    totalIncome = summary?.total_income || 0;
    totalExpense = summary?.total_expense || 0;
    const net = totalIncome - totalExpense;

    let text = '💰 <b>Balance Overview</b>\n';
    text += `This month: +${formatCurrency(totalIncome, currency)} / -${formatCurrency(totalExpense, currency)}\n`;
    text += `Net: ${net >= 0 ? '🟢' : '🔴'} <b>${net >= 0 ? '+' : ''}${formatCurrency(net, currency)}</b>\n\n`;
    for (const acc of accounts) {
      const sign = acc.balance >= 0 ? '+' : '';
      text += `• ${escapeHtml(acc.name)}: ${sign}${formatCurrency(acc.balance, currency)}\n`;
    }
    reply(msg, text.trim());
  }

  async function cmdBudgets(msg) {
    await sendTyping(msg.chat.id);
    const budgets = models.budgets.getForMonth();
    if (!budgets.length) {
      return reply(msg, '📋 <b>No budgets set.</b>\n\nUse /setbudget [category] [amount] to set one.\nExample: /setbudget Food & Dining 500');
    }
    let text = '📋 <b>Monthly Budgets</b>\n\n';
    for (const b of budgets) {
      const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
      const bar = pct >= 100 ? '🔴' : pct >= 75 ? '🟡' : '🟢';
      const remaining = Math.max(0, b.amount - b.spent);
      text += `${b.category_icon || '📦'} ${escapeHtml(b.category_name)}\n`;
      text += `   ${formatCurrency(b.spent)} / ${formatCurrency(b.amount)} ${bar} ${pct}%\n`;
      text += `   Left: ${formatCurrency(remaining, 'USD')}\n\n`;
    }
    reply(msg, text.trim());
  }

  async function cmdSpend(msg, extra) {
    await sendTyping(msg.chat.id);
    const parts = msg.text.split(' ');
    if (parts.length >= 2) {
      const amount = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
      const desc = parts.slice(2).join(' ') || 'Expense';
      if (!isNaN(amount) && amount > 0) {
        const parsed = await groq.parseTransaction(`spent ${amount} on ${desc}`);
        const account = await resolveAccount(parsed.account || 'Personal');
        const category = await resolveCategory(parsed.category || 'Other', 'expense');
        const tx = models.transactions.add({
          accountId: account.id,
          categoryId: category.id,
          amount,
          type: 'expense',
          description: desc,
          date: parsed.date || undefined,
        });
        return reply(msg, `✅ <b>Expense logged!</b>\n💸 ${formatCurrency(amount)} — ${escapeHtml(desc)}\n🏦 Account: ${account.name}\n📂 Category: ${category.icon} ${category.name}`);
      }
    }
    reply(msg, 'Usage: /spend [amount] [description]\nExample: /spend 45 groceries');
  }

  async function cmdIncome(msg) {
    await sendTyping(msg.chat.id);
    const parts = msg.text.split(' ');
    if (parts.length >= 2) {
      const amount = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
      const desc = parts.slice(2).join(' ') || 'Income';
      if (!isNaN(amount) && amount > 0) {
        const parsed = await groq.parseTransaction(`received ${amount} ${desc}`);
        const account = await resolveAccount(parsed.account || 'Personal');
        const category = await resolveCategory(parsed.category || 'Salary', 'income');
        models.transactions.add({
          accountId: account.id,
          categoryId: category.id,
          amount,
          type: 'income',
          description: desc,
        });
        return reply(msg, `✅ <b>Income logged!</b>\n💰 +${formatCurrency(amount)} — ${escapeHtml(desc)}\n🏦 Account: ${account.name}\n📂 Category: ${category.icon} ${category.name}`);
      }
    }
    reply(msg, 'Usage: /income [amount] [description]\nExample: /income 500 freelance');
  }

  async function cmdInsights(msg) {
    await sendTyping(msg.chat.id);
    await reply(msg, '🤖 Analyzing your finances...');
    try {
      const summary = models.getAISummary();
      const insight = await groq.generateInsights(summary);
      reply(msg, `📊 <b>Your Finance Insights</b>\n\n${insight}`);
    } catch (err) {
      console.error('Insight error:', err.message);
      reply(msg, '❌ Could not generate insights. Try again in a moment.');
    }
  }

  async function cmdMonth(msg) {
    await sendTyping(msg.chat.id);
    const summary = models.getAISummary();
    const { currentMonth: cm, trends, topCategoriesThisMonth: top } = summary;
    const m = new Date().toLocaleString('default', { month: 'long' });
    let text = `📅 <b>${m} Summary</b>\n\n`;
    text += `💰 Income: +${formatCurrency(cm.income)}\n`;
    text += `💸 Expenses: -${formatCurrency(cm.expenses)}\n`;
    const net = cm.income - cm.expenses;
    text += `${net >= 0 ? '🟢' : '🔴'} Net: <b>${net >= 0 ? '+' : ''}${formatCurrency(net)}</b>\n`;
    if (top && top.length) {
      text += `\n<b>Top spending:</b>\n`;
      for (const c of top.slice(0, 5)) {
        text += `${c.icon} ${c.name}: ${formatCurrency(c.total)}\n`;
      }
    }
    reply(msg, text.trim());
  }

  async function cmdRecent(msg) {
    await sendTyping(msg.chat.id);
    const txs = models.transactions.list({ limit: 10 });
    if (!txs.length) return reply(msg, '📭 No transactions yet. Start by typing something like "spent $20 on lunch"!');
    let text = '📜 <b>Recent Transactions</b>\n\n';
    for (const tx of txs) {
      const sign = tx.type === 'income' ? '+' : '-';
      const icon = tx.category_icon || (tx.type === 'income' ? '💰' : '💸');
      text += `${icon} ${formatDate(tx.date)}  ${escapeHtml(tx.description || tx.category_name || tx.type)}\n`;
      text += `   ${sign}${formatCurrency(tx.amount)}  ${tx.category_name || ''}\n\n`;
    }
    reply(msg, text.trim());
  }

  async function cmdCategories(msg) {
    const cats = models.categories.list();
    const expense = cats.filter(c => c.type === 'expense');
    const income = cats.filter(c => c.type === 'income');
    let text = '📂 <b>Categories</b>\n\n<b>Expenses:</b>\n';
    text += expense.map(c => `${c.icon} ${escapeHtml(c.name)}`).join('\n');
    text += '\n\n<b>Income:</b>\n';
    text += income.map(c => `${c.icon} ${escapeHtml(c.name)}`).join('\n');
    reply(msg, text);
  }

  async function cmdSetBudget(msg) {
    const parts = msg.text.split(/\s+/);
    if (parts.length < 3) {
      return reply(msg, 'Usage: /setbudget [category] [amount]\nExample: /setbudget Food 500');
    }
    const catName = parts.slice(1, -1).join(' ');
    const amount = parseFloat(parts[parts.length - 1].replace(/[^0-9.]/g, ''));
    if (!catName || isNaN(amount) || amount <= 0) {
      return reply(msg, 'Invalid. Usage: /setbudget Food 500');
    }
    const category = await resolveCategory(catName, 'expense');
    models.budgets.set(category.id, null, amount, 'monthly');
    reply(msg, `✅ Budget set!\n📂 ${category.icon} ${category.name}: ${formatCurrency(amount)}/month`);
  }

  async function cmdAllowance(msg) {
    const parts = msg.text.split(/\s+/);
    if (parts.length < 2) {
      return reply(msg, 'Usage: /allowance [amount] [for]\nExample: /allowance 20 kids');
    }
    const amount = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    const desc = parts.slice(2).join(' ') || 'Family Allowance';
    if (isNaN(amount) || amount <= 0) {
      return reply(msg, 'Invalid amount. Usage: /allowance 20 kids');
    }
    const account = models.accounts.get('Family Allowance');
    const category = await resolveCategory('Allowance', 'income');
    models.transactions.add({
      accountId: account.id,
      categoryId: category.id,
      amount,
      type: 'allowance',
      description: desc,
    });
    reply(msg, `✅ Allowance logged!\n👨‍👩‍👧 +${formatCurrency(amount)} — ${escapeHtml(desc)}`);
  }

  async function cmdTransfer(msg) {
    const parts = msg.text.split(/\s+/);
    if (parts.length < 4) {
      return reply(msg, 'Usage: /transfer [amount] [from account] [to account]\nExample: /transfer 100 Personal Business');
    }
    const amount = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    const fromName = parts[2];
    const toName = parts.slice(3).join(' ');
    if (isNaN(amount) || amount <= 0) {
      return reply(msg, 'Invalid amount.');
    }
    const fromAcc = models.accounts.get(fromName);
    const toAcc = models.accounts.get(toName);
    if (!fromAcc || !toAcc) {
      return reply(msg, 'Account not found. Use /accounts to see available accounts.');
    }
    models.transactions.add({
      accountId: fromAcc.id,
      categoryId: models.categories.getDefault('transfer').id,
      amount,
      type: 'expense',
      description: `Transfer to ${toAcc.name}`,
    });
    models.transactions.add({
      accountId: toAcc.id,
      categoryId: models.categories.getDefault('transfer').id,
      amount,
      type: 'income',
      description: `Transfer from ${fromAcc.name}`,
    });
    reply(msg, `✅ Transferred ${formatCurrency(amount)} from ${fromAcc.name} → ${toAcc.name}`);
  }

  async function cmdSearch(msg, query) {
    await sendTyping(msg.chat.id);
    const txs = models.transactions.list({ limit: 20 });
    const results = txs.filter(tx =>
      (tx.description || '').toLowerCase().includes(query.toLowerCase()) ||
      (tx.category_name || '').toLowerCase().includes(query.toLowerCase())
    );
    if (!results.length) return reply(msg, `No transactions found for "${escapeHtml(query)}"`);
    let text = `🔍 <b>Results for "${escapeHtml(query)}"</b>\n\n`;
    for (const tx of results.slice(0, 10)) {
      const sign = tx.type === 'income' ? '+' : '-';
      text += `${tx.category_icon || '📦'} ${formatDate(tx.date)}  ${escapeHtml(tx.description)}\n   ${sign}${formatCurrency(tx.amount)}\n\n`;
    }
    reply(msg, text.trim());
  }

  async function handleMessage(msg) {
    if (!msg.text || msg.text.startsWith('/')) return;
    await sendTyping(msg.chat.id);
    const text = msg.text.trim();
    try {
      const parsed = await groq.parseTransaction(text);
      if (parsed.action === 'unknown' || parsed.amount === 0) {
        const summary = models.getAISummary();
        const answer = await groq.answerQuery(text, summary);
        return reply(msg, `🤖 <b>Finley says:</b>\n\n${answer}`);
      }

      if (parsed.action === 'query') {
        const summary = models.getAISummary();
        const answer = await groq.answerQuery(parsed.intent || text, summary);
        return reply(msg, `🤖 <b>Finley says:</b>\n\n${answer}`);
      }

      if (parsed.action === 'expense' || parsed.action === 'income') {
        const account = await resolveAccount(parsed.account || 'Personal', parsed.action);
        const category = await resolveCategory(parsed.category || 'Other', parsed.action);
        const txType = parsed.action === 'expense' ? 'expense' : 'income';
        const amount = Math.abs(parsed.amount);
        const description = parsed.description || text;
        models.transactions.add({
          accountId: account.id,
          categoryId: category.id,
          amount,
          type: txType,
          description,
          date: parsed.date || undefined,
          tags: parsed.tags || [],
        });

        const sign = txType === 'income' ? '+' : '-';
        const icon = txType === 'income' ? '💰' : '💸';
        const verb = txType === 'income' ? 'received' : 'spent';
        reply(msg, `${icon} <b>Logged!</b>\n${sign}${formatCurrency(amount)} ${verb} on ${escapeHtml(description)}\n📂 ${category.icon} ${category.name} • 🏦 ${account.name}`);

        const summary = models.getAISummary();
        const budgets = summary.budgets.filter(b =>
          b.category.toLowerCase() === category.name.toLowerCase()
        );
        if (budgets.length) {
          for (const b of budgets) {
            if (b.percentUsed >= 80) {
              reply(msg, `⚠️ <b>Budget alert!</b> You've used ${b.percentUsed}% of your ${category.name} budget (${formatCurrency(b.spent)} of ${formatCurrency(b.budget)}).`);
            }
          }
        }
        return;
      }

      if (parsed.action === 'allowance') {
        const account = models.accounts.get('Family Allowance');
        const category = await resolveCategory('Allowance', 'income');
        models.transactions.add({
          accountId: account.id,
          categoryId: category.id,
          amount: Math.abs(parsed.amount),
          type: 'allowance',
          description: parsed.description || text,
          date: parsed.date || undefined,
        });
        return reply(msg, `✅ Allowance logged!\n👨‍👩‍👧 +${formatCurrency(Math.abs(parsed.amount))} for ${escapeHtml(parsed.description || 'family')}`);
      }

      if (parsed.action === 'budget') {
        const cat = await resolveCategory(parsed.category || 'Other', 'expense');
        models.budgets.set(cat.id, null, Math.abs(parsed.amount), 'monthly');
        return reply(msg, `✅ Monthly budget set!\n📂 ${cat.icon} ${cat.name}: ${formatCurrency(Math.abs(parsed.amount))}/month`);
      }

      if (parsed.action === 'goal') {
        return reply(msg, `🎯 Got it — I'll remember your savings goal: ${escapeHtml(parsed.description)} of ${formatCurrency(Math.abs(parsed.amount))}. Want me to set up a /setbudget for it too?`);
      }

      const summary = models.getAISummary();
      const answer = await groq.answerQuery(text, summary);
      reply(msg, `🤖 <b>Finley says:</b>\n\n${answer}`);

    } catch (err) {
      console.error('Handle message error:', err.message);
      reply(msg, '❌ Something went wrong. Try again!');
    }
  }

  async function resolveAccount(name, type = 'expense') {
    name = (name || 'Personal').trim();
    if (name === 'auto') name = 'Personal';
    const account = models.accounts.get(name);
    if (account) return account;
    if (name.toLowerCase().includes('business') || type === 'income' && (name || '').toLowerCase().includes('freelance')) {
      return models.accounts.get('Business');
    }
    return models.accounts.get('Personal');
  }

  async function resolveCategory(name, type) {
    name = (name || 'Other').trim();
    let cat = models.categories.get(name);
    if (cat && cat.type === type) return cat;
    if (type === 'income') {
      cat = models.categories.get(name);
      if (cat) return cat;
      return models.categories.getDefault('income') || { id: null, name: 'Other', icon: '📦' };
    }
    cat = models.categories.get(name);
    if (cat) return cat;
    return models.categories.getDefault('expense') || { id: null, name: 'Other', icon: '📦' };
  }

  return {
    cmdStart, cmdHelp, cmdAccounts, cmdBalance, cmdBudgets,
    cmdSpend, cmdIncome, cmdInsights, cmdMonth, cmdRecent,
    cmdCategories, cmdSetBudget, cmdAllowance, cmdTransfer, cmdSearch,
    handleMessage,
  };
};
