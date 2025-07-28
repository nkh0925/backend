const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const taskBoardRoutes = require('./taskBoard');
require('dotenv').config();

const app = express();
const port = process.env.SERVER_PORT || 3001;

app.use(bodyParser.json());
app.use(cors());

app.use(morgan(':method :url :status :response-time ms'));


// 挂载看板路由（所有 /api/tasks/* 接口）
app.use('/api/tasks', taskBoardRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
