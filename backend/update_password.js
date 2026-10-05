const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect('mongodb://127.0.0.1:27017/digiex_hrms')
  .then(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('12345678', salt);
    const user = await User.findOneAndUpdate(
      { email: 'arup@digiexweb.com' },
      { password: hashedPassword },
      { new: true }
    );
    if (user) {
      console.log('Password updated successfully for arup@digiexweb.com');
    } else {
      console.log('User not found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
