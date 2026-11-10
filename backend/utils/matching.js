const Item = require('../models/Item');
const nodemailer = require('nodemailer');

// Configure email transporter (optional)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Find matching items based on category and location
 * @param {Object} item - The item to find matches for
 * @returns {Array} - Array of matching items
 */
exports.findMatches = async (item) => {
  try {
    // Determine opposite type (if lost, find found items and vice versa)
    const oppositeType = item.type === 'lost' ? 'found' : 'lost';

    // Find items with same category and similar location
    const matches = await Item.find({
      type: oppositeType,
      category: item.category,
      location: { $regex: item.location, $options: 'i' },
      status: 'active',
      _id: { $ne: item._id } // Exclude the current item
    })
    .populate('user', 'name email phone')
    .limit(10);

    return matches;
  } catch (error) {
    console.error('Error finding matches:', error);
    return [];
  }
};

/**
 * Notify users about potential matches
 * @param {Object} newItem - The newly created item
 * @param {Array} matches - Array of matching items
 * @param {Object} io - Socket.io instance
 */
exports.notifyMatch = async (newItem, matches, io) => {
  try {
    // Update status of new item
    await Item.findByIdAndUpdate(newItem._id, {
      status: 'matched',
      matchedWith: matches[0]._id
    });

    // Update status of matched item
    await Item.findByIdAndUpdate(matches[0]._id, {
      status: 'matched',
      matchedWith: newItem._id
    });

    // Emit socket notification to all connected clients
    io.emit('match-found', {
      message: 'A potential match has been found!',
      newItem: {
        id: newItem._id,
        title: newItem.title,
        type: newItem.type,
        category: newItem.category,
        location: newItem.location
      },
      matches: matches.map(m => ({
        id: m._id,
        title: m.title,
        type: m.type,
        category: m.category,
        location: m.location,
        contactInfo: m.contactInfo
      }))
    });

    // Send email notification (optional)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const emailPromises = matches.map(match => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: match.user.email,
          subject: 'Match Found - Lost and Found System',
          html: `
            <h2>Great News! A Potential Match Has Been Found</h2>
            <p>Hello ${match.user.name},</p>
            <p>We found a potential match for your ${match.type} item:</p>
            <ul>
              <li><strong>Your Item:</strong> ${match.title}</li>
              <li><strong>Matched Item:</strong> ${newItem.title}</li>
              <li><strong>Category:</strong> ${newItem.category}</li>
              <li><strong>Location:</strong> ${newItem.location}</li>
            </ul>
            <p><strong>Contact Information:</strong></p>
            <ul>
              <li>Name: ${newItem.contactInfo.name}</li>
              <li>Email: ${newItem.contactInfo.email}</li>
              <li>Phone: ${newItem.contactInfo.phone}</li>
            </ul>
            <p>Please contact them to verify and claim your item.</p>
            <p>Best regards,<br>Lost and Found System</p>
          `
        };
        return transporter.sendMail(mailOptions);
      });

      await Promise.all(emailPromises);
      console.log('✅ Email notifications sent');
    }

    console.log(`✅ Match notification sent for item: ${newItem.title}`);
  } catch (error) {
    console.error('Error notifying match:', error);
  }
};
