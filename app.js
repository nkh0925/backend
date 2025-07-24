require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const taskBoardRoutes = require('./taskBoard'); // 导入 taskboard.js 的路由

const app = express();
const port = process.env.SERVER_PORT || 3001;

app.use(bodyParser.json());
app.use(cors());

// 挂载看板路由（所有 /api/tasks/* 接口）
app.use('/api/tasks', taskBoardRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
