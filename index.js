const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// 新增任务 (POST /api/tasks/create)
router.post('/create', async (req, res) => {
  const { title, description, priority = 2, status = 0 } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, priority, status) VALUES (?, ?, ?, ?)',
      [title, description, priority, status]
    );
    res.json({ id: result.insertId, message: 'Task created' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating task' });
  }
});

// 修改任务 (POST /api/tasks/update)
router.post('/update', async (req, res) => {
  const { id, title, description, priority, status } = req.body;
  if (!id) return res.status(400).json({ message: 'ID is required' });

  let query = 'UPDATE tasks SET ';
  const params = [];
  if (title) { query += 'title = ?, '; params.push(title); }
  if (description) { query += 'description = ?, '; params.push(description); }
  if (priority) { query += 'priority = ?, '; params.push(priority); }
  if (status !== undefined) { query += 'status = ?, '; params.push(status); }
  query = query.slice(0, -2) + ' WHERE id = ?';
  params.push(id);

  try {
    await pool.query(query, params);
    res.json({ message: 'Task updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating task' });
  }
});

// 删除任务 (POST /api/tasks/delete)
router.post('/delete', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'ID is required' });

  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// 获取任务列表 (POST /api/tasks/list)
router.post('/list', async (req, res) => {
  const { search = '', page = 1 } = req.body;
  const limit = 20;  // 每页20条，支持无限滚动
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM tasks';
  const params = [];
  if (search) {
    query += ' WHERE title LIKE ? OR description LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const [rows] = await pool.query(query, params);
    res.json({ tasks: rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// 更新任务状态 (POST /api/tasks/update-status)
router.post('/update-status', async (req, res) => {
  const { id, status } = req.body;
  if (!id || status === undefined) return res.status(400).json({ message: 'ID and status are required' });

  try {
    await pool.query('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating status' });
  }
});

module.exports = router;
