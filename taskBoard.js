const express = require('express');
const { query } = require('./config/db');
const Joi = require('joi'); 

const router = express.Router();

// 新增任务
router.post('/create', async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().max(100).required(),
    description: Joi.string().optional(),
    priority: Joi.number().integer().min(1).max(3).default(2),
    status: Joi.number().integer().min(0).max(2).default(0)
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { title, description, priority, status } = value; 

  const sql = 'INSERT INTO tasks (title, description, priority, status) VALUES (?, ?, ?, ?)';
  try {
    const result = await query(sql, [title, description, priority, status]);
    res.json({ task_id: result.insertId, message: '任务创建成功' });
  } catch (err) {
    res.status(500).json({ message: '创建任务失败', error: err.message });
  }
});

// 修改任务
router.post('/update', async (req, res) => {
  // priority, status允许undefined，但有范围
  const schema = Joi.object({
    task_id: Joi.number().integer().required(),
    title: Joi.string().max(100).optional(),
    description: Joi.string().optional(),
    priority: Joi.number().integer().min(1).max(3).optional(),
    status: Joi.number().integer().min(0).max(2).optional()
  }).min(2); // 至少有一个更新字段 + task_id

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { task_id, title, description, priority, status } = value;

  let updates = [];
  let params = [];
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description) { updates.push('description = ?'); params.push(description); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }

  if (updates.length === 0) return res.status(200).json({ message: 'No changes' });

  const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE task_id = ?`;
  params.push(task_id);

  try {
    const result = await query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: '任务修改成功' });
  } catch (err) {
    res.status(500).json({ message: '任务修改失败', error: err.message });
  }
});

// 删除任务
router.post('/delete', async (req, res) => {
  const schema = Joi.object({
    task_id: Joi.number().integer().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { task_id } = value;

  const sql = 'DELETE FROM tasks WHERE task_id = ?';
  try {
    const result = await query(sql, [task_id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: '任务删除成功' });
  } catch (err) {
    res.status(500).json({ message: '任务删除失败', error: err.message });
  }
});

// 获取任务列表
router.post('/list', async (req, res) => {
  const schema = Joi.object({
    search: Joi.string().optional().default(''),
    page: Joi.number().integer().min(1).default(1)
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { search, page } = value;

  const limit = 20;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM tasks';
  let params = [];
  if (search) {
    sql += ' WHERE title LIKE ? OR description LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const results = await query(sql, params);
    // 计算总任务数
    let countSql = 'SELECT COUNT(*) as total FROM tasks';
    let countParams = [];
    if (search) {
      countSql += ' WHERE title LIKE ? OR description LIKE ?';
      countParams = [`%${search}%`, `%${search}%`];
    }
    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ tasks: results, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: '获取任务列表失败', error: err.message });
  }
});

// 更新任务状态
router.post('/update-status', async (req, res) => {
  const schema = Joi.object({
    task_id: Joi.number().integer().required(),
    status: Joi.number().integer().min(0).max(2).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { task_id, status } = value;

  const sql = 'UPDATE tasks SET status = ? WHERE task_id = ?';
  try {
    const result = await query(sql, [status, task_id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: '更新状态成功' });
  } catch (err) {
    res.status(500).json({ message: '更新状态失败', error: err.message });
  }
});

module.exports = router;
