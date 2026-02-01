const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Backup configuration
const config = {
  database: 'training_system',
  backupDir: path.join(__dirname, '../backups'),
  maxBackups: 10 // Keep last 10 backups
};

// Create backup directory if not exists
if (!fs.existsSync(config.backupDir)) {
  fs.mkdirSync(config.backupDir, { recursive: true });
}

// Generate backup filename with timestamp
const getBackupName = () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `backup_${timestamp}`;
};

// Clean old backups (keep only maxBackups)
const cleanOldBackups = () => {
  const backups = fs.readdirSync(config.backupDir)
    .filter(f => f.startsWith('backup_'))
    .sort()
    .reverse();

  if (backups.length > config.maxBackups) {
    const toDelete = backups.slice(config.maxBackups);
    toDelete.forEach(backup => {
      const backupPath = path.join(config.backupDir, backup);
      fs.rmSync(backupPath, { recursive: true, force: true });
      console.log(`🗑️  Deleted old backup: ${backup}`);
    });
  }
};

// Run backup
const runBackup = () => {
  const backupName = getBackupName();
  const backupPath = path.join(config.backupDir, backupName);

  console.log(`\n📦 Starting MongoDB backup...`);
  console.log(`Database: ${config.database}`);
  console.log(`Backup path: ${backupPath}`);

  const command = `mongodump --db ${config.database} --out "${backupPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      return;
    }

    console.log(`✅ Backup completed: ${backupName}`);
    
    // Get backup size
    const getDirectorySize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += stat.size;
        }
      });
      return size;
    };

    const size = getDirectorySize(backupPath);
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`📊 Backup size: ${sizeKB} KB`);

    // Clean old backups
    cleanOldBackups();

    // List current backups
    console.log(`\n📁 Available backups:`);
    const backups = fs.readdirSync(config.backupDir)
      .filter(f => f.startsWith('backup_'))
      .sort()
      .reverse();
    backups.forEach((b, i) => console.log(`   ${i + 1}. ${b}`));
  });
};

// Run if called directly
if (require.main === module) {
  runBackup();
}

module.exports = { runBackup, config };
