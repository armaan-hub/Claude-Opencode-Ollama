#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { authCommand } = require('./commands/auth');
const { switchCommand } = require('./commands/switch');
const { statusCommand } = require('./commands/status');

const program = new Command();

program
  .name('gh heer')
  .description('Multi-provider LLM authentication for GitHub CLI')
  .version('1.0.0');

program
  .command('auth [org]')
  .description('Authenticate with GitHub Org Secrets')
  .action(async (org) => {
    try {
      await authCommand(org || 'heer-org');
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('switch <model>')
  .description('Switch to a different LLM model')
  .action(async (model) => {
    try {
      await switchCommand(model);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show authentication and proxy status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
