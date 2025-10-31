import { Injectable, Inject } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import async from 'async';


@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  
  state(scope: string) {
    return this.states[scope];
  }

  // Build account categories for Financial Statement
  // Returns a structured object categorizing accounts
  private buildCategories() {
    return  {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
}

 
// Main function to generate all reports
// Reads and processes files in parallel with a limit
// Generates reports concurrently
// Updates states accordingly

  async generateAllReports() {

    this.states.accounts = 'starting';
    this.states.fs = 'starting';
    this.states.yearly = 'starting';
    const tmpDir = './tmp';
    const start = performance.now();

    
    const accountBalances: Record<string, number> = {};
    const cashByYear: Record<string, number> = {};

    
    try {
      const files = await fs.readdir(tmpDir, { withFileTypes: true });

      // Process files in parallel with a limit
      await async.mapLimit(files, 50, async (file) => {
        if (file.isFile() && file.name.endsWith('.csv')) {
          const filePath = path.join(tmpDir, file.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');

          for (const line of lines) {
            const [date, account, , debit, credit] = line.split(',');
            
            if (!accountBalances[account]) {
              accountBalances[account] = 0;
            }
            const debitAmount = parseFloat(debit || '0');
            const creditAmount = parseFloat(credit || '0');
            accountBalances[account] += debitAmount - creditAmount;

            if (account === 'Cash') {
              const year = new Date(date).getFullYear();
              if (!cashByYear[year]) {
                cashByYear[year] = 0;
              }
              cashByYear[year] += debitAmount - creditAmount;
            }
          }
        }
      });


    } catch (error) {
      this.states.accounts = 'error';
      this.states.fs = 'error';
      this.states.yearly = 'error';

      throw error;
    }


    // Generate reports concurrently 
    // and wait for all to complete
    // Update states based on success or failure
    await Promise.all([
      this.generateAccounts(accountBalances, start),
      this.generateYearly(cashByYear, start),
      this.generateFS(accountBalances, start),
    ]);
  }



  // Generate Accounts Report
  private async generateAccounts( accountBalances: Record<string, number>, start: number) {
    const outputFile = path.join('./out', 'accounts.csv');

    try {
      const output = ['Account,Balance'];
      for (const [account, balance] of Object.entries(accountBalances)) {
        output.push(`${account},${balance.toFixed(2)}`);
      }

      await fs.writeFile(outputFile, output.join('\n'));
      this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.accounts = `failed after ${((performance.now() - start) / 1000).toFixed(2)}`;
      throw error;
    }
  }

  private async generateYearly(cashByYear: Record<string, number>, start: number) {
    const outputFile = path.join('./out', 'yearly.csv');

    try {
      const output = ['Financial Year,Cash Balance'];
      Object.keys(cashByYear)
        .sort()
        .forEach((year) => {
          output.push(`${year},${cashByYear[year].toFixed(2)}`);
        });

      await fs.writeFile(outputFile, output.join('\n'));
      this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.yearly = `failed after ${((performance.now() - start) / 1000).toFixed(2)}`;
      throw error;
    }
  }


  private async generateFS(accountBalances: Record<string, number>, start: number) {
    const outputFile = path.join('./out', 'fs.csv');
    
    const categories = this.buildCategories();

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = accountBalances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = accountBalances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = accountBalances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = accountBalances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = accountBalances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );

    try {
      await fs.writeFile(outputFile, output.join('\n'));
      this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
    } catch (error) {
      this.states.fs = `failed after ${((performance.now() - start) / 1000).toFixed(2)}`;
      throw error;
    }
  }
}
