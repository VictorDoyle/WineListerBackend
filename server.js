require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// MySQL init
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10, // keep low in dev but max 115 in prod
    queueLimit: 0, // non limited Q length; req stay in Q if non available, use this to balance later
    waitForConnections: true, // if pool full keep to true then build switch on non full
    acquireTimeout: 10000, // ms timeout -- idk yet but keep this for safety and stagger
    connectionIdleTimeout: 30000, // ms timeout --- clean out idles and timeouts to clear up q
    debug: false // keep handy for dev non prod
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        process.exit(1);
    }
    console.log('Connected to MySQL as threadId ' + connection.threadId);
});

// gen jwt
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

/* SECTION: Signup route */
app.post('/signup',
    body('name').notEmpty().trim().escape(),
    body('username').isLength({ min: 3 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).trim().escape(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, username, email, password } = req.body;

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error hashing password:', err);
                return res.status(500).send('Server error');
            }

            // insert new user
            const query = 'INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)';
            pool.query(query, [name, username, email, hashedPassword], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return res.status(500).send('Error signing up');
                }
                res.status(201).send('Signup successful');
            });
        });
    }
);

/* SECTION: Login route */
app.post('/login',
    body('username').isLength({ min: 3 }).trim().escape(),
    body('password').isLength({ min: 6 }).trim().escape(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Authenticate credentials
        const query = 'SELECT * FROM users WHERE username = ?';
        pool.query(query, [username], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).send('Server error');
            }
            if (results.length === 0) {
                return res.status(401).send('Invalid credentials');
            }

            const user = results[0];

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    return res.status(500).send('Server error');
                }
                if (!isMatch) {
                    return res.status(401).send('Invalid credentials');
                }

                // Generate token
                const token = generateToken(user.id);
                res.status(200).json({ token });
            });
        });
    }
);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
