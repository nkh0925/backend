// backend/routes/api.js
const express = require('express');
const { query } = require('./config/db');
const Joi = require('joi');

const router = express.Router();

// 新增任务
router.post('/create', async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().max(100).required(),
    // 允许 description 为空字符串
    description: Joi.string().optional().allow(''),
    priority: Joi.number().integer().min(1).max(3).default(2),
    status: Joi.number().integer().min(0).max(2).default(0),
    // 新增 deadline 字段，可以是 ISO 格式的日期字符串，可选，允许为 null
    deadline: Joi.date().iso().optional().allow(null)
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { title, description, priority, status, deadline } = value;

  // 获取当前状态下最大的 order_index，新任务排在最后
  let maxOrderResult = await query('SELECT MAX(order_index) as max_order FROM tasks WHERE status = ?', [status]);
  const newOrderIndex = (maxOrderResult[0].max_order === null ? -1 : maxOrderResult[0].max_order) + 1; // 修正初始值

  // 修改 SQL 语句以包含 deadline 和 order_index
  const sql = 'INSERT INTO tasks (title, description, priority, status, deadline, order_index) VALUES (?, ?, ?, ?, ?, ?)';
  try {
    const result = await query(sql, [title, description, priority, status, deadline, newOrderIndex]);
    res.json({ task_id: result.insertId, message: '任务创建成功', order_index: newOrderIndex }); // 返回新的 order_index
  } catch (err) {
    res.status(500).json({ message: '创建任务失败', error: err.message });
  }
});

// 修改任务
router.post('/update', async (req, res) => {
  const schema = Joi.object({
    task_id: Joi.number().integer().required(),
    title: Joi.string().max(100).optional(),
    description: Joi.string().optional().allow(''), // 允许空字符串
    priority: Joi.number().integer().min(1).max(3).optional(),
    status: Joi.number().integer().min(0).max(2).optional(),
    // 新增 deadline 字段，可选，允许为 null。使用 hasOwnProperty 检查是否传入了该字段。
    deadline: Joi.date().iso().optional().allow(null)
  }).min(2); // 至少有一个更新字段 + task_id

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { task_id, title, description, priority, status, deadline } = value;

  let updates = [];
  let params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  // 检查 description 是否明确传入（即便为空字符串）
  if (Object.prototype.hasOwnProperty.call(value, 'description')) { updates.push('description = ?'); params.push(description); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  // 检查 deadline 是否明确传入（即便为 null）
  if (Object.prototype.hasOwnProperty.call(value, 'deadline')) { updates.push('deadline = ?'); params.push(deadline); }


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

// 获取任务列表（添加 status 过滤和 order_index 排序）
router.post('/list', async (req, res) => {
  const schema = Joi.object({
    search: Joi.string().optional().default(''),
    page: Joi.number().integer().min(1).default(1),
    status: Joi.number().integer().min(0).max(2).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { search, page, status } = value;

  const limit = 5;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM tasks';
  let params = [];
  let whereClauses = [];

  if (status !== undefined) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  if (search) {
    whereClauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }
  sql += ' ORDER BY order_index ASC, create_time DESC';
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const results = await query(sql, params);
    // 计算总任务数
    let countSql = 'SELECT COUNT(*) as total FROM tasks';
    let countParams = [];
    let countWhereClauses = [];

    if (status !== undefined) {
      countWhereClauses.push('status = ?');
      countParams.push(status);
    }
    if (search) {
      countWhereClauses.push('(title LIKE ? OR description LIKE ?)');
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (countWhereClauses.length > 0) {
      countSql += ' WHERE ' + countWhereClauses.join(' AND ');
    }
    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ tasks: results, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: '获取任务列表失败', error: err.message });
  }
});

// 删除任务 (无需修改)
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

// 更新任务状态 (我们将将其替换为新的 DND API `reorder-tasks-and-status`)
// 为避免混淆，暂时注释或删除此路由。如果需要单独的状态更新，建议使用新 API
// router.post('/update-status', async (req, res) => { /* ... */ });

// 新增：重新排序任务及更新状态的 API
router.post('/reorder-tasks-and-status', async (req, res) => {
  const schema = Joi.object({
    taskId: Joi.number().integer().required(),
    newStatus: Joi.number().integer().min(0).max(2).required(),
    newIndex: Joi.number().integer().required() // 目标在目标列中的索引位置
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { taskId, newStatus, newIndex } = value;

  let conn; // 用于事务管理
  try {
    // 开启事务
    conn = await query('START TRANSACTION');

    // 1. 获取被拖拽任务的当前状态和顺序
    const [draggedTask] = await query('SELECT status, order_index FROM tasks WHERE task_id = ?', [taskId]);
    if (!draggedTask) {
      await query('ROLLBACK');
      return res.status(404).json({ message: 'Task not found' });
    }
    const oldStatus = draggedTask.status;

    // 2. 更新任务的状态，并暂时移除其 order_index（设置为 NULL）
    await query('UPDATE tasks SET status = ?, order_index = NULL WHERE task_id = ?', [newStatus, taskId]);

    // 3. 如果任务从旧列移动到新列，重新排序旧列中的任务以填补空缺
    if (oldStatus !== newStatus) {
      const oldColumnTasks = await query('SELECT task_id FROM tasks WHERE status = ? ORDER BY order_index ASC', [oldStatus]);
      for (let i = 0; i < oldColumnTasks.length; i++) {
        await query('UPDATE tasks SET order_index = ? WHERE task_id = ?', [i, oldColumnTasks[i].task_id]);
      }
    }

    // 4. 获取新列中的所有任务（包括刚刚移动过来的任务），并按照新的顺序重新赋值 order_index
    let newColumnTasks = await query('SELECT task_id FROM tasks WHERE status = ? ORDER BY order_index ASC', [newStatus]);
    // 从列表中移除被拖拽任务（如果它在更新状态前就已在新列中，避免重复）
    newColumnTasks = newColumnTasks.filter(t => t.task_id !== taskId);

    // 将被拖拽任务插入到指定的新索引位置
    newColumnTasks.splice(newIndex, 0, { task_id: taskId });

    // 重新为新列中的所有任务赋值连续的 order_index
    for (let i = 0; i < newColumnTasks.length; i++) {
      await query('UPDATE tasks SET order_index = ? WHERE task_id = ?', [i, newColumnTasks[i].task_id]);
    }

    // 提交事务
    await query('COMMIT');
    res.json({ message: '任务重新排序成功' });

  } catch (err) {
    // 发生错误时回滚事务
    if (conn) await query('ROLLBACK');
    console.error('Reorder and status update error:', err);
    res.status(500).json({ message: '任务重新排序失败', error: err.message });
  }
});


module.exports = router;
