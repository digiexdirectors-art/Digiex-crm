const mongoose = require('mongoose');
const ClientPackage = require('./models/ClientPackage');

mongoose.connect('mongodb://127.0.0.1:27017/digiex_hrms')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const pkgs = await ClientPackage.find({}).populate('client');
    pkgs.forEach(p => {
      console.log(`Package ID: ${p._id}, Client: ${p.client ? p.client.name : 'None'}, Status: ${p.status}, CreatedAt: ${p.createdAt}`);
    });
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
  });
