const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');

// All routes here require: valid JWT + admin role
router.use(protect, adminOnly);

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers    = await User.countDocuments({ role: 'user' });
    const totalItems    = await Item.countDocuments();
    const lostItems     = await Item.countDocuments({ type: 'lost' });
    const foundItems    = await Item.countDocuments({ type: 'found' });
    const matchedItems  = await Item.countDocuments({ status: 'matched' });
    const resolvedItems = await Item.countDocuments({ status: 'resolved' });
    const activeItems   = await Item.countDocuments({ status: 'active' });
    const blockedUsers  = await User.countDocuments({ isBlocked: true });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers, totalItems, lostItems, foundItems,
        matchedItems, resolvedItems, activeItems, blockedUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
});

// ─────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────

// GET /api/admin/users  — list all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Attach item count per user
    const usersWithCount = await Promise.all(
      users.map(async (u) => {
        const itemCount = await Item.countDocuments({ user: u._id });
        return { ...u.toObject(), itemCount };
      })
    );

    res.status(200).json({ success: true, count: usersWithCount.length, users: usersWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
  }
});

// DELETE /api/admin/users/:id  — delete a user + their items
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Prevent deleting another admin
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete an admin account' });
    }

    // Delete all items belonging to this user
    await Item.deleteMany({ user: req.params.id });

    // Delete the user
    await user.deleteOne();

    res.status(200).json({ success: true, message: 'User and their items deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  }
});

// PATCH /api/admin/users/:id/block  — toggle block/unblock
router.patch('/users/:id/block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot block an admin account' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      isBlocked: user.isBlocked
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user', error: error.message });
  }
});

// ─────────────────────────────────────────────
// ITEM MANAGEMENT
// ─────────────────────────────────────────────

// GET /api/admin/items  — all items with user info
router.get('/items', async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = {};

    if (type)   query.type   = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title:    { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Item.find(query)
      .populate('user', 'name email phone isBlocked')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching items', error: error.message });
  }
});

// DELETE /api/admin/items/:id  — delete any item
router.delete('/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    await item.deleteOne();
    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting item', error: error.message });
  }
});

// PATCH /api/admin/items/:id/status  — update item status
router.patch('/items/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'matched', 'resolved'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    res.status(200).json({ success: true, message: 'Status updated successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating status', error: error.message });
  }
});

module.exports = router;
