const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Configuration
const config = {
  database: 'training_system',
  backupDir: path.join(__dirname, '../backups')
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// List available backups
const listBackups = () => {
  if (!fs.existsSync(config.backupDir)) {
    console.log('❌ No backups found');
    return [];
  }

  const backups = fs.readdirSync(config.backupDir)
    .filter(f => f.startsWith('backup_'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.log('❌ No backups found');
    return [];
  }

  console.log('\n📁 Available backups:');
  backups.forEach((b, i) => {
    const backupPath = path.join(config.backupDir, b);
    const stats = fs.statSync(backupPath);
    const date = b.replace('backup_', '').replace('T', ' ').replace(/-/g, ':').slice(0, 19).replace(/:/g, '-', 2);
    console.log(`   ${i + 1}. ${b} (${stats.mtime.toLocaleString()})`);
  });

  return backups;
};

// Restore from backup
const restore = (backupName) => {
  const backupPath = path.join(config.backupDir, backupName, config.database);

  if (!fs.existsSync(backupPath)) {
    console.log(`❌ Backup not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`\n⚠️  WARNING: This will overwrite the current database!`);
  console.log(`Database: ${config.database}`);
  console.log(`Restore from: ${backupName}`);

  rl.question('\nAre you sure? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Restore cancelled');
      rl.close();
      return;
    }

    console.log(`\n🔄 Restoring database...`);

    const command = `mongorestore --db ${config.database} --drop "${backupPath}"`;

    exec(command, (error, stdout, stderr) => {
      rl.close();
      
      if (error) {
        console.error(`❌ Restore failed: ${error.message}`);
        return;
      }

      console.log(`✅ Database restored from: ${backupName}`);
      console.log(`\n📝 Please restart the server to apply changes.`);
    });
  });
};

// Main
const main = () => {
  const args = process.argv.slice(2);

  if (args[0] === 'list' || args.length === 0) {
    const backups = listBackups();
    
    if (backups.length > 0 && args[0] !== 'list') {
      rl.question('\nEnter backup number to restore (or press Enter to cancel): ', (answer) => {
        if (!answer) {
          console.log('Cancelled');
          rl.close();
          return;
        }

        const index = parseInt(answer) - 1;
        if (index >= 0 && index < backups.length) {
          restore(backups[index]);
        } else {
          console.log('Invalid selection');
          rl.close();
        }
      });
    } else {
      rl.close();
    }
  } else {
    // Direct restore with backup name
    restore(args[0]);
  }
};

main();
