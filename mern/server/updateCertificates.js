const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/training_system').then(async () => {
  const Certificate = require('./models/Certificate');
  const Training = require('./models/Training');
  
  console.log('Updating certificates...');
  
  // Update all certificates to have expiresAt based on training's validityPeriod
  const certs = await Certificate.find().populate('training');
  
  for (const cert of certs) {
    if (!cert.status) cert.status = 'active';
    
    if (cert.training && cert.training.validityPeriod > 0) {
      const expiresAt = new Date(cert.issuedAt);
      expiresAt.setMonth(expiresAt.getMonth() + cert.training.validityPeriod);
      cert.expiresAt = expiresAt;
      console.log('Updated:', cert.training.title, '-> expires:', expiresAt);
    } else {
      cert.expiresAt = null;
      console.log('Updated:', cert.training?.title || 'Unknown', '-> no expiry');
    }
    await cert.save();
  }
  
  console.log('Done! Updated', certs.length, 'certificates');
  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
