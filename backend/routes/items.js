const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { findMatches, notifyMatch } = require('../utils/matching');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

// PATCH /api/items/:id/resolve — resolve an item and its matched listing
router.patch('/:id/resolve', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the item owner can resolve this report' });
    }

    if (item.status === 'resolved') {
      return res.status(409).json({ success: false, message: 'This item is already resolved' });
    }

    const itemIds = [item._id];
    if (item.status === 'matched' && item.matchedWith) itemIds.push(item.matchedWith);

    await Item.updateMany(
      { _id: { $in: itemIds }, status: { $in: ['active', 'matched'] } },
      { $set: { status: 'resolved' } }
    );

    const resolvedItem = await Item.findById(item._id).populate('matchedWith');
    res.status(200).json({ success: true, message: 'Item marked as resolved', item: resolvedItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resolving item', error: error.message });
  }
});

// GET /api/items  — all items with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, category, location, search, status } = req.query;
    if (location !== undefined && typeof location !== 'string') {
      return res.status(400).json({ success: false, message: 'Location filter must be a single value' });
    }
    if (search !== undefined && typeof search !== 'string') {
      return res.status(400).json({ success: false, message: 'Search must be a single value' });
    }
    let query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (location && location.trim()) {
      query.location = { $regex: escapeRegex(location.trim()), $options: 'i' };
    }
    if (status) query.status = status;
    else query.status = 'active';

    if (search && search.trim()) {
      const terms = search.trim().split(/\s+/);
      query.$and = terms.map((term) => ({
        $or: ['title', 'description', 'category', 'location'].map((field) => ({
          [field]: { $regex: escapeRegex(term), $options: 'i' }
        }))
      }));
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
