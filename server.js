const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

// Connect to SQLite database
const db = new sqlite3.Database(':memory:');

// Create tasks table
db.serialize(() => {
  db.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      completed_at DATETIME,
      created_at DATETIME,
      updated_at DATETIME
    )
  `);
});

app.use(express.json());

// Middleware to update timestamps before saving to the database
app.use((req, res, next) => {
  req.timestamp = new Date().toISOString();
  next();
});

// Create a task
app.post('/tasks', (req, res) => {
  const { title, description } = req.body;
  const id = uuidv4();
  const created_at = req.timestamp;
  const updated_at = req.timestamp;
  const completed_at = null;

  db.run(
    'INSERT INTO tasks (id, title, description, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, description, completed_at, created_at, updated_at],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create task' });
      }

      res.status(201).json({
        id,
        title,
        description,
        completed_at,
        created_at,
        updated_at,
      });
    }
  );
});

// List all tasks or search by title/description
app.get('/tasks', (req, res) => {
  const { title, description } = req.query;

  let query = 'SELECT * FROM tasks';
  const params = [];

  if (title || description) {
    query += ' WHERE';
    if (title) {
      query += ' title LIKE ?';
      params.push(`%${title}%`);
    }
    if (description) {
      query += title ? ' AND' : '';
      query += ' description LIKE ?';
      params.push(`%${description}%`);
    }
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    res.status(200).json(rows);
  });
});

// Update a task by id
app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  if (!title && !description) {
    return res.status(400).json({ error: 'Title or description is required for update' });
  }

  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated_at = req.timestamp;
    const newTitle = title !== undefined ? title : row.title;
    const newDescription = description !== undefined ? description : row.description;

    db.run(
      'UPDATE tasks SET title = ?, description = ?, updated_at = ? WHERE id = ?',
      [newTitle, newDescription, updated_at, id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update task' });
        }

        res.status(200).json({
          id,
          title: newTitle,
          description: newDescription,
          completed_at: row.completed_at,
          created_at: row.created_at,
          updated_at,
        });
      }
    );
  });
});

// Delete a task by id
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.run('DELETE FROM tasks WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) {
        return res.status(500).json({ error: 'Failed to delete task' });
      }

      res.status(204).send();
    });
  });
});

// Mark a task as complete by id
app.patch('/tasks/:id/complete', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const completed_at = req.timestamp;

    db.run(
      'UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?',
      [completed_at, req.timestamp, id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to complete task' });
        }

        res.status(200).json({
          id,
          title: row.title,
          description: row.description,
          completed_at,
          created_at: row.created_at,
          updated_at: req.timestamp,
        });
      }
    );
  });
});

// Import tasks from CSV file
app.post('/tasks/import', (req, res) => {
  const tasks = [];

  // Assuming 'tasks.csv' is the name of the uploaded file
  fs.createReadStream('tasks.csv')
    .pipe(csv())
    .on('data', (row) => {
      const id = uuidv4();
      const created_at = req.timestamp;
      const updated_at = req.timestamp;
      const completed_at = row.completed_at || null;

      tasks.push({
        id,
        title: row.title,
        description: row.description,
        completed_at,
        created_at,
        updated_at,
      });
    })
    .on('end', () => {
      const placeholders = tasks.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');

      const values = tasks.reduce((acc, task) => {
        acc.push(
          task.id,
          task.title,
          task.description,
          task.completed_at,
          task.created_at,
          task.updated_at
        );
        return acc;
      }, []);

      const query = `INSERT
      const query = `INSERT INTO tasks (id, title, description, completed_at, created_at, updated_at) VALUES ${placeholders}`;

      db.run(query, values, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to import tasks' });
        }

        res.status(201).json({ message: 'Tasks imported successfully' });
      });
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
