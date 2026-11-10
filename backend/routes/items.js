const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { findMatches, notifyMatch } = require('../utils/matching');

// ─────────────────────────────────────────────
// IMPORTANT: specific named routes MUST come
// before the /:id wildcard route
// ─────────────────────────────────────────────

// GET /api/items/my-items  — logged-in user's items
router.get('/my-items', protect, async (req, res) => {
  try {
    const items = await Item.find({ user: req.user.id })
      .populate('matchedWith')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching your items', error: error.message });
  }
});

// GET /api/items/admin/all  — all items (admin only)
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const items = await Item.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching items', error: error.message });
  }
});

// POST /api/items  — create new item
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { type, title, description, category, location, date } = req.body;

    const itemData = {
      type, title, description, category, location, date,
      user: req.user.id,
      contactInfo: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone
      }
    };

    if (req.file) itemData.image = req.file.filename;

    const item = await Item.create(itemData);
    const matches = await findMatches(item);
    const io = req.app.get('io');

    if (matches.length > 0) {
      await notifyMatch(item, matches, io);
    }

    res.status(201).json({
      success: true,
      message: 'Item reported successfully',
      item,
      matchesFound: matches.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating item', error: error.message });
  }
});

// GET /api/items  — all items with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, category, location, search, status } = req.query;
    let query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (status) query.status = status;
    else query.status = 'active';

    // Only use $text if text index exists and search is provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Item.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching items', error: error.message });
  }
});

// GET /api/items/:id  — single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('matchedWith');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.status(200).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching item', error: error.message });
  }
});

// PUT /api/items/:id  — update item (owner or admin)
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this item' });
    }

    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.filename;

    item = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Item updated successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating item', error: error.message });
  }
});

// DELETE /api/items/:id  — delete item (owner or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting item', error: error.message });
  }
});

module.exports = router;
